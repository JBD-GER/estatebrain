-- Atomic staff-to-tenant conversation creation.

create or replace function public.create_staff_tenant_conversation(
  p_organization_id uuid,
  p_lease_id uuid,
  p_subject text,
  p_category text,
  p_priority public.priority_level,
  p_body text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_property_id uuid;
  v_unit_id uuid;
  v_tenant_id uuid;
  v_conversation_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_subject, ''))) not between 1 and 240
     or char_length(trim(coalesce(p_body, ''))) not between 1 and 20000 then
    raise exception 'Subject or message length is invalid' using errcode = '22023';
  end if;
  if p_category not in (
    'repair',
    'damage',
    'utilities',
    'payment',
    'document',
    'general',
    'termination',
    'handover',
    'other'
  ) then
    raise exception 'Invalid conversation category' using errcode = '22023';
  end if;

  select u.property_id, u.id, lt.tenant_id
    into v_property_id, v_unit_id, v_tenant_id
    from public.leases as l
    join public.units as u
      on u.organization_id = l.organization_id
     and u.id = l.unit_id
    join public.lease_tenants as lt
      on lt.organization_id = l.organization_id
     and lt.lease_id = l.id
   where l.organization_id = p_organization_id
     and l.id = p_lease_id
     and l.archived_at is null
     and lt.is_primary
   order by lt.created_at
   limit 1;

  if v_tenant_id is null then
    raise exception 'Lease and primary tenant not found' using errcode = 'P0002';
  end if;
  if not (
    private.has_org_role(
      p_organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
    or (
      private.current_member_role(p_organization_id) = 'employee'
      and private.can_operate_property(p_organization_id, v_property_id)
    )
  ) then
    raise exception 'Insufficient permission for this lease'
      using errcode = '42501';
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
    p_priority,
    'waiting_tenant',
    false,
    now(),
    v_user_id
  )
  returning id into v_conversation_id;

  insert into public.conversation_participants (
    organization_id,
    conversation_id,
    user_id,
    participant_role,
    created_by
  )
  values (
    p_organization_id,
    v_conversation_id,
    v_user_id,
    'team',
    v_user_id
  );

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
    author_user_id,
    body,
    is_internal_note,
    created_by
  )
  values (
    p_organization_id,
    v_conversation_id,
    v_user_id,
    trim(p_body),
    false,
    v_user_id
  );

  return v_conversation_id;
end
$$;

revoke all
  on function public.create_staff_tenant_conversation(
    uuid,
    uuid,
    text,
    text,
    public.priority_level,
    text
  )
  from public, anon;

grant execute
  on function public.create_staff_tenant_conversation(
    uuid,
    uuid,
    text,
    text,
    public.priority_level,
    text
  )
  to authenticated, service_role;

comment on function public.create_staff_tenant_conversation(
  uuid,
  uuid,
  text,
  text,
  public.priority_level,
  text
) is
  'Atomically opens a property-scoped tenant thread and writes its first message.';

create or replace function public.reply_staff_conversation(
  p_organization_id uuid,
  p_conversation_id uuid,
  p_body text,
  p_internal_note boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_property_id uuid;
  v_message_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_body, ''))) not between 1 and 20000 then
    raise exception 'Message length is invalid' using errcode = '22023';
  end if;

  select c.property_id
    into v_property_id
    from public.conversations as c
   where c.id = p_conversation_id
     and c.organization_id = p_organization_id
     and c.archived_at is null
   for update;

  if not found then
    raise exception 'Conversation not found' using errcode = 'P0002';
  end if;
  if not (
    private.has_org_role(
      p_organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
    or (
      private.current_member_role(p_organization_id) = 'employee'
      and v_property_id is not null
      and private.can_operate_property(p_organization_id, v_property_id)
    )
  ) then
    raise exception 'Insufficient permission for this conversation'
      using errcode = '42501';
  end if;

  insert into public.messages (
    organization_id,
    conversation_id,
    author_user_id,
    body,
    is_internal_note,
    created_by
  )
  values (
    p_organization_id,
    p_conversation_id,
    v_user_id,
    trim(p_body),
    coalesce(p_internal_note, false),
    v_user_id
  )
  returning id into v_message_id;

  update public.conversations
     set last_message_at = now(),
         status = case
           when coalesce(p_internal_note, false) then status
           else 'waiting_tenant'
         end
   where id = p_conversation_id;

  return v_message_id;
end
$$;

revoke all
  on function public.reply_staff_conversation(uuid, uuid, text, boolean)
  from public, anon;

grant execute
  on function public.reply_staff_conversation(uuid, uuid, text, boolean)
  to authenticated, service_role;

comment on function public.reply_staff_conversation(
  uuid,
  uuid,
  text,
  boolean
) is
  'Atomically appends a staff reply or internal note to an authorized property-scoped thread.';
