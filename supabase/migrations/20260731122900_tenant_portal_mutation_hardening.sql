-- Keep tenant-authored conversations and their first messages atomic. These
-- functions need SECURITY DEFINER because tenants may not create participant
-- rows directly; each function re-establishes the full tenant/lease scope.

create or replace function public.create_tenant_portal_conversation(
  p_organization_id uuid,
  p_lease_id uuid,
  p_subject text,
  p_category text,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_today date := (now() at time zone 'Europe/Berlin')::date;
  v_tenant_id uuid;
  v_unit_id uuid;
  v_property_id uuid;
  v_conversation_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_subject, ''))) not between 3 and 240
     or char_length(trim(coalesce(p_body, ''))) not between 2 and 20000 then
    raise exception 'Subject or message length is invalid' using errcode = '22023';
  end if;
  if p_category not in (
    'repair',
    'damage',
    'utilities',
    'payment',
    'document',
    'general'
  ) then
    raise exception 'Invalid conversation category' using errcode = '22023';
  end if;

  select tu.tenant_id, u.id, u.property_id
    into v_tenant_id, v_unit_id, v_property_id
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
   where om.organization_id = p_organization_id
     and om.user_id = v_user_id
     and om.role = 'tenant'
     and om.status = 'active'
     and l.id = p_lease_id
     and l.status in ('active', 'notice_given')
     and l.archived_at is null
     and l.starts_on <= v_today
     and (l.ends_on is null or l.ends_on >= v_today)
     and (lt.occupancy_starts_on is null or lt.occupancy_starts_on <= v_today)
     and (lt.occupancy_ends_on is null or lt.occupancy_ends_on >= v_today)
   for update of l;

  if v_tenant_id is null then
    raise exception 'Active tenant lease not found' using errcode = 'P0002';
  end if;

  insert into public.conversations (
    organization_id,
    property_id,
    unit_id,
    lease_id,
    subject,
    category,
    priority,
    status,
    is_internal,
    last_message_at,
    created_by
  )
  values (
    p_organization_id,
    v_property_id,
    v_unit_id,
    p_lease_id,
    trim(p_subject),
    p_category,
    case
      when p_category = 'damage' then 'high'::public.priority_level
      else 'medium'::public.priority_level
    end,
    'waiting_team',
    false,
    now(),
    v_user_id
  )
  returning id into v_conversation_id;

  insert into public.conversation_participants (
    organization_id,
    conversation_id,
    tenant_id,
    participant_role,
    created_by
  )
  values (
    p_organization_id,
    v_conversation_id,
    v_tenant_id,
    'tenant',
    v_user_id
  );

  insert into public.messages (
    organization_id,
    conversation_id,
    author_tenant_id,
    body,
    is_internal_note,
    created_by
  )
  values (
    p_organization_id,
    v_conversation_id,
    v_tenant_id,
    trim(p_body),
    false,
    v_user_id
  );

  return v_conversation_id;
end
$$;

revoke all
  on function public.create_tenant_portal_conversation(
    uuid,
    uuid,
    text,
    text,
    text
  )
  from public, anon;

grant execute
  on function public.create_tenant_portal_conversation(
    uuid,
    uuid,
    text,
    text,
    text
  )
  to authenticated, service_role;

comment on function public.create_tenant_portal_conversation(
  uuid,
  uuid,
  text,
  text,
  text
) is
  'Atomically creates a tenant-scoped conversation, participant, and first message for an active lease.';

create or replace function public.reply_tenant_portal_conversation(
  p_organization_id uuid,
  p_conversation_id uuid,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_today date := (now() at time zone 'Europe/Berlin')::date;
  v_tenant_id uuid;
  v_message_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_body, ''))) not between 2 and 20000 then
    raise exception 'Message length is invalid' using errcode = '22023';
  end if;

  select tu.tenant_id
    into v_tenant_id
    from public.conversations as c
    join public.leases as l
      on l.organization_id = c.organization_id
     and l.id = c.lease_id
    join public.lease_tenants as lt
      on lt.organization_id = l.organization_id
     and lt.lease_id = l.id
    join public.tenant_users as tu
      on tu.organization_id = lt.organization_id
     and tu.tenant_id = lt.tenant_id
    join public.organization_members as om
      on om.organization_id = tu.organization_id
     and om.user_id = tu.user_id
   where c.organization_id = p_organization_id
     and c.id = p_conversation_id
     and c.is_internal = false
     and c.archived_at is null
     and tu.user_id = v_user_id
     and om.role = 'tenant'
     and om.status = 'active'
     and l.status in ('active', 'notice_given')
     and l.archived_at is null
     and l.starts_on <= v_today
     and (l.ends_on is null or l.ends_on >= v_today)
     and (lt.occupancy_starts_on is null or lt.occupancy_starts_on <= v_today)
     and (lt.occupancy_ends_on is null or lt.occupancy_ends_on >= v_today)
   for update of c;

  if v_tenant_id is null then
    raise exception 'Active tenant conversation not found' using errcode = 'P0002';
  end if;

  insert into public.messages (
    organization_id,
    conversation_id,
    author_tenant_id,
    body,
    is_internal_note,
    created_by
  )
  values (
    p_organization_id,
    p_conversation_id,
    v_tenant_id,
    trim(p_body),
    false,
    v_user_id
  )
  returning id into v_message_id;

  update public.conversations
     set last_message_at = now(),
         status = 'waiting_team',
         closed_at = null
   where id = p_conversation_id;

  return v_message_id;
end
$$;

revoke all
  on function public.reply_tenant_portal_conversation(uuid, uuid, text)
  from public, anon;

grant execute
  on function public.reply_tenant_portal_conversation(uuid, uuid, text)
  to authenticated, service_role;

comment on function public.reply_tenant_portal_conversation(
  uuid,
  uuid,
  text
) is
  'Atomically appends a tenant reply and marks its active-lease conversation as waiting for the team.';

create or replace function public.create_tenant_portal_maintenance_request(
  p_organization_id uuid,
  p_lease_id uuid,
  p_title text,
  p_description text,
  p_category text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_today date := (now() at time zone 'Europe/Berlin')::date;
  v_tenant_id uuid;
  v_unit_id uuid;
  v_property_id uuid;
  v_priority public.priority_level;
  v_request_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_title, ''))) not between 3 and 240
     or char_length(trim(coalesce(p_description, ''))) not between 5 and 20000 then
    raise exception 'Request title or description length is invalid'
      using errcode = '22023';
  end if;
  if p_category not in (
    'repair',
    'damage',
    'heating',
    'water',
    'electrical',
    'security',
    'other'
  ) then
    raise exception 'Invalid maintenance category' using errcode = '22023';
  end if;

  select tu.tenant_id, u.id, u.property_id
    into v_tenant_id, v_unit_id, v_property_id
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
   where om.organization_id = p_organization_id
     and om.user_id = v_user_id
     and om.role = 'tenant'
     and om.status = 'active'
     and l.id = p_lease_id
     and l.status in ('active', 'notice_given')
     and l.archived_at is null
     and l.starts_on <= v_today
     and (l.ends_on is null or l.ends_on >= v_today)
     and (lt.occupancy_starts_on is null or lt.occupancy_starts_on <= v_today)
     and (lt.occupancy_ends_on is null or lt.occupancy_ends_on >= v_today)
   for update of l;

  if v_tenant_id is null then
    raise exception 'Active tenant lease not found' using errcode = 'P0002';
  end if;

  v_priority := case
    when p_category = 'damage' then 'high'::public.priority_level
    else 'medium'::public.priority_level
  end;

  insert into public.maintenance_requests (
    organization_id,
    property_id,
    unit_id,
    lease_id,
    tenant_id,
    title,
    description,
    category,
    priority,
    status,
    created_by
  )
  values (
    p_organization_id,
    v_property_id,
    v_unit_id,
    p_lease_id,
    v_tenant_id,
    trim(p_title),
    trim(p_description),
    p_category,
    v_priority,
    'open',
    v_user_id
  )
  returning id into v_request_id;

  insert into public.tasks (
    organization_id,
    property_id,
    unit_id,
    tenant_id,
    maintenance_request_id,
    title,
    description,
    category,
    priority,
    status,
    created_by
  )
  values (
    p_organization_id,
    v_property_id,
    v_unit_id,
    v_tenant_id,
    v_request_id,
    trim(p_title),
    trim(p_description),
    p_category,
    v_priority,
    'open',
    v_user_id
  );

  return v_request_id;
end
$$;

revoke all
  on function public.create_tenant_portal_maintenance_request(
    uuid,
    uuid,
    text,
    text,
    text
  )
  from public, anon;

grant execute
  on function public.create_tenant_portal_maintenance_request(
    uuid,
    uuid,
    text,
    text,
    text
  )
  to authenticated, service_role;

comment on function public.create_tenant_portal_maintenance_request(
  uuid,
  uuid,
  text,
  text,
  text
) is
  'Atomically creates an active-lease tenant request and the linked staff-visible task.';
