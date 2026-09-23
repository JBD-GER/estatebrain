begin;
alter function public.sync_automatic_rent(uuid) rename to checked_sync_automatic_rent;
alter function public.checked_sync_automatic_rent(uuid) set schema private;
create function public.sync_automatic_rent(p_organization_id uuid) returns integer language sql security invoker set search_path=pg_catalog as $$ select private.checked_sync_automatic_rent(p_organization_id); $$;
revoke all on function public.sync_automatic_rent(uuid) from public,anon;
grant execute on function public.sync_automatic_rent(uuid) to authenticated;
alter function public.update_lease_contract(uuid,uuid,timestamptz,jsonb) rename to checked_update_lease_contract;
alter function public.checked_update_lease_contract(uuid,uuid,timestamptz,jsonb) set schema private;
create function public.update_lease_contract(p_organization_id uuid,p_lease_id uuid,p_updated_at timestamptz,p_payload jsonb) returns uuid language sql security invoker set search_path=pg_catalog as $$ select private.checked_update_lease_contract(p_organization_id,p_lease_id,p_updated_at,p_payload); $$;
revoke all on function public.update_lease_contract(uuid,uuid,timestamptz,jsonb) from public,anon;
grant execute on function public.update_lease_contract(uuid,uuid,timestamptz,jsonb) to authenticated;
alter function public.correct_rent_payment(uuid,uuid,date,bigint,boolean) rename to checked_correct_rent_payment;
alter function public.checked_correct_rent_payment(uuid,uuid,date,bigint,boolean) set schema private;
create function public.correct_rent_payment(p_organization_id uuid,p_payment_id uuid,p_paid_on date,p_amount_cents bigint,p_delete boolean default false) returns uuid language sql security invoker set search_path=pg_catalog as $$ select private.checked_correct_rent_payment(p_organization_id,p_payment_id,p_paid_on,p_amount_cents,p_delete); $$;
revoke all on function public.correct_rent_payment(uuid,uuid,date,bigint,boolean) from public,anon;
grant execute on function public.correct_rent_payment(uuid,uuid,date,bigint,boolean) to authenticated;
create or replace function public.generate_monthly_rent_claims(
  p_organization_id uuid,
  p_period date
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_period date := date_trunc('month', p_period)::date;
  v_inserted integer;
begin
  if (select auth.uid()) is null
     or not private.has_org_role(
       p_organization_id,
       array['owner', 'admin', 'property_manager', 'accounting']::public.app_role[]
     ) then
    raise exception 'Insufficient permission to generate rent claims'
      using errcode = '42501';
  end if;

  with applicable_schedules as (
    select distinct on (rs.lease_id)
      rs.id,
      rs.organization_id,
      rs.lease_id,
      rs.due_day,
      rs.cold_rent_cents,
      rs.ancillary_prepayment_cents,
      rs.parking_rent_cents,
      rs.other_rent_cents
    from public.rent_schedules as rs
    join public.leases as l
      on l.id = rs.lease_id
     and l.organization_id = rs.organization_id
    where rs.organization_id = p_organization_id
      and rs.valid_from <= (v_period + interval '1 month - 1 day')::date
      and (rs.valid_until is null or rs.valid_until >= v_period)
      and l.starts_on <= (v_period + interval '1 month - 1 day')::date
      and (l.ends_on is null or l.ends_on >= v_period)
      and l.status in ('active', 'notice_given')
      and l.archived_at is null
      and exists(select 1 from public.units u join public.properties p on p.id=u.property_id where u.id=l.unit_id and u.archived_at is null and p.archived_at is null and p.property_mode='existing')
    order by rs.lease_id, rs.valid_from desc, rs.created_at desc
  )
  insert into public.rent_claims (
    organization_id,
    lease_id,
    rent_schedule_id,
    claim_month,
    due_date,
    cold_rent_cents,
    ancillary_cents,
    parking_cents,
    other_cents,
    created_by
  )
  select
    s.organization_id,
    s.lease_id,
    s.id,
    v_period,
    least(
      v_period + (s.due_day - 1),
      (v_period + interval '1 month - 1 day')::date
    ),
    s.cold_rent_cents,
    s.ancillary_prepayment_cents,
    s.parking_rent_cents,
    s.other_rent_cents,
    (select auth.uid())
  from applicable_schedules as s
  on conflict (lease_id, claim_month) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end
$$;


create or replace function public.archive_workspace_record(p_organization_id uuid,p_module text,p_record_id uuid,p_updated_at timestamptz default null)
returns uuid language plpgsql security invoker set search_path=pg_catalog as $$
declare table_name text; affected integer; unit_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='42501'; end if;
  table_name := case p_module when 'mieter' then 'tenants' when 'immobilien' then 'properties' when 'einheiten' then 'units' when 'mietverhaeltnisse' then 'leases' when 'finanzierungen' then 'loans' when 'sanierungen' then 'renovation_projects' when 'aufgaben' then 'tasks' when 'kommunikation' then 'conversations' when 'belege' then 'documents' when 'markt' then 'valuations' end;
  if table_name is null then raise exception 'Unknown module' using errcode='22023'; end if;
  if p_module='finanzierungen' then
    if not private.has_org_role(p_organization_id,array['owner','admin','accounting']::public.app_role[]) then raise exception 'Insufficient permission' using errcode='42501'; end if;
  elsif p_module='belege' then
    if not private.can_write_bookkeeping(p_organization_id) then raise exception 'Insufficient permission' using errcode='42501'; end if;
  elsif p_module in ('mieter','immobilien','einheiten','mietverhaeltnisse','sanierungen','markt') then
    if not private.has_org_role(p_organization_id,array['owner','admin','property_manager']::public.app_role[]) then raise exception 'Insufficient permission' using errcode='42501'; end if;
  end if;
  if p_module='mieter' and exists(select 1 from public.lease_tenants lt join public.leases l on l.id=lt.lease_id where lt.tenant_id=p_record_id and lt.organization_id=p_organization_id and l.archived_at is null and l.status in ('active','notice_given')) then raise exception 'Remove active leases first' using errcode='23514'; end if;
  if p_module='immobilien' and exists(select 1 from public.units where property_id=p_record_id and organization_id=p_organization_id and archived_at is null) then raise exception 'Remove active units first' using errcode='23514'; end if;
  if p_module='einheiten' and exists(select 1 from public.leases where leases.unit_id=p_record_id and organization_id=p_organization_id and archived_at is null) then raise exception 'Remove active leases first' using errcode='23514'; end if;
  if p_module='mietverhaeltnisse' then select l.unit_id into unit_id from public.leases l where l.id=p_record_id and l.organization_id=p_organization_id; end if;
  if p_module='belege' then
    update public.expense_entries e set archived_at=now() from public.document_links dl
      where dl.expense_entry_id=e.id and dl.document_id=p_record_id and dl.organization_id=p_organization_id and e.organization_id=p_organization_id;
  end if;
  if p_module='markt' then
    delete from public.valuations where id=p_record_id and organization_id=p_organization_id and (p_updated_at is null or updated_at=p_updated_at);
  else
    execute format('update public.%I set archived_at=now() where id=$1 and organization_id=$2 and archived_at is null and ($3 is null or updated_at=$3)',table_name)
    using p_record_id,p_organization_id,p_updated_at;
  end if;
  get diagnostics affected=row_count;
  if affected<>1 then raise exception 'Stale or inaccessible record' using errcode='40001'; end if;
  if p_module='mietverhaeltnisse' then
    update public.units u set status='vacant' where u.id=unit_id and not exists(select 1 from public.leases l where l.unit_id=u.id and l.archived_at is null and l.status in ('active','notice_given'));
  end if;
  return p_record_id;
end $$;
revoke all on function public.archive_workspace_record(uuid,text,uuid,timestamptz) from public,anon;
grant execute on function public.archive_workspace_record(uuid,text,uuid,timestamptz) to authenticated;



create function public.update_document_metadata(p_organization_id uuid,p_document_id uuid,p_updated_at timestamptz,p_payload jsonb)
returns uuid language plpgsql security invoker set search_path=pg_catalog as $$
declare renovation_id uuid:=nullif(p_payload->>'renovationProjectId','')::uuid;
begin
  if auth.uid() is null or not private.can_write_bookkeeping(p_organization_id) then raise exception 'Insufficient permission' using errcode='42501'; end if;
  update public.documents set title=nullif(trim(p_payload->>'title'),''),document_date=nullif(p_payload->>'documentDate','')::date,renovation_project_id=renovation_id
    where id=p_document_id and organization_id=p_organization_id and updated_at=p_updated_at and archived_at is null;
  if not found then raise exception 'Stale or inaccessible document' using errcode='40001'; end if;
  update public.expense_entries e set renovation_project_id=renovation_id from public.document_links dl where dl.document_id=p_document_id and dl.organization_id=p_organization_id and e.id=dl.expense_entry_id and e.organization_id=p_organization_id and e.archived_at is null;
  return p_document_id;
end $$;
revoke all on function public.update_document_metadata(uuid,uuid,timestamptz,jsonb) from public,anon;
grant execute on function public.update_document_metadata(uuid,uuid,timestamptz,jsonb) to authenticated;
commit;
