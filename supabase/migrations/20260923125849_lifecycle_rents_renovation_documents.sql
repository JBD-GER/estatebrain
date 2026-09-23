begin;

alter table public.leases add column automatic_rent_from date;
-- Existing history stays intact; automation starts this month for existing contracts.
update public.leases set automatic_rent_from = greatest(starts_on, date_trunc('month', now() at time zone 'Europe/Berlin')::date);
alter table public.rent_claims add column automatic_payment_suppressed boolean not null default false;
alter table public.rent_payments add column is_automatic boolean not null default false;
create unique index rent_payments_one_automatic on public.rent_payments(rent_claim_id) where is_automatic;
alter table public.documents add column renovation_project_id uuid references public.renovation_projects(id) on delete restrict;
alter table public.expense_entries add column renovation_project_id uuid references public.renovation_projects(id) on delete restrict;
create index documents_renovation_idx on public.documents(renovation_project_id);
create index expense_entries_renovation_idx on public.expense_entries(renovation_project_id);

create function private.check_renovation_assignment() returns trigger
language plpgsql security definer set search_path = pg_catalog as $$
begin
  if new.renovation_project_id is not null and not exists (
    select 1 from public.renovation_projects r where r.id = new.renovation_project_id
    and r.organization_id = new.organization_id and r.property_id = new.property_id and r.archived_at is null
  ) then raise exception 'Renovation must belong to the same property and organization' using errcode='23514'; end if;
  return new;
end $$;
create trigger documents_renovation_scope before insert or update of renovation_project_id, property_id, organization_id on public.documents for each row execute function private.check_renovation_assignment();
create trigger expenses_renovation_scope before insert or update of renovation_project_id, property_id, organization_id on public.expense_entries for each row execute function private.check_renovation_assignment();
revoke all on function private.check_renovation_assignment() from public, anon, authenticated, service_role;

create function private.check_renovation_completion() returns trigger
language plpgsql security invoker set search_path = pg_catalog as $$
begin
  if new.status = 'done' and new.actual_end_date is null then
    raise exception 'Completed renovations require a completion date' using errcode='23514';
  end if;
  if tg_op = 'UPDATE' and new.property_id is distinct from old.property_id and exists (
    select 1 from public.documents where renovation_project_id=old.id
    union all select 1 from public.expense_entries where renovation_project_id=old.id
  ) then raise exception 'A renovation with receipts cannot change property' using errcode='23514'; end if;
  return new;
end $$;
create trigger renovation_completion_guard before insert or update on public.renovation_projects for each row execute function private.check_renovation_completion();
revoke all on function private.check_renovation_completion() from public, anon, authenticated, service_role;

-- Only the internal scheduler and the checked wrapper can execute this routine.
create function private.sync_automatic_rent(p_organization_id uuid, p_lease_id uuid default null)
returns integer language plpgsql security definer set search_path=pg_catalog as $$
declare
  l public.leases%rowtype; s public.rent_schedules%rowtype; c public.rent_claims%rowtype;
  month_date date; today date := (now() at time zone 'Europe/Berlin')::date;
  payment_date date; total integer := 0;
begin
  for l in select lease_row.* from public.leases lease_row
    join public.units u on u.id=lease_row.unit_id and u.archived_at is null
    join public.properties p on p.id=u.property_id and p.archived_at is null and p.property_mode='existing'
    where lease_row.organization_id=p_organization_id and lease_row.archived_at is null
      and lease_row.status in ('active','notice_given','ended')
      and (p_lease_id is null or lease_row.id=p_lease_id)
    order by lease_row.id for update of lease_row
  loop
    for month_date in select generate_series(
      date_trunc('month', greatest(l.starts_on, coalesce(l.automatic_rent_from,l.starts_on)))::date,
      date_trunc('month', least(today, coalesce(l.ends_on,today)))::date, interval '1 month')::date
    loop
      select * into s from public.rent_schedules
      where lease_id=l.id and organization_id=p_organization_id
        and valid_from <= (month_date+interval '1 month - 1 day')::date
        and (valid_until is null or valid_until>=month_date)
      order by valid_from desc,created_at desc,id desc limit 1;
      if not found then continue; end if;
      payment_date := greatest(l.starts_on, least(month_date+(s.due_day-1),(month_date+interval '1 month - 1 day')::date));
      insert into public.rent_claims(organization_id,lease_id,rent_schedule_id,claim_month,due_date,cold_rent_cents,ancillary_cents,parking_cents,other_cents)
      values(p_organization_id,l.id,s.id,month_date,payment_date,s.cold_rent_cents,s.ancillary_prepayment_cents,s.parking_rent_cents,s.other_rent_cents)
      on conflict(lease_id,claim_month) do nothing;
      select * into c from public.rent_claims where lease_id=l.id and claim_month=month_date for update;
      if c.status='cancelled' or c.automatic_payment_suppressed then continue; end if;
      -- Preserve explicit confirmations, partial payments, and bank allocations.
      if exists(select 1 from public.rent_payments where rent_claim_id=c.id and not is_automatic) then continue; end if;
      update public.rent_claims set rent_schedule_id=s.id,due_date=payment_date,
        cold_rent_cents=s.cold_rent_cents,ancillary_cents=s.ancillary_prepayment_cents,
        parking_cents=s.parking_rent_cents,other_cents=s.other_rent_cents
      where id=c.id and (due_date,cold_rent_cents,ancillary_cents,parking_cents,other_cents)
        is distinct from (payment_date,s.cold_rent_cents,s.ancillary_prepayment_cents,s.parking_rent_cents,s.other_rent_cents);
      if payment_date>today then
        delete from public.rent_payments where rent_claim_id=c.id and is_automatic;
        continue;
      end if;
      if exists(select 1 from public.rent_payments where rent_claim_id=c.id and is_automatic) then
        update public.rent_payments set amount_cents=s.cold_rent_cents+s.ancillary_prepayment_cents+s.parking_rent_cents+s.other_rent_cents,paid_on=payment_date
        where rent_claim_id=c.id and is_automatic
          and (amount_cents,paid_on) is distinct from (s.cold_rent_cents+s.ancillary_prepayment_cents+s.parking_rent_cents+s.other_rent_cents,payment_date);
      elsif c.paid_cents=0 and s.cold_rent_cents+s.ancillary_prepayment_cents+s.parking_rent_cents+s.other_rent_cents>0 then
        insert into public.rent_payments(organization_id,rent_claim_id,paid_on,amount_cents,is_automatic,notes)
        values(p_organization_id,c.id,payment_date,s.cold_rent_cents+s.ancillary_prepayment_cents+s.parking_rent_cents+s.other_rent_cents,true,'Automatisch aus dem Mietvertrag gebucht');
        total:=total+1;
      end if;
    end loop;
  end loop;
  return total;
end $$;
revoke all on function private.sync_automatic_rent(uuid,uuid) from public,anon,authenticated,service_role;

create function public.sync_automatic_rent(p_organization_id uuid) returns integer
language plpgsql security definer set search_path=pg_catalog as $$
begin
  if (select auth.uid()) is null or not private.has_org_role(p_organization_id,array['owner','admin','property_manager','accounting']::public.app_role[]) then
    raise exception 'Insufficient permission' using errcode='42501';
  end if;
  return private.sync_automatic_rent(p_organization_id);
end $$;
revoke all on function public.sync_automatic_rent(uuid) from public,anon;
grant execute on function public.sync_automatic_rent(uuid) to authenticated;

create function public.update_lease_contract(p_organization_id uuid,p_lease_id uuid,p_updated_at timestamptz,p_payload jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare l public.leases%rowtype; effective date := (p_payload->>'rent_effective_from')::date; end_date date := nullif(p_payload->>'ends_on','')::date; start_date date := (p_payload->>'starts_on')::date;
begin
  if (select auth.uid()) is null or not private.has_org_role(p_organization_id,array['owner','admin','property_manager']::public.app_role[]) then raise exception 'Insufficient permission' using errcode='42501'; end if;
  select * into l from public.leases where id=p_lease_id and organization_id=p_organization_id and archived_at is null for update;
  if not found or not private.can_view_unit(p_organization_id,l.unit_id) or l.updated_at is distinct from p_updated_at then raise exception 'Stale or inaccessible lease' using errcode='40001'; end if;
  if effective is null or effective<>date_trunc('month',effective)::date or start_date is null
    or (end_date is not null and end_date<start_date) or p_payload->>'status' not in ('active','notice_given','ended')
    or (p_payload->>'status'='ended' and end_date is null)
    or (p_payload->>'cold_rent_cents')::bigint<=0 then raise exception 'Invalid lease values' using errcode='22023'; end if;
  if exists(select 1 from public.rent_claims c join public.rent_payments rp on rp.rent_claim_id=c.id
    where c.lease_id=l.id and not rp.is_automatic and (c.claim_month<date_trunc('month',start_date)::date or (end_date is not null and c.claim_month>date_trunc('month',end_date)::date))) then
    raise exception 'Manually booked payments lie outside the new contract term' using errcode='23514';
  end if;
  update public.leases set lease_number=nullif(p_payload->>'lease_number',''), starts_on=start_date, ends_on=end_date,
    due_day=(p_payload->>'due_day')::smallint, cold_rent_cents=(p_payload->>'cold_rent_cents')::bigint,
    ancillary_prepayment_cents=(p_payload->>'ancillary_prepayment_cents')::bigint,
    ancillary_charge_type=p_payload->>'ancillary_charge_type', parking_rent_cents=(p_payload->>'parking_rent_cents')::bigint,
    other_rent_cents=(p_payload->>'other_rent_cents')::bigint,deposit_cents=(p_payload->>'deposit_cents')::bigint,status=p_payload->>'status'
  where id=l.id;
  delete from public.rent_schedules where lease_id=l.id and valid_from>=effective;
  update public.rent_schedules set valid_until=effective-1 where lease_id=l.id and valid_from<effective and (valid_until is null or valid_until>=effective);
  insert into public.rent_schedules(organization_id,lease_id,valid_from,valid_until,due_day,cold_rent_cents,ancillary_prepayment_cents,parking_rent_cents,other_rent_cents,reason,created_by)
  select organization_id,id,greatest(effective,starts_on),null,due_day,cold_rent_cents,ancillary_prepayment_cents,parking_rent_cents,other_rent_cents,'Vertrag bearbeitet',auth.uid() from public.leases where id=l.id;
  delete from public.rent_payments rp using public.rent_claims c where rp.rent_claim_id=c.id and c.lease_id=l.id and rp.is_automatic
    and (c.claim_month<date_trunc('month',start_date)::date or (end_date is not null and c.claim_month>date_trunc('month',end_date)::date));
  update public.rent_claims set status='cancelled',automatic_payment_suppressed=true where lease_id=l.id and paid_cents=0
    and (claim_month<date_trunc('month',start_date)::date or (end_date is not null and claim_month>date_trunc('month',end_date)::date));
  update public.units set status=case when exists(select 1 from public.leases where unit_id=l.unit_id and archived_at is null and status in ('active','notice_given') and (ends_on is null or ends_on >= (now() at time zone 'Europe/Berlin')::date)) then 'rented' else 'vacant' end where id=l.unit_id;
  perform private.sync_automatic_rent(p_organization_id,l.id);
  return l.id;
end $$;
revoke all on function public.update_lease_contract(uuid,uuid,timestamptz,jsonb) from public,anon;
grant execute on function public.update_lease_contract(uuid,uuid,timestamptz,jsonb) to authenticated;

create function public.correct_rent_payment(p_organization_id uuid,p_payment_id uuid,p_paid_on date,p_amount_cents bigint,p_delete boolean default false)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare p public.rent_payments%rowtype;
begin
  if (select auth.uid()) is null or not private.can_write_bookkeeping(p_organization_id) then raise exception 'Insufficient permission' using errcode='42501'; end if;
  select * into p from public.rent_payments where id=p_payment_id and organization_id=p_organization_id;
  if not found then raise exception 'Payment unavailable' using errcode='P0002'; end if;
  perform 1 from public.rent_claims c where c.id=p.rent_claim_id and private.can_view_lease(p_organization_id,c.lease_id) for update;
  if not found then raise exception 'Payment unavailable' using errcode='42501'; end if;
  select * into p from public.rent_payments where id=p_payment_id and organization_id=p_organization_id for update;
  if not found then raise exception 'Payment unavailable' using errcode='P0002'; end if;
  if p.bank_transaction_id is not null then raise exception 'Correct bank-linked payments in bank reconciliation' using errcode='23514'; end if;
  update public.rent_claims set automatic_payment_suppressed=true where id=p.rent_claim_id;
  if p_delete then delete from public.rent_payments where id=p.id;
  else
    if p_paid_on is null or p_amount_cents is null or p_amount_cents<=0 then raise exception 'Invalid payment values' using errcode='22023'; end if;
    update public.rent_payments set paid_on=p_paid_on,amount_cents=p_amount_cents,is_automatic=false,notes='Zahlungseingang manuell bestätigt' where id=p.id;
  end if;
  return p.id;
end $$;
revoke all on function public.correct_rent_payment(uuid,uuid,date,bigint,boolean) from public,anon;
grant execute on function public.correct_rent_payment(uuid,uuid,date,bigint,boolean) to authenticated;

create function public.review_document_with_renovation(p_organization_id uuid,p_document_id uuid,p_payload jsonb)
returns uuid language plpgsql security invoker set search_path=pg_catalog as $$
declare expense_id uuid; renovation_id uuid := nullif(p_payload->>'renovationProjectId','')::uuid;
begin
  if (select auth.uid()) is null or not private.can_write_bookkeeping(p_organization_id) then raise exception 'Insufficient permission' using errcode='42501'; end if;
  update public.documents set renovation_project_id=null where id=p_document_id and organization_id=p_organization_id and archived_at is null;
  if not found then raise exception 'Document unavailable' using errcode='P0002'; end if;
  -- Clear old assignment before a property correction; the transaction restores it on any failure.
  update public.expense_entries e set renovation_project_id=null from public.document_links dl
    where dl.document_id=p_document_id and dl.expense_entry_id=e.id and dl.organization_id=p_organization_id;
  expense_id:=public.review_document_expense(p_organization_id,p_document_id,p_payload);
  update public.documents set renovation_project_id=renovation_id where id=p_document_id and organization_id=p_organization_id;
  update public.expense_entries set renovation_project_id=renovation_id where id=expense_id and organization_id=p_organization_id;
  return expense_id;
end $$;
revoke all on function public.review_document_with_renovation(uuid,uuid,jsonb) from public,anon;
grant execute on function public.review_document_with_renovation(uuid,uuid,jsonb) to authenticated;

create function public.archive_workspace_record(p_organization_id uuid,p_module text,p_record_id uuid,p_updated_at timestamptz default null)
returns uuid language plpgsql security invoker set search_path=pg_catalog as $$
declare table_name text; affected integer; unit_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Authentication required' using errcode='42501'; end if;
  table_name := case p_module when 'immobilien' then 'properties' when 'einheiten' then 'units' when 'mietverhaeltnisse' then 'leases' when 'finanzierungen' then 'loans' when 'sanierungen' then 'renovation_projects' when 'aufgaben' then 'tasks' when 'kommunikation' then 'conversations' when 'belege' then 'documents' when 'markt' then 'valuations' end;
  if table_name is null then raise exception 'Unknown module' using errcode='22023'; end if;
  if p_module='finanzierungen' then
    if not private.has_org_role(p_organization_id,array['owner','admin','accounting']::public.app_role[]) then raise exception 'Insufficient permission' using errcode='42501'; end if;
  elsif p_module='belege' then
    if not private.can_write_bookkeeping(p_organization_id) then raise exception 'Insufficient permission' using errcode='42501'; end if;
  elsif p_module in ('immobilien','einheiten','mietverhaeltnisse','sanierungen','markt') then
    if not private.has_org_role(p_organization_id,array['owner','admin','property_manager']::public.app_role[]) then raise exception 'Insufficient permission' using errcode='42501'; end if;
  end if;
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

create function private.run_automatic_rents() returns void
language plpgsql security definer set search_path=pg_catalog as $$
declare organization_id uuid;
begin
  for organization_id in select id from public.organizations where archived_at is null order by id loop
    perform private.sync_automatic_rent(organization_id);
  end loop;
end $$;
revoke all on function private.run_automatic_rents() from public,anon,authenticated,service_role;

create extension if not exists pg_cron;
select cron.schedule('estatebrain-monthly-rents','15 2 * * *','select private.run_automatic_rents()');

commit;
