-- Tighten audit-log FK redaction to the exact shape emitted by PostgreSQL's
-- immediate ON DELETE SET NULL referential actions.

begin;

create or replace function private.is_audit_fk_set_null(
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
  v_org_changed boolean :=
    (p_new -> 'organization_id') is distinct from
    (p_old -> 'organization_id');
  v_actor_changed boolean :=
    (p_new -> 'actor_user_id') is distinct from
    (p_old -> 'actor_user_id');
begin
  if pg_catalog.pg_trigger_depth() <> 2 then
    return false;
  end if;

  if v_org_changed = v_actor_changed
     or (p_new - array['organization_id', 'actor_user_id'])
        is distinct from
        (p_old - array['organization_id', 'actor_user_id']) then
    return false;
  end if;

  if v_org_changed then
    return (p_old ->> 'organization_id') is not null
       and (p_new ->> 'organization_id') is null
       and not exists (
         select 1
         from public.organizations as organization_row
         where organization_row.id =
           (p_old ->> 'organization_id')::uuid
       );
  end if;

  return (p_old ->> 'actor_user_id') is not null
     and (p_new ->> 'actor_user_id') is null
     and not exists (
       select 1
       from auth.users as user_row
       where user_row.id = (p_old ->> 'actor_user_id')::uuid
     );
end
$$;

revoke all
  on function private.is_audit_fk_set_null(jsonb, jsonb)
  from public, anon, authenticated, service_role;

comment on function private.is_audit_fk_set_null(jsonb, jsonb) is
  'True only for an immediate RI trigger nulling one deleted audit-log FK without changing audit evidence.';

create or replace function private.prevent_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'UPDATE'
     and private.is_audit_fk_set_null(
       pg_catalog.to_jsonb(old),
       pg_catalog.to_jsonb(new)
     ) then
    return new;
  end if;

  raise exception 'audit_logs is append-only' using errcode = '55000';
end
$$;

revoke all
  on function private.prevent_audit_mutation()
  from public, anon, authenticated, service_role;

create or replace function private.enforce_organization_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_new_row jsonb := pg_catalog.to_jsonb(new);
  v_old_row jsonb;
  v_organization_id uuid;
  v_child_value text;
  v_fk record;
  v_reference_matches boolean;
begin
  v_organization_id :=
    nullif(v_new_row ->> 'organization_id', '')::uuid;

  if tg_op = 'UPDATE' then
    v_old_row := pg_catalog.to_jsonb(old);

    if (v_new_row -> 'organization_id')
       is distinct from
       (v_old_row -> 'organization_id')
       and not (
         tg_table_schema = 'public'
         and tg_table_name = 'audit_logs'
         and private.is_audit_fk_set_null(v_old_row, v_new_row)
       ) then
      raise exception
        using
          errcode = '23514',
          message = pg_catalog.format(
            'organization_id is immutable on %I.%I',
            tg_table_schema,
            tg_table_name
          ),
          constraint = 'organization_scope_immutable';
    end if;
  end if;

  for v_fk in
    select
      fk.conname as constraint_name,
      child_attribute.attname as child_column,
      parent_namespace.nspname as parent_schema,
      parent_table.relname as parent_table,
      parent_attribute.attname as parent_column,
      pg_catalog.format_type(
        parent_attribute.atttypid,
        parent_attribute.atttypmod
      ) as parent_type
    from pg_catalog.pg_constraint as fk
    join pg_catalog.pg_class as parent_table
      on parent_table.oid = fk.confrelid
    join pg_catalog.pg_namespace as parent_namespace
      on parent_namespace.oid = parent_table.relnamespace
    join pg_catalog.pg_attribute as child_attribute
      on child_attribute.attrelid = fk.conrelid
     and child_attribute.attnum = fk.conkey[1]
     and not child_attribute.attisdropped
    join pg_catalog.pg_attribute as parent_attribute
      on parent_attribute.attrelid = fk.confrelid
     and parent_attribute.attnum = fk.confkey[1]
     and not parent_attribute.attisdropped
    where fk.contype = 'f'
      and fk.conrelid = tg_relid
      and pg_catalog.array_length(fk.conkey, 1) = 1
      and pg_catalog.array_length(fk.confkey, 1) = 1
      and parent_namespace.nspname = 'public'
      and exists (
        select 1
        from pg_catalog.pg_attribute as parent_scope_attribute
        where parent_scope_attribute.attrelid = fk.confrelid
          and parent_scope_attribute.attname = 'organization_id'
          and not parent_scope_attribute.attisdropped
      )
  loop
    v_child_value := v_new_row ->> v_fk.child_column;

    if v_child_value is null then
      continue;
    end if;

    if tg_op = 'UPDATE'
       and v_child_value is not distinct from
           (v_old_row ->> v_fk.child_column) then
      continue;
    end if;

    if v_organization_id is null then
      raise exception
        using
          errcode = '23503',
          message = pg_catalog.format(
            'organization_id is required when %I.%I is set',
            tg_table_name,
            v_fk.child_column
          ),
          constraint = v_fk.constraint_name;
    end if;

    execute pg_catalog.format(
      'select exists (
         select 1
         from %I.%I as parent_row
         where parent_row.%I = $1::%s
           and parent_row.organization_id = $2
       )',
      v_fk.parent_schema,
      v_fk.parent_table,
      v_fk.parent_column,
      v_fk.parent_type
    )
      into v_reference_matches
      using v_child_value, v_organization_id;

    if not coalesce(v_reference_matches, false) then
      raise exception
        using
          errcode = '23503',
          message = pg_catalog.format(
            'cross-organization reference rejected: %I.%I -> %I.%I',
            tg_table_name,
            v_fk.child_column,
            v_fk.parent_table,
            v_fk.parent_column
          ),
          constraint = v_fk.constraint_name;
    end if;
  end loop;

  return new;
end
$$;

revoke all
  on function private.enforce_organization_scope()
  from public, anon, authenticated;

grant execute
  on function private.enforce_organization_scope()
  to service_role;

comment on function private.enforce_organization_scope() is
  'Trigger-only invariant: organization_id is immutable except for exact audit FK redaction, and all public org-scoped foreign keys stay within the row organization.';

commit;
