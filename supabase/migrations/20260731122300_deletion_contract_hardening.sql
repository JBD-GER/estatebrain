-- Align identity minimization with the schema's declared FK actions.
--
-- created_by attribution and immutable tax snapshots remain protected from
-- direct mutation. PostgreSQL may only redact a deleted auth user through an
-- immediate ON DELETE SET NULL action, and snapshots may only disappear via
-- their declared parent cascades.

begin;

create or replace function private.is_deleted_auth_fk_set_null(
  p_old jsonb,
  p_new jsonb,
  p_columns text[]
)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  v_changed_column text;
  v_changed_count integer;
  v_deleted_user_id uuid;
begin
  if pg_catalog.pg_trigger_depth() <> 2
     or p_columns is null
     or pg_catalog.array_length(p_columns, 1) is null then
    return false;
  end if;

  select count(*), min(column_name)
    into v_changed_count, v_changed_column
    from pg_catalog.unnest(p_columns) as column_name
   where (p_new -> column_name) is distinct from
         (p_old -> column_name);

  if v_changed_count <> 1
     or (p_new - p_columns) is distinct from (p_old - p_columns)
     or (p_old ->> v_changed_column) is null
     or (p_new ->> v_changed_column) is not null then
    return false;
  end if;

  v_deleted_user_id :=
    (p_old ->> v_changed_column)::uuid;

  return not exists (
    select 1
    from auth.users as user_row
    where user_row.id = v_deleted_user_id
  );
end
$$;

revoke all
  on function private.is_deleted_auth_fk_set_null(jsonb, jsonb, text[])
  from public, anon, authenticated, service_role;

comment on function private.is_deleted_auth_fk_set_null(jsonb, jsonb, text[]) is
  'True only for one immediate auth.users FK action changing an approved user ID from non-NULL to NULL.';

create or replace function private.enforce_created_by()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    if v_user_id is not null and new.created_by is null then
      new.created_by := v_user_id;
    elsif v_user_id is not null and new.created_by <> v_user_id then
      raise exception 'created_by must match the authenticated user'
        using errcode = '42501';
    end if;
  elsif new.created_by is distinct from old.created_by
        and not private.is_deleted_auth_fk_set_null(
          pg_catalog.to_jsonb(old),
          pg_catalog.to_jsonb(new),
          array['created_by']
        ) then
    raise exception 'created_by is immutable' using errcode = '42501';
  end if;
  return new;
end
$$;

revoke all
  on function private.enforce_created_by()
  from public, anon, authenticated, service_role;

create or replace function private.is_snapshot_parent_cascade_delete(
  p_old jsonb
)
returns boolean
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  select pg_catalog.pg_trigger_depth() > 1
    and (
      (
        (p_old ->> 'organization_id') is not null
        and not exists (
          select 1
          from public.organizations as organization_row
          where organization_row.id =
            (p_old ->> 'organization_id')::uuid
        )
      )
      or (
        (p_old ->> 'tax_year_id') is not null
        and not exists (
          select 1
          from public.tax_years as tax_year_row
          where tax_year_row.id = (p_old ->> 'tax_year_id')::uuid
        )
      )
      or (
        (p_old ->> 'property_id') is not null
        and not exists (
          select 1
          from public.properties as property_row
          where property_row.id = (p_old ->> 'property_id')::uuid
        )
      )
    )
$$;

revoke all
  on function private.is_snapshot_parent_cascade_delete(jsonb)
  from public, anon, authenticated, service_role;

comment on function private.is_snapshot_parent_cascade_delete(jsonb) is
  'True only while an immutable tax snapshot is being deleted by a declared parent cascade.';

create or replace function private.prevent_snapshot_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'UPDATE'
     and private.is_deleted_auth_fk_set_null(
       pg_catalog.to_jsonb(old),
       pg_catalog.to_jsonb(new),
       array['created_by', 'calculated_for_user_id']
     ) then
    return new;
  end if;

  if tg_op = 'DELETE'
     and private.is_snapshot_parent_cascade_delete(
       pg_catalog.to_jsonb(old)
     ) then
    return old;
  end if;

  raise exception 'tax calculation snapshots are immutable'
    using errcode = '55000';
end
$$;

revoke all
  on function private.prevent_snapshot_mutation()
  from public, anon, authenticated, service_role;

commit;
