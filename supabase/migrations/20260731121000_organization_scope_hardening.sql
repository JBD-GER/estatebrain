-- Estate Brain organization-scope hardening
--
-- Every business row carries an organization_id, but the original foreign
-- keys only constrained the referenced UUID. This migration turns the
-- duplicated organization_id into a structural invariant for every current
-- organization-scoped table:
--   * a row can never move to another organization after INSERT;
--   * every FK to another organization-scoped public table must resolve to a
--     row in the same organization.
--
-- The trigger discovers the table's declared foreign keys from pg_catalog.
-- This keeps one small, audited implementation authoritative for the complete
-- schema instead of duplicating dozens of near-identical trigger functions.

begin;

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

    -- NULL is already governed by the declared FK's MATCH semantics.
    if v_child_value is null then
      continue;
    end if;

    -- Existing rows were validated below. An UPDATE that changes neither the
    -- organization nor this FK cannot create a new scope violation.
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
  'Trigger-only invariant: organization_id is immutable and all public org-scoped foreign keys stay within the row organization.';

-- Hold writes across validation and trigger installation so no transaction can
-- create a mismatch in the gap between those two steps. A deterministic lock
-- order avoids migration-to-migration deadlocks.
do $organization_scope_write_locks$
declare
  v_table record;
begin
  for v_table in
    select
      namespace.nspname as table_schema,
      relation.relname as table_name
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and exists (
        select 1
        from pg_catalog.pg_attribute as scope_attribute
        where scope_attribute.attrelid = relation.oid
          and scope_attribute.attname = 'organization_id'
          and not scope_attribute.attisdropped
      )
    order by relation.relname
  loop
    execute pg_catalog.format(
      'lock table %I.%I in share row exclusive mode',
      v_table.table_schema,
      v_table.table_name
    );
  end loop;
end
$organization_scope_write_locks$;

-- Abort before enabling the invariant if historical data already violates it.
-- All current organization-scoped relationships use one-column FKs.
do $organization_scope_data_validation$
declare
  v_fk record;
  v_has_mismatch boolean;
begin
  if exists (
    select 1
    from pg_catalog.pg_constraint as fk
    join pg_catalog.pg_namespace as child_namespace
      on child_namespace.oid =
         (select c.relnamespace
            from pg_catalog.pg_class as c
           where c.oid = fk.conrelid)
    join pg_catalog.pg_namespace as parent_namespace
      on parent_namespace.oid =
         (select c.relnamespace
            from pg_catalog.pg_class as c
           where c.oid = fk.confrelid)
    where fk.contype = 'f'
      and child_namespace.nspname = 'public'
      and parent_namespace.nspname = 'public'
      and exists (
        select 1
        from pg_catalog.pg_attribute as child_scope_attribute
        where child_scope_attribute.attrelid = fk.conrelid
          and child_scope_attribute.attname = 'organization_id'
          and not child_scope_attribute.attisdropped
      )
      and exists (
        select 1
        from pg_catalog.pg_attribute as parent_scope_attribute
        where parent_scope_attribute.attrelid = fk.confrelid
          and parent_scope_attribute.attname = 'organization_id'
          and not parent_scope_attribute.attisdropped
      )
      and (
        pg_catalog.array_length(fk.conkey, 1) <> 1
        or pg_catalog.array_length(fk.confkey, 1) <> 1
      )
  ) then
    raise exception
      'Organization-scope enforcement requires an explicit implementation for composite foreign keys'
      using errcode = '0A000';
  end if;

  for v_fk in
    select
      fk.conname as constraint_name,
      child_namespace.nspname as child_schema,
      child_table.relname as child_table,
      child_attribute.attname as child_column,
      parent_namespace.nspname as parent_schema,
      parent_table.relname as parent_table,
      parent_attribute.attname as parent_column
    from pg_catalog.pg_constraint as fk
    join pg_catalog.pg_class as child_table
      on child_table.oid = fk.conrelid
    join pg_catalog.pg_namespace as child_namespace
      on child_namespace.oid = child_table.relnamespace
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
      and pg_catalog.array_length(fk.conkey, 1) = 1
      and pg_catalog.array_length(fk.confkey, 1) = 1
      and child_namespace.nspname = 'public'
      and parent_namespace.nspname = 'public'
      and exists (
        select 1
        from pg_catalog.pg_attribute as child_scope_attribute
        where child_scope_attribute.attrelid = fk.conrelid
          and child_scope_attribute.attname = 'organization_id'
          and not child_scope_attribute.attisdropped
      )
      and exists (
        select 1
        from pg_catalog.pg_attribute as parent_scope_attribute
        where parent_scope_attribute.attrelid = fk.confrelid
          and parent_scope_attribute.attname = 'organization_id'
          and not parent_scope_attribute.attisdropped
      )
  loop
    execute pg_catalog.format(
      'select exists (
         select 1
         from %I.%I as child_row
         join %I.%I as parent_row
           on parent_row.%I = child_row.%I
         where parent_row.organization_id
               is distinct from child_row.organization_id
       )',
      v_fk.child_schema,
      v_fk.child_table,
      v_fk.parent_schema,
      v_fk.parent_table,
      v_fk.parent_column,
      v_fk.child_column
    )
      into v_has_mismatch;

    if v_has_mismatch then
      raise exception
        using
          errcode = '23503',
          message = pg_catalog.format(
            'Existing cross-organization rows violate %I on %I.%I',
            v_fk.constraint_name,
            v_fk.child_schema,
            v_fk.child_table
          ),
          constraint = v_fk.constraint_name;
    end if;
  end loop;
end
$organization_scope_data_validation$;

-- Install the invariant on every current public table carrying organization_id.
-- Re-running the migration is safe: each trigger is replaced deterministically.
do $organization_scope_triggers$
declare
  v_table record;
begin
  for v_table in
    select
      namespace.nspname as table_schema,
      relation.relname as table_name
    from pg_catalog.pg_class as relation
    join pg_catalog.pg_namespace as namespace
      on namespace.oid = relation.relnamespace
    where namespace.nspname = 'public'
      and relation.relkind in ('r', 'p')
      and exists (
        select 1
        from pg_catalog.pg_attribute as scope_attribute
        where scope_attribute.attrelid = relation.oid
          and scope_attribute.attname = 'organization_id'
          and not scope_attribute.attisdropped
      )
    order by relation.relname
  loop
    execute pg_catalog.format(
      'drop trigger if exists enforce_organization_scope on %I.%I',
      v_table.table_schema,
      v_table.table_name
    );

    execute pg_catalog.format(
      'create trigger enforce_organization_scope
         before insert or update on %I.%I
         for each row
         execute function private.enforce_organization_scope()',
      v_table.table_schema,
      v_table.table_name
    );
  end loop;
end
$organization_scope_triggers$;

-- Replace the tautological UPDATE check. The immutable organization trigger
-- above carries the OLD-vs-NEW invariant that a policy expression cannot
-- express, while USING and WITH CHECK authorize both row versions.
drop policy if exists organization_members_update_management
  on public.organization_members;

create policy organization_members_update_management
  on public.organization_members for update to authenticated
  using (
    private.can_manage_members(
      organization_members.organization_id,
      organization_members.role
    )
  )
  with check (
    private.can_manage_members(
      organization_members.organization_id,
      organization_members.role
    )
  );

-- Rebuild staff-note policies with explicit outer-row qualification.
-- Unqualified organization_id inside a correlated subquery binds to the inner
-- tenant/request table and collapses the intended equality into a tautology.
drop policy if exists tenant_internal_notes_select_staff
  on public.tenant_internal_notes;
drop policy if exists tenant_internal_notes_insert_staff
  on public.tenant_internal_notes;
drop policy if exists tenant_internal_notes_update_staff
  on public.tenant_internal_notes;
drop policy if exists tenant_internal_notes_delete_staff
  on public.tenant_internal_notes;

create policy tenant_internal_notes_select_staff
  on public.tenant_internal_notes for select to authenticated
  using (
    private.can_manage_leases(tenant_internal_notes.organization_id)
    and exists (
      select 1
      from public.tenants as tenant_row
      where tenant_row.id = tenant_internal_notes.tenant_id
        and tenant_row.organization_id =
            tenant_internal_notes.organization_id
    )
  );

create policy tenant_internal_notes_insert_staff
  on public.tenant_internal_notes for insert to authenticated
  with check (
    private.can_manage_leases(tenant_internal_notes.organization_id)
    and tenant_internal_notes.created_by = (select auth.uid())
    and exists (
      select 1
      from public.tenants as tenant_row
      where tenant_row.id = tenant_internal_notes.tenant_id
        and tenant_row.organization_id =
            tenant_internal_notes.organization_id
    )
  );

create policy tenant_internal_notes_update_staff
  on public.tenant_internal_notes for update to authenticated
  using (
    private.can_manage_leases(tenant_internal_notes.organization_id)
    and exists (
      select 1
      from public.tenants as tenant_row
      where tenant_row.id = tenant_internal_notes.tenant_id
        and tenant_row.organization_id =
            tenant_internal_notes.organization_id
    )
  )
  with check (
    private.can_manage_leases(tenant_internal_notes.organization_id)
    and exists (
      select 1
      from public.tenants as tenant_row
      where tenant_row.id = tenant_internal_notes.tenant_id
        and tenant_row.organization_id =
            tenant_internal_notes.organization_id
    )
  );

create policy tenant_internal_notes_delete_staff
  on public.tenant_internal_notes for delete to authenticated
  using (
    private.can_manage_leases(tenant_internal_notes.organization_id)
    and exists (
      select 1
      from public.tenants as tenant_row
      where tenant_row.id = tenant_internal_notes.tenant_id
        and tenant_row.organization_id =
            tenant_internal_notes.organization_id
    )
  );

drop policy if exists maintenance_internal_notes_select_staff
  on public.maintenance_request_internal_notes;
drop policy if exists maintenance_internal_notes_insert_staff
  on public.maintenance_request_internal_notes;
drop policy if exists maintenance_internal_notes_update_staff
  on public.maintenance_request_internal_notes;
drop policy if exists maintenance_internal_notes_delete_staff
  on public.maintenance_request_internal_notes;

create policy maintenance_internal_notes_select_staff
  on public.maintenance_request_internal_notes for select to authenticated
  using (
    exists (
      select 1
      from public.maintenance_requests as request_row
      where request_row.id =
            maintenance_request_internal_notes.maintenance_request_id
        and request_row.organization_id =
            maintenance_request_internal_notes.organization_id
        and private.can_operate_property(
          maintenance_request_internal_notes.organization_id,
          request_row.property_id
        )
    )
  );

create policy maintenance_internal_notes_insert_staff
  on public.maintenance_request_internal_notes for insert to authenticated
  with check (
    maintenance_request_internal_notes.created_by = (select auth.uid())
    and exists (
      select 1
      from public.maintenance_requests as request_row
      where request_row.id =
            maintenance_request_internal_notes.maintenance_request_id
        and request_row.organization_id =
            maintenance_request_internal_notes.organization_id
        and private.can_operate_property(
          maintenance_request_internal_notes.organization_id,
          request_row.property_id
        )
    )
  );

create policy maintenance_internal_notes_update_staff
  on public.maintenance_request_internal_notes for update to authenticated
  using (
    exists (
      select 1
      from public.maintenance_requests as request_row
      where request_row.id =
            maintenance_request_internal_notes.maintenance_request_id
        and request_row.organization_id =
            maintenance_request_internal_notes.organization_id
        and private.can_operate_property(
          maintenance_request_internal_notes.organization_id,
          request_row.property_id
        )
    )
  )
  with check (
    exists (
      select 1
      from public.maintenance_requests as request_row
      where request_row.id =
            maintenance_request_internal_notes.maintenance_request_id
        and request_row.organization_id =
            maintenance_request_internal_notes.organization_id
        and private.can_operate_property(
          maintenance_request_internal_notes.organization_id,
          request_row.property_id
        )
    )
  );

create policy maintenance_internal_notes_delete_staff
  on public.maintenance_request_internal_notes for delete to authenticated
  using (
    exists (
      select 1
      from public.maintenance_requests as request_row
      where request_row.id =
            maintenance_request_internal_notes.maintenance_request_id
        and request_row.organization_id =
            maintenance_request_internal_notes.organization_id
        and private.can_operate_property(
          maintenance_request_internal_notes.organization_id,
          request_row.property_id
        )
    )
  );

commit;
