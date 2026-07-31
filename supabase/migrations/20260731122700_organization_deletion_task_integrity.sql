-- Reserve deletion-review tasks for the owner-only workflow and make the
-- request RPC self-healing if trusted maintenance removed a correlated task.

begin;

drop policy if exists tasks_insert on public.tasks;
create policy tasks_insert
  on public.tasks for insert to authenticated
  with check (
    category not like 'privacy_organization_deletion:%'
    and (
      private.has_org_role(
        organization_id,
        array['owner', 'admin', 'property_manager']::public.app_role[]
      )
      or (
        private.current_member_role(organization_id) = 'employee'
        and property_id is not null
        and private.can_operate_property(organization_id, property_id)
      )
    )
  );

drop policy if exists tasks_update on public.tasks;
create policy tasks_update
  on public.tasks for update to authenticated
  using (
    category not like 'privacy_organization_deletion:%'
    and private.can_access_task(organization_id, id)
  )
  with check (
    category not like 'privacy_organization_deletion:%'
    and (
      private.has_org_role(
        organization_id,
        array['owner', 'admin', 'property_manager']::public.app_role[]
      )
      or (
        private.current_member_role(organization_id) = 'employee'
        and property_id is not null
        and private.can_operate_property(organization_id, property_id)
      )
    )
  );

drop policy if exists tasks_delete_management on public.tasks;
create policy tasks_delete_management
  on public.tasks for delete to authenticated
  using (
    category not like 'privacy_organization_deletion:%'
    and private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
  );

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
  v_request_id uuid;
  v_task_exists boolean;
  v_task_category text;
  v_task_description constant text :=
    'Die Eigentümerin oder der Eigentümer hat eine Löschprüfung angefordert. '
    || 'Diese Aufgabe löscht keine Daten. Vor Abschluss sind Organisationsdaten '
    || 'zu exportieren sowie Aufbewahrungspflichten, aktive Verträge, '
    || 'Zugriffsübergaben und Storage-Objekte zu prüfen.';
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform 1
    from public.organizations as organization_row
   where organization_row.id = p_organization_id
     and organization_row.owner_user_id = v_user_id
     and organization_row.name = p_organization_name
   for update;

  if not found then
    raise exception 'Organization deletion request is not permitted'
      using errcode = '42501';
  end if;

  select request_row.id
    into v_request_id
    from public.organization_deletion_requests as request_row
   where request_row.organization_id = p_organization_id
     and request_row.status = 'requested'
   limit 1;

  if v_request_id is null then
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
  end if;

  v_task_category :=
    'privacy_organization_deletion:' || v_request_id::text;

  select exists (
    select 1
    from public.tasks as task_row
    where task_row.organization_id = p_organization_id
      and task_row.category = v_task_category
  )
  into v_task_exists;

  if v_task_exists then
    update public.tasks
       set title = 'Organisationslöschung prüfen',
           description = v_task_description,
           priority = 'urgent',
           status = 'open',
           completed_at = null,
           archived_at = null
     where organization_id = p_organization_id
       and category = v_task_category
       and (
         title is distinct from 'Organisationslöschung prüfen'
         or description is distinct from v_task_description
         or priority is distinct from 'urgent'
         or status is distinct from 'open'
         or completed_at is not null
         or archived_at is not null
       );
  else
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
      v_task_description,
      v_task_category,
      'urgent',
      'open',
      v_user_id
    );
  end if;

  return v_request_id;
end
$$;

revoke all
  on function public.request_organization_deletion(uuid, text)
  from public, anon, authenticated, service_role;

grant execute
  on function public.request_organization_deletion(uuid, text)
  to authenticated;

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
  v_request public.organization_deletion_requests%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  perform 1
    from public.organizations as organization_row
   where organization_row.id = p_organization_id
     and organization_row.owner_user_id = v_user_id
   for update;

  if not found then
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

commit;
