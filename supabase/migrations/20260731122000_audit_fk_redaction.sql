-- Preserve the append-only audit trail while allowing PostgreSQL's declared
-- ON DELETE SET NULL foreign keys to redact deleted organization/user IDs.
--
-- Direct UPDATE and DELETE statements remain rejected. The only accepted
-- UPDATE is a nested referential-action trigger that changes organization_id
-- and/or actor_user_id from a value to NULL without touching audit evidence.

begin;

create or replace function private.prevent_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if tg_op = 'UPDATE'
     and pg_catalog.pg_trigger_depth() > 1
     and (
       new.organization_id is not distinct from old.organization_id
       or (old.organization_id is not null and new.organization_id is null)
     )
     and (
       new.actor_user_id is not distinct from old.actor_user_id
       or (old.actor_user_id is not null and new.actor_user_id is null)
     )
     and (
       pg_catalog.to_jsonb(new)
         - array['organization_id', 'actor_user_id']
     ) is not distinct from (
       pg_catalog.to_jsonb(old)
         - array['organization_id', 'actor_user_id']
     ) then
    return new;
  end if;

  raise exception 'audit_logs is append-only' using errcode = '55000';
end
$$;

revoke all
  on function private.prevent_audit_mutation()
  from public, anon, authenticated;

grant execute
  on function private.prevent_audit_mutation()
  to service_role;

comment on function private.prevent_audit_mutation() is
  'Rejects audit mutations except nested FK redaction of deleted organization/user identifiers.';

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
       (v_old_row -> 'organization_id') then
      if tg_table_schema = 'public'
         and tg_table_name = 'audit_logs'
         and pg_catalog.pg_trigger_depth() > 1
         and old.organization_id is not null
         and new.organization_id is null
         and (
           pg_catalog.to_jsonb(new)
             - array['organization_id', 'actor_user_id']
         ) is not distinct from (
           pg_catalog.to_jsonb(old)
             - array['organization_id', 'actor_user_id']
         )
         and (
           new.actor_user_id is not distinct from old.actor_user_id
           or (old.actor_user_id is not null and new.actor_user_id is null)
         ) then
        return new;
      end if;

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
  'Trigger-only invariant: organization_id is immutable, except FK redaction on audit logs, and all public org-scoped foreign keys stay within the row organization.';

commit;
