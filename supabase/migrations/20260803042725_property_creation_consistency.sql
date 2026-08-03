-- Keep post-onboarding property creation aligned with the guided flow:
-- purchase-price proxy valuation history, a calculated building-AfA model and
-- at most one active unit for non-MFH properties.

begin;

do $$
begin
  if exists (
    select 1
      from public.properties as property_row
      join public.units as unit_row
        on unit_row.organization_id = property_row.organization_id
       and unit_row.property_id = property_row.id
       and unit_row.archived_at is null
     where property_row.property_type <> 'apartment_building'
     group by property_row.id
    having count(*) > 1
  ) then
    raise exception 'Existing non-apartment-building properties contain multiple active units'
      using errcode = '23514';
  end if;
end
$$;

create or replace function private.initialize_property_models_v2()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_tax_year_id uuid;
  v_annual_rate numeric(7,6);
begin
  if new.market_value_status <> 'estimated'
     or new.market_value_source <> 'purchase_price_proxy'
     or new.current_market_value_cents is null then
    return new;
  end if;

  insert into public.valuations (
    organization_id,
    property_id,
    valued_on,
    market_value_cents,
    source_type,
    source_name,
    confidence,
    assumptions,
    created_by
  )
  values (
    new.organization_id,
    new.id,
    current_date,
    new.current_market_value_cents,
    'purchase_price_proxy',
    'Startschätzung auf Basis des Kaufpreises',
    0.25,
    jsonb_build_object(
      'propertyCreationV2', true,
      'method', 'purchase_price_proxy',
      'note', 'Unverbindlicher Startwert; aktuelle Marktwertermittlung ausstehend.'
    ),
    new.created_by
  );

  if new.purchase_date is null
     or new.construction_year is null
     or new.building_value_cents is null
     or new.building_value_cents <= 0
     or new.total_acquisition_cost_cents is null
     or new.land_value_cents is null then
    return new;
  end if;

  select tax_year_row.id
    into v_tax_year_id
    from public.tax_years as tax_year_row
   where tax_year_row.organization_id = new.organization_id
   order by
     (tax_year_row.year = extract(year from current_date)::integer) desc,
     tax_year_row.year desc
   limit 1;

  v_annual_rate := case
    when new.property_type = 'commercial' and new.construction_year > 1985
      then 0.03
    when new.property_type = 'commercial' then 0.025
    when new.construction_year >= 2023 then 0.03
    when new.construction_year >= 1925 then 0.02
    else 0.025
  end;

  insert into public.depreciation_assets (
    organization_id,
    property_id,
    tax_year_id,
    name,
    asset_type,
    acquisition_date,
    use_start_date,
    acquisition_cost_cents,
    land_share_cents,
    depreciable_basis_cents,
    annual_rate,
    manual_adjustment_cents,
    calculation_method,
    source_type,
    basis_as_of,
    manual_annual_depreciation_cents,
    explanation,
    created_by
  )
  values (
    new.organization_id,
    new.id,
    v_tax_year_id,
    'Gebäude-AfA (Immobilienanlage v2)',
    'building',
    new.purchase_date,
    new.purchase_date,
    new.total_acquisition_cost_cents,
    new.land_value_cents,
    new.building_value_cents,
    v_annual_rate,
    0,
    'straight_line',
    'calculated',
    new.purchase_date,
    null,
    'Lineare Gebäude-AfA aus Baujahr und modellierter Gebäudebasis; bei Bestandsobjekten mit der Steuererklärung abzugleichen.',
    new.created_by
  );

  return new;
end
$$;

drop trigger if exists properties_initialize_models_v2
  on public.properties;
create trigger properties_initialize_models_v2
  after insert on public.properties
  for each row execute function private.initialize_property_models_v2();

revoke all on function private.initialize_property_models_v2()
  from public, anon, authenticated, service_role;

create or replace function private.guard_property_unit_capacity_v2()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_old_organization_id uuid;
  v_old_property_id uuid;
  v_new_organization_id uuid;
  v_new_property_id uuid;
  v_target record;
  v_old_property_found boolean := false;
  v_new_property_found boolean := false;
  v_property_type text;
  v_projected_unit_count integer := 0;
  v_other_active_unit_count bigint := 0;
begin
  if tg_op in ('UPDATE', 'DELETE') then
    v_old_organization_id := old.organization_id;
    v_old_property_id := old.property_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new_organization_id := new.organization_id;
    v_new_property_id := new.property_id;
  end if;

  -- Direct property hard-deletes with units are rejected separately. A nested
  -- FK delete here is therefore an organization-owned cascade and must not be
  -- blocked by operational lease checks or acquire child/parent locks again.
  if tg_op = 'DELETE' and pg_catalog.pg_trigger_depth() > 1 then
    return old;
  end if;

  -- Parent rows are locked in a stable order before the advisory locks. This
  -- serializes inserts, moves, rent changes, archives and deletes per property
  -- and shares the same row -> advisory order as property type updates.
  for v_target in
    select
      property_row.organization_id,
      property_row.id as property_id,
      property_row.property_type,
      property_row.unit_count,
      target_row.is_old,
      target_row.is_new
    from (
      select
        candidate.organization_id,
        candidate.property_id,
        bool_or(candidate.is_old) as is_old,
        bool_or(candidate.is_new) as is_new
      from (
        values
          (v_old_organization_id, v_old_property_id, true, false),
          (v_new_organization_id, v_new_property_id, false, true)
      ) as candidate(organization_id, property_id, is_old, is_new)
      where candidate.property_id is not null
      group by candidate.organization_id, candidate.property_id
    ) as target_row
    join public.properties as property_row
      on property_row.organization_id = target_row.organization_id
     and property_row.id = target_row.property_id
    order by property_row.organization_id, property_row.id
    for update of property_row
  loop
    if v_target.is_old then
      v_old_property_found := true;
    end if;
    if v_target.is_new then
      v_new_property_found := true;
      v_property_type := v_target.property_type;
      v_projected_unit_count := coalesce(v_target.unit_count, 0);
    end if;
  end loop;

  for v_target in
    select distinct
      candidate.organization_id,
      candidate.property_id
    from (
      values
        (v_old_organization_id, v_old_property_id),
        (v_new_organization_id, v_new_property_id)
    ) as candidate(organization_id, property_id)
    where candidate.property_id is not null
    order by candidate.organization_id, candidate.property_id
  loop
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(v_target.property_id::text, 0)
    );
  end loop;

  -- A parent/organization cascade reaches the unit after its property row is
  -- already gone. Let the FK cascade own that delete; direct unit deletes keep
  -- the active-lease protection below.
  if tg_op = 'DELETE' and not v_old_property_found then
    return old;
  end if;

  if (
       tg_op = 'DELETE'
       or (
         tg_op = 'UPDATE'
         and old.archived_at is null
         and new.archived_at is not null
       )
     )
     and exists (
       select 1
         from public.leases as lease_row
        where lease_row.organization_id = v_old_organization_id
          and lease_row.unit_id = old.id
          and lease_row.status in ('active', 'notice_given')
          and lease_row.archived_at is null
     ) then
    raise exception 'A unit with an active lease cannot be archived or deleted'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  if not v_new_property_found then
    raise exception 'Unit property was not found in the organization'
      using errcode = '23503';
  end if;

  if new.archived_at is not null then
    return new;
  end if;

  -- unit_count is refreshed by the AFTER trigger while the parent row remains
  -- locked. The direct count additionally protects pre-migration/stale data.
  if tg_op = 'UPDATE'
     and old.organization_id = new.organization_id
     and old.property_id = new.property_id
     and old.archived_at is null then
    v_projected_unit_count := greatest(v_projected_unit_count - 1, 0);
  end if;

  select count(*)
    into v_other_active_unit_count
    from public.units as unit_row
   where unit_row.organization_id = new.organization_id
     and unit_row.property_id = new.property_id
     and unit_row.archived_at is null
     and unit_row.id is distinct from new.id;

  v_other_active_unit_count := greatest(
    v_other_active_unit_count,
    v_projected_unit_count
  );

  if v_property_type <> 'apartment_building'
     and v_other_active_unit_count > 0 then
    raise exception 'Only apartment buildings can contain multiple active units'
      using errcode = '23514';
  end if;

  return new;
end
$$;

drop trigger if exists units_property_capacity_v2 on public.units;
create trigger units_property_capacity_v2
  before insert or update or delete
  on public.units
  for each row execute function private.guard_property_unit_capacity_v2();

revoke all on function private.guard_property_unit_capacity_v2()
  from public, anon, authenticated, service_role;

create or replace function private.guard_property_unit_type_transition_v2()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_active_unit_count bigint;
begin
  if new.property_type is not distinct from old.property_type
     or new.property_type = 'apartment_building' then
    return new;
  end if;

  -- The property row is already locked by UPDATE. Unit mutations take that
  -- same row lock first, then this advisory lock, so the two paths cannot race.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(old.id::text, 0)
  );

  select count(*)
    into v_active_unit_count
    from public.units as unit_row
   where unit_row.organization_id = old.organization_id
     and unit_row.property_id = old.id
     and unit_row.archived_at is null;

  v_active_unit_count := greatest(
    v_active_unit_count,
    coalesce(old.unit_count, 0)
  );

  if v_active_unit_count > 1 then
    raise exception 'A property with multiple active units must remain an apartment building'
      using errcode = '23514';
  end if;

  return new;
end
$$;

drop trigger if exists properties_unit_type_transition_v2
  on public.properties;
create trigger properties_unit_type_transition_v2
  before update of property_type on public.properties
  for each row execute function private.guard_property_unit_type_transition_v2();

revoke all on function private.guard_property_unit_type_transition_v2()
  from public, anon, authenticated, service_role;

create or replace function private.guard_property_hard_delete_v2()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  -- Organization-owned FK cascades are intentional. A direct hard delete of
  -- a populated property is not: it must be archived or emptied explicitly.
  if pg_catalog.pg_trigger_depth() = 1
     and exists (
       select 1
         from public.units as unit_row
        where unit_row.organization_id = old.organization_id
          and unit_row.property_id = old.id
     ) then
    raise exception 'A property with units cannot be hard-deleted; archive it or remove its units first'
      using errcode = '23514';
  end if;
  return old;
end
$$;

drop trigger if exists properties_hard_delete_v2 on public.properties;
create trigger properties_hard_delete_v2
  before delete on public.properties
  for each row execute function private.guard_property_hard_delete_v2();

revoke all on function private.guard_property_hard_delete_v2()
  from public, anon, authenticated, service_role;

create or replace function private.refresh_property_unit_projection_v2()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_old_organization_id uuid;
  v_old_property_id uuid;
  v_new_organization_id uuid;
  v_new_property_id uuid;
begin
  if tg_op = 'DELETE' and pg_catalog.pg_trigger_depth() > 1 then
    return old;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    v_old_organization_id := old.organization_id;
    v_old_property_id := old.property_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    v_new_organization_id := new.organization_id;
    v_new_property_id := new.property_id;
  end if;

  if v_old_property_id is not null
     and (
       v_new_property_id is null
       or v_old_organization_id is distinct from v_new_organization_id
       or v_old_property_id is distinct from v_new_property_id
     ) then
    update public.properties as property_row
       set unit_count = (
             select count(*)::integer
               from public.units as unit_row
              where unit_row.organization_id = v_old_organization_id
                and unit_row.property_id = v_old_property_id
                and unit_row.archived_at is null
           ),
           expected_monthly_rent_cents = coalesce(
             (
               select sum(unit_row.target_cold_rent_cents)::bigint
                 from public.units as unit_row
                where unit_row.organization_id = v_old_organization_id
                  and unit_row.property_id = v_old_property_id
                  and unit_row.archived_at is null
             ),
             0
           )
     where property_row.organization_id = v_old_organization_id
       and property_row.id = v_old_property_id;
  end if;

  if v_new_property_id is not null then
    update public.properties as property_row
       set unit_count = (
             select count(*)::integer
               from public.units as unit_row
              where unit_row.organization_id = v_new_organization_id
                and unit_row.property_id = v_new_property_id
                and unit_row.archived_at is null
           ),
           expected_monthly_rent_cents = coalesce(
             (
               select sum(unit_row.target_cold_rent_cents)::bigint
                 from public.units as unit_row
                where unit_row.organization_id = v_new_organization_id
                  and unit_row.property_id = v_new_property_id
                  and unit_row.archived_at is null
             ),
             0
           )
     where property_row.organization_id = v_new_organization_id
       and property_row.id = v_new_property_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

drop trigger if exists units_refresh_property_projection_v2 on public.units;
create trigger units_refresh_property_projection_v2
  after insert or update or delete on public.units
  for each row execute function private.refresh_property_unit_projection_v2();

revoke all on function private.refresh_property_unit_projection_v2()
  from public, anon, authenticated, service_role;

update public.properties as property_row
   set unit_count = (
         select count(*)::integer
           from public.units as unit_row
          where unit_row.organization_id = property_row.organization_id
            and unit_row.property_id = property_row.id
            and unit_row.archived_at is null
       ),
       expected_monthly_rent_cents = coalesce(
         (
           select sum(unit_row.target_cold_rent_cents)::bigint
             from public.units as unit_row
            where unit_row.organization_id = property_row.organization_id
              and unit_row.property_id = property_row.id
              and unit_row.archived_at is null
         ),
         0
       );

create or replace function private.protect_property_unit_projection_v2()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    new.unit_count := 0;
    new.expected_monthly_rent_cents := 0;
    return new;
  end if;

  -- A unit AFTER trigger updates these fields at trigger depth 2. Direct table
  -- and RPC updates run at depth 1 and may not replace derived projections.
  if pg_catalog.pg_trigger_depth() = 1
     and (
       new.unit_count is distinct from old.unit_count
       or new.expected_monthly_rent_cents
          is distinct from old.expected_monthly_rent_cents
     ) then
    raise exception 'Property unit count and target rent are derived from active units'
      using errcode = '23514';
  end if;

  return new;
end
$$;

drop trigger if exists properties_initialize_unit_projection_v2
  on public.properties;
create trigger properties_initialize_unit_projection_v2
  before insert on public.properties
  for each row execute function private.protect_property_unit_projection_v2();

drop trigger if exists properties_protect_unit_projection_v2
  on public.properties;
create trigger properties_protect_unit_projection_v2
  before update of unit_count, expected_monthly_rent_cents
  on public.properties
  for each row execute function private.protect_property_unit_projection_v2();

revoke all on function private.protect_property_unit_projection_v2()
  from public, anon, authenticated, service_role;

comment on function private.initialize_property_models_v2() is
  'Trigger-only: adds a purchase-price proxy valuation and calculated building-AfA model to post-onboarding property creation.';
comment on function private.guard_property_unit_capacity_v2() is
  'Trigger-only: serializes every unit mutation, blocks active-lease archival and permits multiple active units only for apartment buildings.';
comment on function private.guard_property_unit_type_transition_v2() is
  'Trigger-only: prevents changing a multi-unit apartment building to a property type that allows only one active unit.';
comment on function private.guard_property_hard_delete_v2() is
  'Trigger-only: requires populated properties to be archived or emptied before a direct hard delete while allowing organization cascades.';
comment on function private.refresh_property_unit_projection_v2() is
  'Trigger-only: keeps property unit_count and monthly target cold rent equal to active unit rows.';
comment on function private.protect_property_unit_projection_v2() is
  'Trigger-only: initializes and protects unit-derived property projection fields from direct writes.';

commit;
