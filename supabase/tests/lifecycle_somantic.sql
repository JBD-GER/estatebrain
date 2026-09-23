-- Run in a transaction, optionally after the unapplied migrations. No fixtures persist.
begin;
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values
 ('aa000000-0000-4000-8000-000000000001','lifecycle-fixture@estatebrain.test','{}','{}'),
 ('aa000000-0000-4000-8000-000000000002','lifecycle-other@estatebrain.test','{}','{}');
insert into public.organizations(id,name,kind,owner_user_id) values
 ('ab000000-0000-4000-8000-000000000001','Lifecycle fixture','private_person','aa000000-0000-4000-8000-000000000001'),
 ('ab000000-0000-4000-8000-000000000002','Other fixture','private_person','aa000000-0000-4000-8000-000000000002');
insert into public.organization_members(organization_id,user_id,role,status,joined_at) values
 ('ab000000-0000-4000-8000-000000000001','aa000000-0000-4000-8000-000000000001','owner','active',now()),
 ('ab000000-0000-4000-8000-000000000002','aa000000-0000-4000-8000-000000000002','owner','active',now());
insert into public.properties(id,organization_id,name,street,postal_code,city) values
 ('ac000000-0000-4000-8000-000000000001','ab000000-0000-4000-8000-000000000001','Test house','Teststraße 1','10115','Berlin'),
 ('ac000000-0000-4000-8000-000000000002','ab000000-0000-4000-8000-000000000001','Test house 2','Teststraße 2','10115','Berlin'),
 ('ac000000-0000-4000-8000-000000000003','ab000000-0000-4000-8000-000000000002','Other house','Teststraße 3','10115','Berlin');
insert into public.units(id,organization_id,property_id,unit_number) values
 ('ad000000-0000-4000-8000-000000000001','ab000000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000001','1');
insert into public.leases(id,organization_id,unit_id,starts_on,cold_rent_cents,ancillary_prepayment_cents,status) values
 ('ae000000-0000-4000-8000-000000000001','ab000000-0000-4000-8000-000000000001','ad000000-0000-4000-8000-000000000001',(date_trunc('month',now() at time zone 'Europe/Berlin')-interval '2 months')::date,100000,20000,'active');
insert into public.rent_schedules(organization_id,lease_id,valid_from,due_day,cold_rent_cents,ancillary_prepayment_cents)
 select organization_id,id,starts_on,1,cold_rent_cents,ancillary_prepayment_cents from public.leases where id='ae000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claims','{"sub":"aa000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$
declare org uuid:='ab000000-0000-4000-8000-000000000001'; p uuid; claim uuid; l public.leases%rowtype; r uuid;
begin
  assert public.sync_automatic_rent(org)=3,'Three elapsed months must be booked';
  assert public.sync_automatic_rent(org)=0,'Repeated runs must be idempotent';
  assert (select count(*)=3 and sum(amount_cents)=360000 from public.rent_payments where organization_id=org),'Rent totals incorrect';
  select id,rent_claim_id into p,claim from public.rent_payments where organization_id=org order by paid_on limit 1;
  perform public.correct_rent_payment(org,p,current_date,110000,false);
  perform public.sync_automatic_rent(org);
  assert (select amount_cents=110000 and paid_on=current_date and not is_automatic from public.rent_payments where id=p),'Manual correction overwritten';
  select id,rent_claim_id into p,claim from public.rent_payments where organization_id=org and is_automatic order by paid_on limit 1;
  perform public.correct_rent_payment(org,p,current_date,120000,true);
  perform public.sync_automatic_rent(org);
  assert not exists(select 1 from public.rent_payments where rent_claim_id=claim),'Deleted payment regenerated';
  select * into l from public.leases where id='ae000000-0000-4000-8000-000000000001';
  perform public.update_lease_contract(org,l.id,l.updated_at,jsonb_build_object('rent_effective_from',date_trunc('month',now() at time zone 'Europe/Berlin')::date,'starts_on',l.starts_on,'due_day',1,'cold_rent_cents',125000,'ancillary_prepayment_cents',25000,'parking_rent_cents',0,'other_rent_cents',0,'deposit_cents',0,'ancillary_charge_type','advance','status','active'));
  assert (select amount_cents=150000 from public.rent_payments where organization_id=org and is_automatic),'Current automatic rent not updated';
  assert (select status='rented' from public.units where id=l.unit_id),'Unit status incorrect';
  begin
    perform public.archive_workspace_record(org,'immobilien','ac000000-0000-4000-8000-000000000001');
    raise exception 'Property with active units must not be removed';
  exception when check_violation then null; end;
  begin
    insert into public.renovation_projects(organization_id,property_id,name,status) values(org,'ac000000-0000-4000-8000-000000000001','Incomplete','done');
    raise exception 'Completion date must be required';
  exception when check_violation then null; end;
  r:=public.reserve_somantic_valuation(org,'ac000000-0000-4000-8000-000000000001','{"typ":"haus","street":"Teststraße 1","postcode":"10115","city":"Berlin","square_meters":100}');
  begin
    perform public.reserve_somantic_valuation(org,'ac000000-0000-4000-8000-000000000001','{"typ":"haus","street":"Teststraße 1","postcode":"10115","city":"Berlin","square_meters":100}');
    raise exception 'Concurrent pending reservation must fail';
  exception when unique_violation then null; end;
  begin
    perform public.finish_somantic_valuation(r,'{"estimates":{"price":500000}}');
    raise exception 'Client must not complete provider reports';
  exception when insufficient_privilege then null; end;
  begin
    perform public.reserve_somantic_valuation('ab000000-0000-4000-8000-000000000002','ac000000-0000-4000-8000-000000000003','{}');
    raise exception 'Cross-org reservation must fail';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role service_role;
select public.finish_somantic_valuation(id,'{"estimates":{"price":500000,"rent":1500},"confidence":{"price":"high","rent":"medium","sample_size":12}}') from public.somantic_valuation_reports where organization_id='ab000000-0000-4000-8000-000000000001';
-- Repeating persistence must not duplicate a provider result.
select public.finish_somantic_valuation(id,'{"estimates":{"price":999999}}') from public.somantic_valuation_reports where organization_id='ab000000-0000-4000-8000-000000000001';
do $$ begin
  assert (select current_market_value_cents=50000000 from public.properties where id='ac000000-0000-4000-8000-000000000001'),'Projection must use cents';
  assert (select count(*)=1 from public.valuations where property_id='ac000000-0000-4000-8000-000000000001'),'Duplicate projected value';
end $$;
reset role;
-- Completed valuations can be requested again in the SAME year without overwriting history.
set local role authenticated;
do $$
declare r uuid; org uuid:='ab000000-0000-4000-8000-000000000001'; prop uuid:='ac000000-0000-4000-8000-000000000001';
begin
  r:=public.reserve_somantic_valuation(org,prop,'{"typ":"haus","street":"Teststraße 1","postcode":"10115","city":"Berlin","square_meters":105,"comparison_scope":"broader"}');
  assert (select count(*)=2 and count(distinct valuation_year)=1 from public.somantic_valuation_reports where property_id=prop),'Same-year repeat must create a new report';
  assert (select (input->>'square_meters')::int=100 and (response->'estimates'->>'price')::int=500000 from public.somantic_valuation_reports where property_id=prop and status='succeeded'),'Previous report changed';
end $$;
reset role;
set local role service_role;
select public.finish_somantic_valuation(id,'{"estimates":{"price":null,"rent":900},"confidence":{"price":"none","rent":"low","sample_size":6}}') from public.somantic_valuation_reports where property_id='ac000000-0000-4000-8000-000000000001' and status='pending';
do $$ begin
  assert (select current_market_value_cents=50000000 from public.properties where id='ac000000-0000-4000-8000-000000000001'),'Insufficient response must preserve market value';
end $$;
reset role;
set local role authenticated;
select public.reserve_somantic_valuation('ab000000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000001','{"typ":"haus","street":"Teststraße 1","postcode":"10115","city":"Berlin","square_meters":105}');
reset role;
set local role service_role;
select public.finish_somantic_valuation(id,'{"estimates":{"price":550000,"rent":950},"confidence":{"price":"medium","rent":"low","sample_size":15}}') from public.somantic_valuation_reports where property_id='ac000000-0000-4000-8000-000000000001' and status='pending';
do $$ begin
  assert (select count(*)=3 and count(distinct valuation_year)=1 from public.somantic_valuation_reports where property_id='ac000000-0000-4000-8000-000000000001'),'Insufficient report must also allow an immediate repeat';
  assert (select count(*)=2 and sum(market_value_cents)=105000000 from public.valuations where property_id='ac000000-0000-4000-8000-000000000001'),'Both successful values must remain in history';
end $$;
reset role;
set local role authenticated;
select public.reserve_somantic_valuation('ab000000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000002','{"typ":"haus","street":"Teststraße 2","postcode":"10115","city":"Berlin","square_meters":100}');
reset role;
set local role service_role;
-- Even an unresolved request from a previous year blocks duplicate external requests.
update public.somantic_valuation_reports set status='uncertain',valuation_year=valuation_year-1 where property_id='ac000000-0000-4000-8000-000000000002';
reset role;
set local role authenticated;
do $$ begin
  begin
    perform public.reserve_somantic_valuation('ab000000-0000-4000-8000-000000000001','ac000000-0000-4000-8000-000000000002','{"typ":"haus","street":"Teststraße 2","postcode":"10115","city":"Berlin","square_meters":100}');
    raise exception 'Uncertain prior-year request must prevent a duplicate';
  exception when unique_violation then null; end;
end $$;
reset role;
select 'Lifecycle, rent correction, repeat valuations, history preservation, duplicate prevention and access control passed' as result;
rollback;
