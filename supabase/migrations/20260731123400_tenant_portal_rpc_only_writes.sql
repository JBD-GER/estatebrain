-- Tenant portal writes must pass through the atomic SECURITY DEFINER RPCs.
-- Staff retain the existing direct table workflows, while tenant-authored
-- conversations, messages, and maintenance requests can no longer bypass the
-- participant, timestamp/status, or linked-task invariants.

drop policy if exists conversations_insert on public.conversations;
create policy conversations_insert
  on public.conversations for insert to authenticated
  with check (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
    or (
      private.current_member_role(organization_id) = 'employee'
      and property_id is not null
      and private.can_operate_property(organization_id, property_id)
    )
  );

drop policy if exists messages_insert on public.messages;
create policy messages_insert
  on public.messages for insert to authenticated
  with check (
    private.can_access_conversation(organization_id, conversation_id)
    and author_user_id = (select auth.uid())
    and author_tenant_id is null
    and private.current_member_role(organization_id) <> 'tenant'
  );

drop policy if exists messages_update_author on public.messages;
create policy messages_update_author
  on public.messages for update to authenticated
  using (
    private.can_access_conversation(organization_id, conversation_id)
    and author_user_id = (select auth.uid())
    and private.current_member_role(organization_id) <> 'tenant'
  )
  with check (
    private.can_access_conversation(organization_id, conversation_id)
    and author_user_id = (select auth.uid())
    and author_tenant_id is null
    and private.current_member_role(organization_id) <> 'tenant'
  );

drop policy if exists maintenance_requests_insert
  on public.maintenance_requests;
create policy maintenance_requests_insert
  on public.maintenance_requests for insert to authenticated
  with check (
    private.can_operate_property(organization_id, property_id)
  );

comment on policy conversations_insert on public.conversations is
  'Staff direct writes only; tenants use create_tenant_portal_conversation().';
comment on policy messages_insert on public.messages is
  'Staff direct writes only; tenants use the atomic tenant portal RPCs.';
comment on policy messages_update_author on public.messages is
  'Staff authors may edit their own messages; tenant messages are immutable outside portal RPCs.';
comment on policy maintenance_requests_insert on public.maintenance_requests is
  'Staff direct writes only; tenants use create_tenant_portal_maintenance_request().';
