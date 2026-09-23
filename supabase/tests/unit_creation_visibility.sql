-- Reproduce the UI's INSERT ... RETURNING under real RLS. All data rolls back.
begin;
insert into auth.users(id,email,raw_app_meta_data,raw_user_meta_data)
select ('ca000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'unit-visibility-'||n||'@estatebrain.test','{}','{}' from generate_series(1,7) n;
insert into public.organizations(id,name,kind,owner_user_id) values
 ('cb000000-0000-4000-8000-000000000001','Unit visibility test','private_person','ca000000-0000-4000-8000-000000000001'),
 ('cb000000-0000-4000-8000-000000000002','Other unit visibility test','private_person','ca000000-0000-4000-8000-000000000007');
insert into public.organization_members(id,organization_id,user_id,role,status,joined_at)
select ('ce000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 (case when n=7 then 'cb000000-0000-4000-8000-000000000002' else 'cb000000-0000-4000-8000-000000000001' end)::uuid,
 ('ca000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,
 (array['owner','admin','property_manager','accounting','employee','tenant','owner'])[n]::public.app_role,'active',now() from generate_series(1,7) n;
insert into public.properties(id,organization_id,name,street,postal_code,city,property_type) values
 ('cc000000-0000-4000-8000-000000000001','cb000000-0000-4000-8000-000000000001','Assigned property','Teststraße 1','10115','Berlin','apartment_building'),
 ('cc000000-0000-4000-8000-000000000002','cb000000-0000-4000-8000-000000000001','Unassigned property','Teststraße 2','10115','Berlin','apartment_building'),
 ('cc000000-0000-4000-8000-000000000003','cb000000-0000-4000-8000-000000000002','Other organization','Teststraße 3','10115','Berlin','apartment_building');
insert into public.units(id,organization_id,property_id,unit_number,area_sqm) values
 ('cd000000-0000-4000-8000-000000000001','cb000000-0000-4000-8000-000000000001','cc000000-0000-4000-8000-000000000001','Rented fixture',60),
 ('cd000000-0000-4000-8000-000000000002','cb000000-0000-4000-8000-000000000001','cc000000-0000-4000-8000-000000000002','Unassigned fixture',60),
 ('cd000000-0000-4000-8000-000000000003','cb000000-0000-4000-8000-000000000002','cc000000-0000-4000-8000-000000000003','Foreign fixture',60);
insert into public.property_assignments(organization_id,property_id,member_id) values
 ('cb000000-0000-4000-8000-000000000001','cc000000-0000-4000-8000-000000000001','ce000000-0000-4000-8000-000000000005');
insert into public.tenants(id,organization_id,first_name,last_name) values
 ('cf000000-0000-4000-8000-000000000001','cb000000-0000-4000-8000-000000000001','QA','Tenant');
insert into public.tenant_users(organization_id,tenant_id,user_id,is_primary,verified_at) values
 ('cb000000-0000-4000-8000-000000000001','cf000000-0000-4000-8000-000000000001','ca000000-0000-4000-8000-000000000006',true,now());
insert into public.leases(id,organization_id,unit_id,starts_on,cold_rent_cents,status) values
 ('da000000-0000-4000-8000-000000000001','cb000000-0000-4000-8000-000000000001','cd000000-0000-4000-8000-000000000001',current_date,50000,'active');
insert into public.lease_tenants(organization_id,lease_id,tenant_id,is_primary,occupancy_starts_on) values
 ('cb000000-0000-4000-8000-000000000001','da000000-0000-4000-8000-000000000001','cf000000-0000-4000-8000-000000000001',true,current_date);
set local role authenticated;
do $$
declare actor uuid; unit_id uuid; updated_id uuid; org uuid:='cb000000-0000-4000-8000-000000000001'; prop uuid:='cc000000-0000-4000-8000-000000000001';
begin
  for n in 1..3 loop
    actor:=('ca000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
    perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
    insert into public.units(organization_id,property_id,unit_number,area_sqm,target_cold_rent_cents,ancillary_charge_type)
      values(org,prop,'Created by role '||n,70,60000,'advance') returning id into unit_id;
    assert unit_id is not null,'Creation must return the inserted ID';
    assert exists(select 1 from public.units where id=unit_id),'Saved unit must be readable';
    update public.units set area_sqm=75 where id=unit_id returning id into updated_id;
    assert updated_id=unit_id,'Created unit must also be editable';
    assert not exists(select 1 from public.units where organization_id='cb000000-0000-4000-8000-000000000002'),'Foreign units must remain hidden';
    begin
      insert into public.units(organization_id,property_id,unit_number,area_sqm)
        values('cb000000-0000-4000-8000-000000000002','cc000000-0000-4000-8000-000000000003','Forbidden',70) returning id into unit_id;
      raise exception 'Foreign organization insert must be denied';
    exception when insufficient_privilege then null; end;
  end loop;
  assert (select unit_count=4 and expected_monthly_rent_cents=180000 from public.properties where id=prop),'Property projection must include saved units';
  for n in 4..6 loop
    actor:=('ca000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid;
    perform set_config('request.jwt.claims',jsonb_build_object('sub',actor,'role','authenticated')::text,true);
    begin
      insert into public.units(organization_id,property_id,unit_number,area_sqm)
        values(org,prop,'Forbidden role '||n,70) returning id into unit_id;
      raise exception 'Read-only role must not create units';
    exception when insufficient_privilege then null; end;
    assert (select count(*) = case n when 4 then 5 when 5 then 4 else 1 end from public.units),'Role visibility broadened unexpectedly';
  end loop;
  assert exists(select 1 from public.units where id='cd000000-0000-4000-8000-000000000001'),'Tenant must still see their rented unit';
end $$;
reset role;
select 'Unit INSERT RETURNING and editing work for owner/admin/property_manager; cross-org, read-only, employee and tenant scopes preserved' as result;
rollback;
