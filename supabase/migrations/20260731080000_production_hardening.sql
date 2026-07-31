-- Estate Brain production hardening
--
-- Keeps tenant-visible rows free of internal notes, closes direct Data API
-- permission gaps, makes onboarding atomic, and exposes only a deliberately
-- small tenant-portal projection.

-- The product limit is 10 MiB. Enforce it in Postgres and Storage as well as
-- in the application route so direct API clients cannot bypass the limit.
alter table public.documents
  drop constraint if exists documents_size;

alter table public.documents
  add constraint documents_size
  check (size_bytes > 0 and size_bytes <= 10485760);

update storage.buckets
   set file_size_limit = 10485760
 where id = 'documents';

-- Internal tenant notes must never share a tenant-readable row.
create table public.tenant_internal_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  notes text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_internal_notes_unique unique (tenant_id),
  constraint tenant_internal_notes_body check (
    char_length(trim(notes)) between 1 and 20000
  )
);

insert into public.tenant_internal_notes (
  organization_id,
  tenant_id,
  notes,
  created_by,
  created_at,
  updated_at
)
select
  organization_id,
  id,
  notes,
  created_by,
  created_at,
  updated_at
from public.tenants
where nullif(trim(notes), '') is not null;

alter table public.tenants drop column notes;

-- Maintenance internal notes likewise live on a staff-only row.
create table public.maintenance_request_internal_notes (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  maintenance_request_id uuid not null references public.maintenance_requests(id) on delete cascade,
  notes text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_request_internal_notes_unique unique (maintenance_request_id),
  constraint maintenance_request_internal_notes_body check (
    char_length(trim(notes)) between 1 and 20000
  )
);

insert into public.maintenance_request_internal_notes (
  organization_id,
  maintenance_request_id,
  notes,
  created_by,
  created_at,
  updated_at
)
select
  organization_id,
  id,
  internal_notes,
  created_by,
  created_at,
  updated_at
from public.maintenance_requests
where nullif(trim(internal_notes), '') is not null;

alter table public.maintenance_requests drop column internal_notes;

create index tenant_internal_notes_org_idx
  on public.tenant_internal_notes (organization_id, tenant_id);

create index maintenance_request_internal_notes_org_idx
  on public.maintenance_request_internal_notes (
    organization_id,
    maintenance_request_id
  );

alter table public.tenant_internal_notes enable row level security;
alter table public.tenant_internal_notes force row level security;
alter table public.maintenance_request_internal_notes enable row level security;
alter table public.maintenance_request_internal_notes force row level security;

create policy tenant_internal_notes_select_staff
  on public.tenant_internal_notes for select to authenticated
  using (private.can_manage_leases(organization_id));

create policy tenant_internal_notes_insert_staff
  on public.tenant_internal_notes for insert to authenticated
  with check (
    private.can_manage_leases(organization_id)
    and created_by = (select auth.uid())
    and exists (
      select 1
      from public.tenants as t
      where t.id = tenant_id
        and t.organization_id = organization_id
    )
  );

create policy tenant_internal_notes_update_staff
  on public.tenant_internal_notes for update to authenticated
  using (private.can_manage_leases(organization_id))
  with check (
    private.can_manage_leases(organization_id)
    and exists (
      select 1
      from public.tenants as t
      where t.id = tenant_id
        and t.organization_id = organization_id
    )
  );

create policy tenant_internal_notes_delete_staff
  on public.tenant_internal_notes for delete to authenticated
  using (private.can_manage_leases(organization_id));

create policy maintenance_internal_notes_select_staff
  on public.maintenance_request_internal_notes for select to authenticated
  using (
    exists (
      select 1
      from public.maintenance_requests as mr
      where mr.id = maintenance_request_id
        and mr.organization_id = organization_id
        and private.can_operate_property(organization_id, mr.property_id)
    )
  );

create policy maintenance_internal_notes_insert_staff
  on public.maintenance_request_internal_notes for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and exists (
      select 1
      from public.maintenance_requests as mr
      where mr.id = maintenance_request_id
        and mr.organization_id = organization_id
        and private.can_operate_property(organization_id, mr.property_id)
    )
  );

create policy maintenance_internal_notes_update_staff
  on public.maintenance_request_internal_notes for update to authenticated
  using (
    exists (
      select 1
      from public.maintenance_requests as mr
      where mr.id = maintenance_request_id
        and mr.organization_id = organization_id
        and private.can_operate_property(organization_id, mr.property_id)
    )
  )
  with check (
    exists (
      select 1
      from public.maintenance_requests as mr
      where mr.id = maintenance_request_id
        and mr.organization_id = organization_id
        and private.can_operate_property(organization_id, mr.property_id)
    )
  );

create policy maintenance_internal_notes_delete_staff
  on public.maintenance_request_internal_notes for delete to authenticated
  using (
    exists (
      select 1
      from public.maintenance_requests as mr
      where mr.id = maintenance_request_id
        and mr.organization_id = organization_id
        and private.can_operate_property(organization_id, mr.property_id)
    )
  );

create trigger tenant_internal_notes_set_updated_at
  before update on public.tenant_internal_notes
  for each row execute function private.set_updated_at();

create trigger maintenance_request_internal_notes_set_updated_at
  before update on public.maintenance_request_internal_notes
  for each row execute function private.set_updated_at();

grant select, insert, update, delete
  on public.tenant_internal_notes,
     public.maintenance_request_internal_notes
  to authenticated;

grant all privileges
  on public.tenant_internal_notes,
     public.maintenance_request_internal_notes
  to service_role;

revoke all
  on public.tenant_internal_notes,
     public.maintenance_request_internal_notes
  from public, anon;

-- Tenants can maintain their own contact details, but not turn themselves into
-- another tenant type, reactivate/archive rows, or rewrite audit ownership.
create or replace function private.guard_tenant_self_update()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if private.current_member_role(old.organization_id) = 'tenant'
     and (
       new.id is distinct from old.id
       or new.organization_id is distinct from old.organization_id
       or new.tenant_type is distinct from old.tenant_type
       or new.status is distinct from old.status
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at
       or new.archived_at is distinct from old.archived_at
     ) then
    raise exception 'Tenants may only update their own contact details'
      using errcode = '42501';
  end if;
  return new;
end
$$;

create trigger tenants_guard_self_update
  before update on public.tenants
  for each row execute function private.guard_tenant_self_update();

revoke all on function private.guard_tenant_self_update() from public, anon;
grant execute on function private.guard_tenant_self_update()
  to authenticated, service_role;

-- Application permissions do not give tenants document write access. Mirror
-- that contract in table and Storage RLS, and require current employee scope
-- even when the employee originally created the document.
drop policy if exists documents_insert_scoped on public.documents;
drop policy if exists documents_update_scoped on public.documents;
drop policy if exists documents_delete_scoped on public.documents;

create policy documents_insert_scoped
  on public.documents for insert to authenticated
  with check (
    (
      private.has_org_role(
        organization_id,
        array['owner', 'admin', 'property_manager', 'accounting']::public.app_role[]
      )
      or (
        private.current_member_role(organization_id) = 'employee'
        and property_id is not null
        and private.can_operate_property(organization_id, property_id)
      )
    )
    and created_by = (select auth.uid())
  );

create policy documents_update_scoped
  on public.documents for update to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager', 'accounting']::public.app_role[]
    )
    or (
      created_by = (select auth.uid())
      and private.current_member_role(organization_id) = 'employee'
      and property_id is not null
      and private.can_operate_property(organization_id, property_id)
    )
  )
  with check (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager', 'accounting']::public.app_role[]
    )
    or (
      created_by = (select auth.uid())
      and private.current_member_role(organization_id) = 'employee'
      and property_id is not null
      and private.can_operate_property(organization_id, property_id)
    )
  );

create policy documents_delete_scoped
  on public.documents for delete to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
    or (
      created_by = (select auth.uid())
      and private.current_member_role(organization_id) = 'employee'
      and property_id is not null
      and private.can_operate_property(organization_id, property_id)
    )
  );

create or replace function private.can_write_document_object(
  p_path text,
  p_delete boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.documents as d
    where d.organization_id = private.safe_path_uuid(p_path, 1)
      and d.id = private.safe_path_uuid(p_path, 2)
      and (
        private.has_org_role(
          d.organization_id,
          case
            when p_delete
              then array['owner', 'admin', 'property_manager']::public.app_role[]
            else array['owner', 'admin', 'property_manager', 'accounting']::public.app_role[]
          end
        )
        or (
          d.created_by = (select auth.uid())
          and private.current_member_role(d.organization_id) = 'employee'
          and d.property_id is not null
          and private.can_operate_property(d.organization_id, d.property_id)
        )
      )
  )
$$;

-- A still-valid JWT must not preserve destructive author access after an
-- organization membership or property assignment has been revoked.
drop policy if exists messages_delete_management on public.messages;

create policy messages_delete_management
  on public.messages for delete to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
    or (
      author_user_id = (select auth.uid())
      and private.is_org_member(organization_id)
      and private.can_access_conversation(organization_id, conversation_id)
    )
  );

drop policy if exists comments_delete on public.comments;

create policy comments_delete
  on public.comments for delete to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
    or (
      author_user_id = (select auth.uid())
      and private.is_org_member(organization_id)
      and (
        (
          task_id is not null
          and private.can_access_task(organization_id, task_id)
        )
        or (
          maintenance_request_id is not null
          and private.can_access_maintenance_request(
            organization_id,
            maintenance_request_id
          )
        )
      )
    )
  );

-- Invitation acceptance requires a Supabase-confirmed email, not merely an
-- email string present on auth.users.
create or replace function public.accept_invitation(raw_token text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_user_email text;
  v_invitation public.invitations%rowtype;
  v_token_hash bytea;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if char_length(coalesce(raw_token, '')) < 32 then
    raise exception 'Invalid invitation token' using errcode = '22023';
  end if;

  select lower(u.email)
    into v_user_email
    from auth.users as u
   where u.id = v_user_id
     and u.email_confirmed_at is not null;

  if v_user_email is null then
    raise exception 'A verified email address is required' using errcode = '42501';
  end if;

  v_token_hash := extensions.digest(convert_to(raw_token, 'UTF8'), 'sha256');

  select i.*
    into v_invitation
    from public.invitations as i
   where i.token_hash = v_token_hash
   for update;

  if not found
     or v_invitation.status <> 'pending'
     or v_invitation.expires_at <= now()
     or lower(v_invitation.email) <> v_user_email then
    raise exception 'Invitation is invalid, expired, or belongs to another account'
      using errcode = '42501';
  end if;

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    status,
    is_property_restricted,
    invited_by,
    joined_at,
    created_by
  )
  values (
    v_invitation.organization_id,
    v_user_id,
    v_invitation.role,
    'active',
    v_invitation.property_restricted,
    v_invitation.invited_by,
    now(),
    v_user_id
  )
  on conflict (organization_id, user_id) do update
    set role = excluded.role,
        status = 'active',
        is_property_restricted = excluded.is_property_restricted,
        invited_by = excluded.invited_by,
        joined_at = coalesce(public.organization_members.joined_at, now());

  if v_invitation.role = 'tenant' then
    insert into public.tenant_users (
      organization_id,
      tenant_id,
      user_id,
      is_primary,
      verified_at,
      created_by
    )
    values (
      v_invitation.organization_id,
      v_invitation.tenant_id,
      v_user_id,
      true,
      now(),
      v_user_id
    )
    on conflict (organization_id, user_id) do update
      set tenant_id = excluded.tenant_id,
          verified_at = coalesce(public.tenant_users.verified_at, now());
  end if;

  update public.invitations
     set status = 'accepted',
         accepted_by = v_user_id,
         accepted_at = now()
   where id = v_invitation.id;

  return v_invitation.organization_id;
end
$$;

revoke all on function public.accept_invitation(text) from public, anon;
grant execute on function public.accept_invitation(text)
  to authenticated, service_role;

-- Safe tenant projection. Properties remain invisible through the table RLS;
-- this RPC exposes only the address and contract fields needed by the portal.
create or replace function public.get_tenant_portal_context()
returns table (
  tenant_id uuid,
  lease_id uuid,
  unit_id uuid,
  property_id uuid,
  property_name text,
  property_street text,
  property_house_number text,
  property_postal_code text,
  property_city text,
  unit_number text,
  lease_starts_on date,
  lease_ends_on date,
  lease_status text,
  cold_rent_cents bigint,
  ancillary_prepayment_cents bigint,
  parking_rent_cents bigint,
  other_rent_cents bigint
)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select
    tu.tenant_id,
    l.id,
    u.id,
    p.id,
    p.name,
    p.street,
    p.house_number,
    p.postal_code,
    p.city,
    u.unit_number,
    l.starts_on,
    l.ends_on,
    l.status,
    l.cold_rent_cents,
    l.ancillary_prepayment_cents,
    l.parking_rent_cents,
    l.other_rent_cents
  from public.organization_members as om
  join public.tenant_users as tu
    on tu.organization_id = om.organization_id
   and tu.user_id = om.user_id
  join public.lease_tenants as lt
    on lt.organization_id = tu.organization_id
   and lt.tenant_id = tu.tenant_id
  join public.leases as l
    on l.organization_id = lt.organization_id
   and l.id = lt.lease_id
  join public.units as u
    on u.organization_id = l.organization_id
   and u.id = l.unit_id
  join public.properties as p
    on p.organization_id = u.organization_id
   and p.id = u.property_id
  where om.user_id = (select auth.uid())
    and om.status = 'active'
    and om.role = 'tenant'
    and l.archived_at is null
    and (
      lt.occupancy_starts_on is null
      or lt.occupancy_starts_on <= current_date
    )
    and (
      lt.occupancy_ends_on is null
      or lt.occupancy_ends_on >= current_date
    )
  order by
    case when l.status in ('active', 'notice_given') then 0 else 1 end,
    l.starts_on desc,
    l.created_at desc
$$;

revoke all on function public.get_tenant_portal_context() from public, anon;
grant execute on function public.get_tenant_portal_context()
  to authenticated, service_role;

-- One transaction creates the organization, tax profile, first property,
-- units, optional leases/schedules, financing and optional demo dataset.
create or replace function public.complete_onboarding(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_existing_organization_id uuid;
  v_organization_id uuid;
  v_property_id uuid;
  v_unit_id uuid;
  v_lease_id uuid;
  v_unit jsonb;
  v_unit_status text;
  v_unit_counter integer := 0;
  v_financing_cents bigint;
  v_import_mode text := coalesce(p_payload ->> 'importMode', 'none');
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'A permanent account is required' using errcode = '42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Onboarding payload must be an object' using errcode = '22023';
  end if;
  if jsonb_typeof(p_payload -> 'units') <> 'array'
     or jsonb_array_length(p_payload -> 'units') not between 1 and 100 then
    raise exception 'Between one and one hundred units are required'
      using errcode = '22023';
  end if;
  if v_import_mode not in ('none', 'demo') then
    raise exception 'Invalid import mode' using errcode = '22023';
  end if;

  select om.organization_id
    into v_existing_organization_id
    from public.organization_members as om
   where om.user_id = v_user_id
     and om.status = 'active'
   order by om.created_at
   limit 1;

  if v_existing_organization_id is not null then
    return v_existing_organization_id;
  end if;

  v_organization_id := public.create_organization_with_owner(
    p_payload #>> '{organization,name}',
    case p_payload #>> '{organization,organizationType}'
      when 'private' then 'private_person'
      when 'company' then 'company'
      else null
    end,
    jsonb_build_object(
      'street', p_payload #>> '{organization,street}',
      'postal_code', p_payload #>> '{organization,postalCode}',
      'city', p_payload #>> '{organization,city}',
      'country_code', 'DE'
    ),
    coalesce(p_payload #>> '{organization,currency}', 'EUR'),
    (p_payload #>> '{organization,taxYear}')::integer
  );

  insert into public.tax_profiles (
    organization_id,
    user_id,
    marginal_tax_rate,
    effective_tax_rate,
    church_tax_enabled,
    solidarity_surcharge_enabled,
    assumed_taxable_income_cents,
    assessment_type,
    calculations_enabled,
    created_by
  )
  values (
    v_organization_id,
    v_user_id,
    (nullif(p_payload #>> '{tax,marginalTaxRate}', '')::numeric / 100),
    (nullif(p_payload #>> '{tax,effectiveTaxRate}', '')::numeric / 100),
    coalesce((p_payload #>> '{tax,churchTax}')::boolean, false),
    coalesce((p_payload #>> '{tax,solidaritySurcharge}')::boolean, false),
    case
      when nullif(p_payload #>> '{tax,taxableIncome}', '') is null then null
      else round((p_payload #>> '{tax,taxableIncome}')::numeric * 100)::bigint
    end,
    case p_payload #>> '{tax,filingStatus}'
      when 'joint' then 'joint'
      else 'individual'
    end,
    coalesce((p_payload #>> '{tax,calculationsEnabled}')::boolean, true),
    v_user_id
  );

  insert into public.properties (
    organization_id,
    name,
    property_type,
    street,
    postal_code,
    city,
    country_code,
    purchase_date,
    purchase_price_cents,
    acquisition_costs_cents,
    land_value_cents,
    building_value_cents,
    total_area_sqm,
    rentable_area_sqm,
    current_market_value_cents,
    expected_monthly_rent_cents,
    unit_count,
    created_by
  )
  values (
    v_organization_id,
    p_payload #>> '{property,name}',
    p_payload #>> '{property,propertyType}',
    p_payload #>> '{property,street}',
    p_payload #>> '{property,postalCode}',
    p_payload #>> '{property,city}',
    'DE',
    nullif(p_payload #>> '{property,purchaseDate}', '')::date,
    round(coalesce((p_payload #>> '{property,purchasePrice}')::numeric, 0) * 100)::bigint,
    round(coalesce((p_payload #>> '{property,acquisitionCosts}')::numeric, 0) * 100)::bigint,
    round(coalesce((p_payload #>> '{property,landValue}')::numeric, 0) * 100)::bigint,
    round(coalesce((p_payload #>> '{property,buildingValue}')::numeric, 0) * 100)::bigint,
    (p_payload #>> '{property,totalArea}')::numeric,
    (p_payload #>> '{property,totalArea}')::numeric,
    round(coalesce((p_payload #>> '{property,marketValue}')::numeric, 0) * 100)::bigint,
    round(coalesce((p_payload #>> '{property,expectedMonthlyRent}')::numeric, 0) * 100)::bigint,
    (p_payload #>> '{property,unitCount}')::integer,
    v_user_id
  )
  returning id into v_property_id;

  for v_unit in
    select value
    from jsonb_array_elements(p_payload -> 'units')
  loop
    v_unit_counter := v_unit_counter + 1;
    v_unit_status := case v_unit ->> 'status'
      when 'occupied' then 'rented'
      when 'vacant' then 'vacant'
      when 'renovation' then 'renovation'
      else null
    end;

    if v_unit_status is null then
      raise exception 'Invalid unit status at position %', v_unit_counter
        using errcode = '22023';
    end if;

    insert into public.units (
      organization_id,
      property_id,
      unit_number,
      floor,
      area_sqm,
      rooms,
      target_cold_rent_cents,
      ancillary_prepayment_cents,
      parking_rent_cents,
      status,
      created_by
    )
    values (
      v_organization_id,
      v_property_id,
      v_unit ->> 'unitNumber',
      nullif(trim(coalesce(v_unit ->> 'floor', '')), ''),
      (v_unit ->> 'area')::numeric,
      (v_unit ->> 'rooms')::numeric,
      round(coalesce((v_unit ->> 'baseRent')::numeric, 0) * 100)::bigint,
      round(coalesce((v_unit ->> 'serviceCharge')::numeric, 0) * 100)::bigint,
      round(coalesce((v_unit ->> 'parkingRent')::numeric, 0) * 100)::bigint,
      v_unit_status,
      v_user_id
    )
    returning id into v_unit_id;

    if v_unit ->> 'status' = 'occupied'
       and nullif(v_unit ->> 'leaseStart', '') is not null then
      insert into public.leases (
        organization_id,
        unit_id,
        lease_number,
        starts_on,
        cold_rent_cents,
        ancillary_prepayment_cents,
        parking_rent_cents,
        status,
        created_by
      )
      values (
        v_organization_id,
        v_unit_id,
        'ONB-' || lpad(v_unit_counter::text, 3, '0'),
        (v_unit ->> 'leaseStart')::date,
        round(coalesce((v_unit ->> 'baseRent')::numeric, 0) * 100)::bigint,
        round(coalesce((v_unit ->> 'serviceCharge')::numeric, 0) * 100)::bigint,
        round(coalesce((v_unit ->> 'parkingRent')::numeric, 0) * 100)::bigint,
        'active',
        v_user_id
      )
      returning id into v_lease_id;

      insert into public.rent_schedules (
        organization_id,
        lease_id,
        valid_from,
        due_day,
        cold_rent_cents,
        ancillary_prepayment_cents,
        parking_rent_cents,
        created_by
      )
      values (
        v_organization_id,
        v_lease_id,
        (v_unit ->> 'leaseStart')::date,
        3,
        round(coalesce((v_unit ->> 'baseRent')::numeric, 0) * 100)::bigint,
        round(coalesce((v_unit ->> 'serviceCharge')::numeric, 0) * 100)::bigint,
        round(coalesce((v_unit ->> 'parkingRent')::numeric, 0) * 100)::bigint,
        v_user_id
      );
    end if;
  end loop;

  v_financing_cents :=
    round(coalesce((p_payload #>> '{property,currentFinancing}')::numeric, 0) * 100)::bigint;

  if v_financing_cents > 0 then
    insert into public.loans (
      organization_id,
      property_id,
      lender_name,
      original_principal_cents,
      current_balance_cents,
      nominal_interest_rate,
      monthly_payment_cents,
      status,
      notes,
      created_by
    )
    values (
      v_organization_id,
      v_property_id,
      'Bestehende Finanzierung (Onboarding)',
      v_financing_cents,
      v_financing_cents,
      0,
      0,
      'active',
      'Zinssatz und Rate ergänzen; Werte sind bis zur Bestätigung unvollständig.',
      v_user_id
    );
  end if;

  if v_import_mode = 'demo' then
    perform public.seed_demo_organization(v_organization_id);
  end if;

  update public.profiles
     set onboarding_completed_at = now()
   where id = v_user_id;

  return v_organization_id;
end
$$;

revoke all on function public.complete_onboarding(jsonb) from public, anon;
grant execute on function public.complete_onboarding(jsonb)
  to authenticated, service_role;

comment on function public.complete_onboarding(jsonb) is
  'Atomically creates all first-run Estate Brain records from a validated onboarding payload.';

comment on function public.get_tenant_portal_context() is
  'Returns the minimal property, unit and lease projection for the authenticated tenant.';
