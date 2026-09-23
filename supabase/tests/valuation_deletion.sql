begin;
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data) values
 ('ba000000-0000-4000-8000-000000000001','valuation-delete-fixture@estatebrain.test','{}','{}'),
 ('ba000000-0000-4000-8000-000000000002','valuation-delete-other@estatebrain.test','{}','{}');
insert into public.organizations(id,name,kind,owner_user_id) values
 ('bb000000-0000-4000-8000-000000000001','Valuation delete fixture','private_person','ba000000-0000-4000-8000-000000000001'),
 ('bb000000-0000-4000-8000-000000000002','Other delete fixture','private_person','ba000000-0000-4000-8000-000000000002');
insert into public.organization_members(organization_id,user_id,role,status,joined_at) values
 ('bb000000-0000-4000-8000-000000000001','ba000000-0000-4000-8000-000000000001','owner','active',now()),
 ('bb000000-0000-4000-8000-000000000002','ba000000-0000-4000-8000-000000000002','owner','active',now());
insert into public.properties(id,organization_id,name,street,postal_code,city) values
 ('bc000000-0000-4000-8000-000000000001','bb000000-0000-4000-8000-000000000001','Same property','Teststraße 1','10115','Berlin'),
 ('bc000000-0000-4000-8000-000000000002','bb000000-0000-4000-8000-000000000002','Other property','Teststraße 2','10115','Berlin');
insert into public.valuations(id,organization_id,property_id,valued_on,market_value_cents,source_type,source_name,created_at) values
 ('bd000000-0000-4000-8000-000000000001','bb000000-0000-4000-8000-000000000001','bc000000-0000-4000-8000-000000000001',current_date,25125200,'manual','Fixture',now()-interval '1 hour'),
 ('bd000000-0000-4000-8000-000000000002','bb000000-0000-4000-8000-000000000001','bc000000-0000-4000-8000-000000000001',current_date,27542900,'market_report','Somantic',now()),
 ('bd000000-0000-4000-8000-000000000003','bb000000-0000-4000-8000-000000000002','bc000000-0000-4000-8000-000000000002',current_date,70000000,'manual','Other',now());
insert into public.somantic_valuation_reports(id,organization_id,property_id,valuation_year,status,input,response,valuation_id) values
 ('be000000-0000-4000-8000-000000000001','bb000000-0000-4000-8000-000000000001','bc000000-0000-4000-8000-000000000001',extract(year from now()),'succeeded','{}','{"estimates":{"price":275429}}','bd000000-0000-4000-8000-000000000002'),
 ('be000000-0000-4000-8000-000000000002','bb000000-0000-4000-8000-000000000001','bc000000-0000-4000-8000-000000000001',extract(year from now()),'insufficient','{}','{"estimates":{"price":null}}',null),
 ('be000000-0000-4000-8000-000000000003','bb000000-0000-4000-8000-000000000001','bc000000-0000-4000-8000-000000000001',extract(year from now()),'pending','{}',null,null);
select set_config('request.jwt.claims','{"sub":"ba000000-0000-4000-8000-000000000001","role":"authenticated"}',true);
set local role authenticated;
do $$
declare org uuid:='bb000000-0000-4000-8000-000000000001'; prop uuid:='bc000000-0000-4000-8000-000000000001';
begin
  assert (select current_market_value_cents=27542900 from public.properties where id=prop),'Wrong latest value before deletion';
  begin
    perform public.delete_property_valuation('bb000000-0000-4000-8000-000000000002','bd000000-0000-4000-8000-000000000003');
    raise exception 'Cross-org deletion must fail';
  exception when insufficient_privilege then null; end;
  begin
    perform public.delete_property_valuation(org,'bd000000-0000-4000-8000-000000000002',null,'2000-01-01');
    raise exception 'Stale deletion must fail';
  exception when serialization_failure then null; end;
  assert (select count(*)=3 from public.somantic_valuation_reports where organization_id=org),'Stale deletion removed a report';
  perform public.delete_property_valuation(org,'bd000000-0000-4000-8000-000000000002');
  assert not exists(select 1 from public.somantic_valuation_reports where id='be000000-0000-4000-8000-000000000001'),'Linked report must be deleted';
  assert (select current_market_value_cents=25125200 from public.properties where id=prop),'Previous value must become current';
  perform public.delete_property_valuation(org,null,'be000000-0000-4000-8000-000000000002');
  assert (select count(*)=1 from public.somantic_valuation_reports where organization_id=org),'Insufficient report must be deletable';
  begin
    perform public.delete_property_valuation(org,null,'be000000-0000-4000-8000-000000000003');
    raise exception 'Pending request must not be deleted';
  exception when object_not_in_prerequisite_state then null; end;
  perform public.delete_property_valuation(org,'bd000000-0000-4000-8000-000000000001');
  assert (select current_market_value_cents is null from public.properties where id=prop),'Final deletion must clear current value';
end $$;
reset role;
-- A report can also be the entry point for deletion of a successful valuation.
insert into public.valuations(id,organization_id,property_id,valued_on,market_value_cents,source_type,source_name) values
 ('bd000000-0000-4000-8000-000000000004','bb000000-0000-4000-8000-000000000001','bc000000-0000-4000-8000-000000000001',current_date,30000000,'market_report','Somantic');
insert into public.somantic_valuation_reports(id,organization_id,property_id,valuation_year,status,input,valuation_id) values
 ('be000000-0000-4000-8000-000000000004','bb000000-0000-4000-8000-000000000001','bc000000-0000-4000-8000-000000000001',extract(year from now()),'succeeded','{}','bd000000-0000-4000-8000-000000000004');
set local role authenticated;
select public.delete_property_valuation('bb000000-0000-4000-8000-000000000001',null,'be000000-0000-4000-8000-000000000004');
do $$ begin
  assert not exists(select 1 from public.valuations where id='bd000000-0000-4000-8000-000000000004'),'Report deletion must remove linked valuation';
end $$;
reset role;
select 'Valuation deletion, linked-report cleanup, previous-value fallback, stale-write and organization guards passed' as result;
rollback;
