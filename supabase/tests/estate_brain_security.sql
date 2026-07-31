-- Run after applying the Estate Brain initial schema.
-- The transaction is read-only from the application's perspective and always rolls back.

begin;

do $estate_brain_security_test$
declare
  v_count integer;
begin
  select count(*)
    into v_count
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind in ('r', 'p');

  if v_count <> 49 then
    raise exception 'Expected 49 Estate Brain public tables, found %', v_count;
  end if;

  select count(*)
    into v_count
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind in ('r', 'p')
     and not c.relrowsecurity;

  if v_count <> 0 then
    raise exception '% public tables are missing RLS', v_count;
  end if;

  select count(*)
    into v_count
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind in ('r', 'p')
     and not exists (
       select 1
       from pg_catalog.pg_policy as p
       where p.polrelid = c.oid
     );

  if v_count <> 0 then
    raise exception '% public tables are missing policies', v_count;
  end if;

  select count(*)
    into v_count
    from pg_catalog.pg_policies
   where schemaname = 'public'
     and cmd = 'UPDATE'
     and with_check is null;

  if v_count <> 0 then
    raise exception '% UPDATE policies are missing WITH CHECK', v_count;
  end if;

  select count(*)
    into v_count
    from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
   where p.prosecdef
     and n.nspname in ('public', 'private')
     and not coalesce(p.proconfig, '{}'::text[]) @> array['search_path=pg_catalog'];

  if v_count <> 0 then
    raise exception '% SECURITY DEFINER functions lack a fixed search_path', v_count;
  end if;

  select count(*)
    into v_count
    from storage.buckets
   where id in ('documents', 'property-images', 'message-attachments')
     and public = false;

  if v_count <> 3 then
    raise exception 'Expected three private Estate Brain Storage buckets';
  end if;

  select count(*)
    into v_count
    from pg_catalog.pg_policies
   where schemaname = 'storage'
     and tablename = 'objects'
     and policyname like 'estate_brain_%';

  if v_count <> 12 then
    raise exception 'Expected 12 Estate Brain Storage policies, found %', v_count;
  end if;

  if has_table_privilege('anon', 'public.properties', 'SELECT') then
    raise exception 'anon unexpectedly has access to public.properties';
  end if;

  if has_table_privilege('authenticated', 'public.audit_logs', 'UPDATE')
     or has_table_privilege('authenticated', 'public.audit_logs', 'DELETE') then
    raise exception 'authenticated unexpectedly has audit log mutation privileges';
  end if;

  if has_function_privilege('anon', 'public.accept_invitation(text)', 'EXECUTE')
     or not has_function_privilege(
       'authenticated',
       'public.accept_invitation(text)',
       'EXECUTE'
     ) then
    raise exception 'Unexpected accept_invitation RPC privileges';
  end if;

  if has_function_privilege(
       'anon',
       'public.complete_onboarding(jsonb)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.complete_onboarding(jsonb)',
       'EXECUTE'
     )
     or has_function_privilege(
       'anon',
       'public.get_tenant_portal_context(uuid)',
       'EXECUTE'
     )
     or not has_function_privilege(
       'authenticated',
       'public.get_tenant_portal_context(uuid)',
       'EXECUTE'
     ) then
    raise exception 'Unexpected onboarding or tenant portal RPC privileges';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and (
        (table_name = 'tenants' and column_name = 'notes')
        or (
          table_name = 'maintenance_requests'
          and column_name = 'internal_notes'
        )
      )
  ) then
    raise exception 'Internal notes remain on tenant-readable rows';
  end if;

  select count(*)
    into v_count
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relname in (
       'tenant_internal_notes',
       'maintenance_request_internal_notes'
     )
     and c.relrowsecurity
     and c.relforcerowsecurity;

  if v_count <> 2 then
    raise exception 'Staff-only note tables are not forced through RLS';
  end if;

  select count(*)
    into v_count
    from storage.buckets
   where id = 'documents'
     and file_size_limit = 10485760;

  if v_count <> 1 then
    raise exception 'Document Storage limit is not 10 MiB';
  end if;

  if position(
       'email_confirmed_at is not null'
       in lower(
         pg_get_functiondef(
           'public.accept_invitation(text)'::regprocedure
         )
       )
     ) = 0 then
    raise exception 'Invitation acceptance does not require confirmed email';
  end if;

  select count(*)
    into v_count
    from pg_catalog.pg_trigger as t
    join pg_catalog.pg_class as c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
   where not t.tgisinternal
     and n.nspname = 'public'
     and c.relname = 'audit_logs'
     and t.tgname = 'audit_logs_append_only';

  if v_count <> 1 then
    raise exception 'Append-only audit trigger is missing';
  end if;

  select count(*)
    into v_count
    from pg_catalog.pg_trigger as t
    join pg_catalog.pg_class as c on c.oid = t.tgrelid
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
   where not t.tgisinternal
     and n.nspname = 'public'
     and t.tgname like '%_audit';

  if v_count < 14 then
    raise exception 'Critical audit triggers are incomplete: %', v_count;
  end if;

  select count(*)
    into v_count
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
   where n.nspname = 'public'
     and c.relkind in ('r', 'p')
     and exists (
       select 1
       from pg_catalog.pg_attribute as a
       where a.attrelid = c.oid
         and a.attname = 'organization_id'
         and not a.attisdropped
     )
     and not exists (
       select 1
       from pg_catalog.pg_trigger as t
       join pg_catalog.pg_proc as p on p.oid = t.tgfoid
       join pg_catalog.pg_namespace as pn on pn.oid = p.pronamespace
       where t.tgrelid = c.oid
         and not t.tgisinternal
         and t.tgname = 'enforce_organization_scope'
         and pn.nspname = 'private'
         and p.proname = 'enforce_organization_scope'
     );

  if v_count <> 0 then
    raise exception
      '% organization-scoped public tables lack the scope invariant trigger',
      v_count;
  end if;

  select count(*)
    into v_count
    from pg_catalog.pg_constraint as fk
    join pg_catalog.pg_class as child_table
      on child_table.oid = fk.conrelid
    join pg_catalog.pg_namespace as child_namespace
      on child_namespace.oid = child_table.relnamespace
    join pg_catalog.pg_class as parent_table
      on parent_table.oid = fk.confrelid
    join pg_catalog.pg_namespace as parent_namespace
      on parent_namespace.oid = parent_table.relnamespace
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
     );

  if v_count <> 0 then
    raise exception
      '% organization-scoped composite FKs need explicit trigger support',
      v_count;
  end if;

  if has_function_privilege(
       'anon',
       'private.enforce_organization_scope()',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'private.enforce_organization_scope()',
       'EXECUTE'
     )
     or not has_function_privilege(
       'service_role',
       'private.enforce_organization_scope()',
       'EXECUTE'
     ) then
    raise exception 'Unexpected organization-scope trigger privileges';
  end if;

  if exists (
    select 1
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and tablename = 'organization_members'
      and policyname = 'organization_members_update_management'
      and position(
        'organization_id = organization_id'
        in lower(coalesce(with_check, ''))
      ) > 0
  ) then
    raise exception 'Organization member UPDATE policy remains tautological';
  end if;
end
$estate_brain_security_test$;

rollback;
