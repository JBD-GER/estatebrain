-- Keep retained document metadata coherent when an assigned property, unit,
-- or lease is deleted through its declared SET NULL foreign key.

begin;

create or replace function private.is_document_parent_fk_set_null(
  p_old jsonb,
  p_new jsonb
)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  v_columns constant text[] :=
    array['property_id', 'unit_id', 'lease_id'];
  v_changed_column text;
  v_changed_count integer;
  v_old_id uuid;
begin
  if pg_catalog.pg_trigger_depth() <= 1 then
    return false;
  end if;

  select count(*), min(column_name)
    into v_changed_count, v_changed_column
    from pg_catalog.unnest(v_columns) as column_name
   where (p_new -> column_name) is distinct from
         (p_old -> column_name);

  if v_changed_count <> 1
     or (p_new - v_columns) is distinct from (p_old - v_columns)
     or (p_old ->> v_changed_column) is null
     or (p_new ->> v_changed_column) is not null then
    return false;
  end if;

  v_old_id := (p_old ->> v_changed_column)::uuid;

  return case v_changed_column
    when 'property_id' then not exists (
      select 1
      from public.properties as parent_row
      where parent_row.id = v_old_id
    )
    when 'unit_id' then not exists (
      select 1
      from public.units as parent_row
      where parent_row.id = v_old_id
    )
    when 'lease_id' then not exists (
      select 1
      from public.leases as parent_row
      where parent_row.id = v_old_id
    )
    else false
  end;
end
$$;

revoke all
  on function private.is_document_parent_fk_set_null(jsonb, jsonb)
  from public, anon, authenticated, service_role;

comment on function private.is_document_parent_fk_set_null(jsonb, jsonb) is
  'Validates nested document assignment redaction caused by a deleted property, unit, or lease.';

create or replace function private.enforce_document_assignment_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'UPDATE'
     and private.is_document_parent_fk_set_null(
       pg_catalog.to_jsonb(old),
       pg_catalog.to_jsonb(new)
     ) then
    if old.lease_id is not null
       and new.lease_id is null
       and new.tenant_visible then
      new.tenant_visible := false;
    end if;
    return new;
  end if;

  if new.unit_id is not null and new.property_id is null then
    raise check_violation
      using message = 'A document unit assignment requires a property';
  end if;

  if new.unit_id is not null
     and not exists (
       select 1
       from public.units as u
       where u.id = new.unit_id
         and u.organization_id = new.organization_id
         and u.property_id = new.property_id
     ) then
    raise check_violation
      using message = 'The selected unit does not belong to the selected property';
  end if;

  if new.lease_id is not null and new.unit_id is null then
    raise check_violation
      using message = 'A document lease assignment requires a unit';
  end if;

  if new.lease_id is not null
     and not exists (
       select 1
       from public.leases as l
       where l.id = new.lease_id
         and l.organization_id = new.organization_id
         and l.unit_id = new.unit_id
     ) then
    raise check_violation
      using message = 'The selected lease does not belong to the selected unit';
  end if;

  if new.tenant_visible and new.lease_id is null then
    raise check_violation
      using message = 'Tenant-visible documents require a lease assignment';
  end if;

  return new;
end
$$;

revoke all
  on function private.enforce_document_assignment_scope()
  from public, anon, authenticated, service_role;

commit;
