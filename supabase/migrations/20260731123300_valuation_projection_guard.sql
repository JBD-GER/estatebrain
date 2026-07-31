-- Keep direct valuation table mutations consistent with the denormalized
-- property projection. The public RPC already locks the property, but RLS also
-- permits authorized clients to update or delete valuation rows directly.

begin;

create or replace function private.lock_valuation_projection()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_organization_id uuid;
  v_property_id uuid;
begin
  if tg_op = 'UPDATE'
     and (
       new.organization_id is distinct from old.organization_id
       or new.property_id is distinct from old.property_id
     ) then
    raise exception 'A valuation cannot be moved to another property or organization'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    v_organization_id := old.organization_id;
    v_property_id := old.property_id;
  else
    v_organization_id := new.organization_id;
    v_property_id := new.property_id;
  end if;

  -- Every valuation write for one property uses the same row lock. This also
  -- verifies that the denormalized organization_id matches the property.
  perform 1
    from public.properties as property_row
   where property_row.organization_id = v_organization_id
     and property_row.id = v_property_id
   for update;

  if not found then
    -- ON DELETE CASCADE invokes the child trigger after the parent is no longer
    -- visible. Let that deletion finish; all non-cascade writes must still
    -- reference a matching, existing property.
    if tg_op = 'DELETE' then
      perform 1
        from public.properties as property_row
       where property_row.id = v_property_id;

      if not found then
        return old;
      end if;
    end if;

    raise exception 'Valuation property and organization do not match'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

create or replace function private.refresh_valuation_projection()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_organization_id uuid;
  v_property_id uuid;
begin
  if tg_op = 'DELETE' then
    v_organization_id := old.organization_id;
    v_property_id := old.property_id;
  else
    v_organization_id := new.organization_id;
    v_property_id := new.property_id;
  end if;

  update public.properties as property_row
     set current_market_value_cents = (
       select valuation_row.market_value_cents
         from public.valuations as valuation_row
        where valuation_row.organization_id = v_organization_id
          and valuation_row.property_id = v_property_id
        order by
          valuation_row.valued_on desc,
          valuation_row.created_at desc,
          valuation_row.id desc
        limit 1
     )
   where property_row.organization_id = v_organization_id
     and property_row.id = v_property_id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

create or replace function private.guard_property_market_value_projection()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_expected_market_value_cents bigint;
begin
  if new.current_market_value_cents is not distinct from old.current_market_value_cents then
    return new;
  end if;

  select valuation_row.market_value_cents
    into v_expected_market_value_cents
    from public.valuations as valuation_row
   where valuation_row.organization_id = new.organization_id
     and valuation_row.property_id = new.id
   order by
     valuation_row.valued_on desc,
     valuation_row.created_at desc,
     valuation_row.id desc
   limit 1;

  -- Properties without valuation history keep their manually entered or
  -- onboarding value. Once history exists, it becomes the canonical source.
  if found
     and new.current_market_value_cents is distinct from v_expected_market_value_cents then
    raise exception 'Property market value must match the latest valuation'
      using errcode = '23514';
  end if;

  return new;
end
$$;

drop trigger if exists valuations_projection_lock on public.valuations;
create trigger valuations_projection_lock
  before insert or update or delete on public.valuations
  for each row execute function private.lock_valuation_projection();

drop trigger if exists valuations_projection_refresh on public.valuations;
create trigger valuations_projection_refresh
  after insert or update or delete on public.valuations
  for each row execute function private.refresh_valuation_projection();

drop trigger if exists properties_market_value_projection_guard
  on public.properties;
create trigger properties_market_value_projection_guard
  before update of current_market_value_cents on public.properties
  for each row execute function private.guard_property_market_value_projection();

revoke all on function private.lock_valuation_projection()
  from public, anon, authenticated, service_role;
revoke all on function private.refresh_valuation_projection()
  from public, anon, authenticated, service_role;
revoke all on function private.guard_property_market_value_projection()
  from public, anon, authenticated, service_role;

comment on function private.lock_valuation_projection() is
  'Serializes valuation mutations by property and rejects valuation scope changes or mismatches.';
comment on function private.refresh_valuation_projection() is
  'Refreshes a property market-value projection from its latest remaining valuation.';
comment on function private.guard_property_market_value_projection() is
  'Prevents direct property updates from diverging from existing valuation history.';

commit;
