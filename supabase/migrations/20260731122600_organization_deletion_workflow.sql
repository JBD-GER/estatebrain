-- Keep organization deletion outside the browser-facing Data API.
--
-- The UI prepares a deletion review; it does not perform a hard delete.
-- Requests and their operational review tasks are created/cancelled together
-- by owner-only RPCs. A later privileged worker must separately handle
-- retention checks, exports, Storage cleanup, and re-authentication before a
-- physical organization deletion can be considered.

begin;

drop policy if exists organizations_delete_owner
  on public.organizations;

revoke delete
  on table public.organizations
  from anon, authenticated;

create table public.organization_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null
    references public.organizations(id) on delete cascade,
  status text not null default 'requested',
  requested_by uuid
    references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  cancelled_by uuid
    references auth.users(id) on delete set null,
  cancelled_at timestamptz,
  created_by uuid
    references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_deletion_requests_status check (
    status in ('requested', 'cancelled')
  ),
  constraint organization_deletion_requests_state check (
    (
      status = 'requested'
      and cancelled_at is null
      and cancelled_by is null
    )
    or (
      status = 'cancelled'
      and cancelled_at is not null
    )
  )
);

comment on table public.organization_deletion_requests is
  'Owner-only preparation records. Rows do not authorize or execute a hard deletion.';

create unique index organization_deletion_requests_active_org_idx
  on public.organization_deletion_requests (organization_id)
  where status = 'requested';

create index organization_deletion_requests_org_time_idx
  on public.organization_deletion_requests (
    organization_id,
    requested_at desc
  );

create index organization_deletion_requests_requested_by_idx
  on public.organization_deletion_requests (requested_by);

create index organization_deletion_requests_cancelled_by_idx
  on public.organization_deletion_requests (cancelled_by);

create index organization_deletion_requests_created_by_idx
  on public.organization_deletion_requests (created_by);

create unique index tasks_organization_deletion_request_idx
  on public.tasks (organization_id, category)
  where category like 'privacy_organization_deletion:%';

alter table public.organization_deletion_requests
  enable row level security;

create policy organization_deletion_requests_select_owner
  on public.organization_deletion_requests
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.organizations as organization_row
      where organization_row.id = organization_id
        and organization_row.owner_user_id = (select auth.uid())
    )
  );

revoke all
  on table public.organization_deletion_requests
  from public, anon, authenticated;

grant select
  on table public.organization_deletion_requests
  to authenticated;

grant select, insert, update, delete
  on table public.organization_deletion_requests
  to service_role;

create trigger organization_deletion_requests_updated_at
  before update on public.organization_deletion_requests
  for each row execute function private.set_updated_at();

create trigger enforce_organization_scope
  before insert or update
  on public.organization_deletion_requests
  for each row execute function private.enforce_organization_scope();

create trigger organization_deletion_requests_created_by
  before insert or update of created_by
  on public.organization_deletion_requests
  for each row execute function private.enforce_created_by();

create trigger organization_deletion_requests_requester
  before insert or update of requested_by
  on public.organization_deletion_requests
  for each row execute function private.enforce_required_attribution(
    'requested_by'
  );

create trigger organization_deletion_requests_cancellation_actor
  before insert or update of status, cancelled_by, cancelled_at
  on public.organization_deletion_requests
  for each row execute function private.enforce_action_actor(
    'cancelled_by', 'status', 'cancelled', 'cancelled_at'
  );

create trigger organization_deletion_requests_audit
  after insert or update or delete
  on public.organization_deletion_requests
  for each row execute function private.capture_audit_log();

create or replace function public.request_organization_deletion(
  p_organization_id uuid,
  p_organization_name text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_organization public.organizations%rowtype;
  v_request_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select organization_row.*
    into v_organization
    from public.organizations as organization_row
   where organization_row.id = p_organization_id
   for update;

  if not found
     or v_organization.owner_user_id <> v_user_id
     or p_organization_name is distinct from v_organization.name then
    raise exception 'Organization deletion request is not permitted'
      using errcode = '42501';
  end if;

  select request_row.id
    into v_request_id
    from public.organization_deletion_requests as request_row
   where request_row.organization_id = p_organization_id
     and request_row.status = 'requested'
   limit 1;

  if v_request_id is not null then
    return v_request_id;
  end if;

  insert into public.organization_deletion_requests (
    organization_id,
    status,
    requested_by,
    created_by
  )
  values (
    p_organization_id,
    'requested',
    v_user_id,
    v_user_id
  )
  returning id into v_request_id;

  insert into public.tasks (
    organization_id,
    title,
    description,
    category,
    priority,
    status,
    created_by
  )
  values (
    p_organization_id,
    'Organisationslöschung prüfen',
    'Die Eigentümerin oder der Eigentümer hat eine Löschprüfung angefordert. '
      || 'Diese Aufgabe löscht keine Daten. Vor Abschluss sind Organisationsdaten '
      || 'zu exportieren sowie Aufbewahrungspflichten, aktive Verträge, '
      || 'Zugriffsübergaben und Storage-Objekte zu prüfen.',
    'privacy_organization_deletion:' || v_request_id::text,
    'urgent',
    'open',
    v_user_id
  );

  return v_request_id;
end
$$;

revoke all
  on function public.request_organization_deletion(uuid, text)
  from public, anon, authenticated, service_role;

grant execute
  on function public.request_organization_deletion(uuid, text)
  to authenticated;

comment on function public.request_organization_deletion(uuid, text) is
  'Atomically creates one owner-authorized organization deletion review request and its task.';

create or replace function public.cancel_organization_deletion(
  p_organization_id uuid,
  p_request_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_owner_user_id uuid;
  v_request public.organization_deletion_requests%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select organization_row.owner_user_id
    into v_owner_user_id
    from public.organizations as organization_row
   where organization_row.id = p_organization_id
   for update;

  if not found or v_owner_user_id <> v_user_id then
    raise exception 'Organization deletion request is not permitted'
      using errcode = '42501';
  end if;

  select request_row.*
    into v_request
    from public.organization_deletion_requests as request_row
   where request_row.id = p_request_id
     and request_row.organization_id = p_organization_id
   for update;

  if not found then
    raise exception 'Organization deletion request is not permitted'
      using errcode = '42501';
  end if;

  if v_request.status = 'cancelled'
     and exists (
       select 1
       from public.organization_deletion_requests as active_request
       where active_request.organization_id = v_request.organization_id
         and active_request.status = 'requested'
         and active_request.id <> v_request.id
     ) then
    return false;
  end if;

  if v_request.status = 'requested' then
    update public.organization_deletion_requests
       set status = 'cancelled',
           cancelled_by = v_user_id,
           cancelled_at = now()
     where id = v_request.id;
  end if;

  update public.tasks
     set status = 'cancelled'
   where organization_id = v_request.organization_id
     and category =
       'privacy_organization_deletion:' || v_request.id::text
     and status in ('open', 'in_progress', 'blocked');

  return true;
end
$$;

revoke all
  on function public.cancel_organization_deletion(uuid, uuid)
  from public, anon, authenticated, service_role;

grant execute
  on function public.cancel_organization_deletion(uuid, uuid)
  to authenticated;

comment on function public.cancel_organization_deletion(uuid, uuid) is
  'Atomically cancels an owner-authorized deletion review request and its active task.';

-- A declared SET NULL may be nested below more than one cascading parent
-- deletion. Direct client updates still execute at depth one and remain
-- forbidden; catalog, payload, and missing-parent checks continue to apply.
create or replace function private.is_exact_fk_set_null(
  p_table oid,
  p_old jsonb,
  p_new jsonb,
  p_allowed_columns text[] default null
)
returns boolean
language plpgsql
volatile
security definer
set search_path = pg_catalog
as $$
declare
  v_candidate_columns text[];
  v_changed_column text;
  v_changed_count integer;
  v_old_value text;
  v_fk record;
  v_parent_is_absent boolean;
begin
  if pg_catalog.pg_trigger_depth() <= 1 then
    return false;
  end if;

  select pg_catalog.array_agg(
      child_attribute.attname
      order by child_attribute.attname
    )
    into v_candidate_columns
    from pg_catalog.pg_constraint as fk
    join pg_catalog.pg_attribute as child_attribute
      on child_attribute.attrelid = fk.conrelid
     and child_attribute.attnum = fk.conkey[1]
     and not child_attribute.attisdropped
   where fk.contype = 'f'
     and fk.conrelid = p_table
     and fk.confdeltype = 'n'
     and pg_catalog.array_length(fk.conkey, 1) = 1
     and pg_catalog.array_length(fk.confkey, 1) = 1
     and (
       p_allowed_columns is null
       or child_attribute.attname = any(p_allowed_columns)
     );

  if v_candidate_columns is null then
    return false;
  end if;

  select count(*), min(column_name)
    into v_changed_count, v_changed_column
    from pg_catalog.unnest(v_candidate_columns) as column_name
   where (p_new -> column_name) is distinct from
         (p_old -> column_name);

  if v_changed_count <> 1
     or (p_new - v_candidate_columns)
        is distinct from
        (p_old - v_candidate_columns)
     or (p_old ->> v_changed_column) is null
     or (p_new ->> v_changed_column) is not null then
    return false;
  end if;

  select
      parent_namespace.nspname as parent_schema,
      parent_table.relname as parent_table,
      parent_attribute.attname as parent_column,
      pg_catalog.format_type(
        parent_attribute.atttypid,
        parent_attribute.atttypmod
      ) as parent_type
    into v_fk
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
     and fk.conrelid = p_table
     and fk.confdeltype = 'n'
     and pg_catalog.array_length(fk.conkey, 1) = 1
     and pg_catalog.array_length(fk.confkey, 1) = 1
     and child_attribute.attname = v_changed_column
   limit 1;

  if not found then
    return false;
  end if;

  v_old_value := p_old ->> v_changed_column;

  execute pg_catalog.format(
    'select not exists (
       select 1
       from %I.%I as parent_row
       where parent_row.%I = $1::%s
     )',
    v_fk.parent_schema,
    v_fk.parent_table,
    v_fk.parent_column,
    v_fk.parent_type
  )
    into v_parent_is_absent
    using v_old_value;

  return coalesce(v_parent_is_absent, false);
end
$$;

revoke all
  on function private.is_exact_fk_set_null(oid, jsonb, jsonb, text[])
  from public, anon, authenticated, service_role;

comment on function private.is_exact_fk_set_null(oid, jsonb, jsonb, text[]) is
  'Validates one declared nested FK SET NULL action, with unchanged payload and an already deleted parent.';

commit;
