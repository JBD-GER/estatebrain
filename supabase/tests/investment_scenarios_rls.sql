-- Transactional integration test; no fixtures remain after execution.
begin;

create temporary table investment_test_context on commit drop as
select gen_random_uuid() as organization_a, gen_random_uuid() as organization_b,
       gen_random_uuid() as owner_id, gen_random_uuid() as foreign_owner_id,
       '{"purchasePriceCents":40000000,"acquisitionCostsCents":4000000,"landShareRate":0.2,"capitalizedMeasuresCents":0,"completionDate":"2000-01-01","acquisitionDate":"2026-07-01","usage":"rented","propertyKind":"existing","marginalTaxRate":0.42,"years":20}'::jsonb as input;
create temporary table investment_test_members on commit drop as
select role::public.app_role as role, gen_random_uuid() as user_id
from (values ('admin'), ('accounting'), ('property_manager'), ('employee'), ('tenant')) as roles(role);

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data)
select owner_id, owner_id::text || '@investment-rls.invalid', '{}'::jsonb, '{}'::jsonb from investment_test_context
union all
select foreign_owner_id, foreign_owner_id::text || '@investment-rls.invalid', '{}'::jsonb, '{}'::jsonb from investment_test_context
union all
select user_id, user_id::text || '@investment-rls.invalid', '{}'::jsonb, '{}'::jsonb from investment_test_members;

select set_config('request.jwt.claims', jsonb_build_object('sub', owner_id, 'role', 'authenticated')::text, true)
from investment_test_context;
insert into public.organizations (id, name, owner_user_id, created_by)
select organization_a, 'Investment RLS A', owner_id, owner_id from investment_test_context
union all
select organization_b, 'Investment RLS B', foreign_owner_id, owner_id from investment_test_context;
insert into public.organization_members (organization_id, user_id, role, status, joined_at, created_by)
select organization_a, owner_id, 'owner'::public.app_role, 'active'::public.membership_status, now(), owner_id from investment_test_context
union all
select organization_b, foreign_owner_id, 'owner'::public.app_role, 'active'::public.membership_status, now(), owner_id from investment_test_context
union all
select organization_a, user_id, role, 'active'::public.membership_status, now(), owner_id from investment_test_context cross join investment_test_members;

-- A real row in the other tenant ensures cross-tenant SELECT/UPDATE/DELETE
-- tests cannot succeed merely because there were no matching rows.
insert into public.investment_scenarios (organization_id, name, input, created_by)
select organization_b, 'Foreign scenario', input, foreign_owner_id from investment_test_context;

grant select on investment_test_context, investment_test_members to authenticated, anon;
set local role authenticated;

do $test$
declare
  context record;
  member record;
  scenario_id uuid;
  affected integer;
begin
  select * into context from investment_test_context;
  insert into public.investment_scenarios (organization_id, name, input, created_by)
    values (context.organization_a, 'Owner scenario', context.input, context.owner_id)
    returning id into scenario_id;
  if (select count(*) from public.investment_scenarios) <> 1 then
    raise exception 'Owner must see exactly the scenario in their organization';
  end if;
  update public.investment_scenarios set selected_method = 'degressive' where id = scenario_id;
  if (select selected_method from public.investment_scenarios where id = scenario_id) <> 'degressive' then
    raise exception 'Owner update was not persisted';
  end if;

  begin
    insert into public.investment_scenarios (organization_id, name, input, created_by)
      values (context.organization_b, 'Forbidden', context.input, context.owner_id);
    raise exception 'Cross-organization insertion was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.investment_scenarios set organization_id = context.organization_b where id = scenario_id;
    raise exception 'Organization reassignment was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.investment_scenarios (organization_id, name, input, created_by)
      values (context.organization_a, 'Forged creator', context.input, context.foreign_owner_id);
    raise exception 'Forged creator was accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.investment_scenarios (organization_id, name, input, created_by)
      values (context.organization_a, 'Oversized', context.input || jsonb_build_object('extra', repeat('x', 17000)), context.owner_id);
    raise exception 'Oversized input was accepted';
  exception when check_violation then null;
  end;

  update public.investment_scenarios set name = 'Forbidden' where organization_id = context.organization_b;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-organization update was accepted'; end if;
  delete from public.investment_scenarios where organization_id = context.organization_b;
  get diagnostics affected = row_count;
  if affected <> 0 then raise exception 'Cross-organization delete was accepted'; end if;

  for member in select * from investment_test_members loop
    perform set_config('request.jwt.claims', jsonb_build_object('sub', member.user_id, 'role', 'authenticated')::text, true);
    if member.role in ('admin', 'accounting') then
      if (select count(*) from public.investment_scenarios) <> 1 then
        raise exception '% must see the shared scenario', member.role;
      end if;
      update public.investment_scenarios set name = member.role::text where id = scenario_id;
      get diagnostics affected = row_count;
      if affected <> 1 then raise exception '% cannot edit the shared scenario', member.role; end if;
      insert into public.investment_scenarios (organization_id, name, input, created_by)
        values (context.organization_a, 'Created by ' || member.role::text, context.input, member.user_id);
      delete from public.investment_scenarios where name = 'Created by ' || member.role::text;
      get diagnostics affected = row_count;
      if affected <> 1 then raise exception '% cannot delete a scenario', member.role; end if;
    else
      if exists (select 1 from public.investment_scenarios) then
        raise exception '% can read tax scenarios', member.role;
      end if;
      begin
        insert into public.investment_scenarios (organization_id, name, input, created_by)
          values (context.organization_a, 'Forbidden', context.input, member.user_id);
        raise exception '% can create tax scenarios', member.role;
      exception when insufficient_privilege then null;
      end;
      update public.investment_scenarios set name = 'Forbidden' where id = scenario_id;
      get diagnostics affected = row_count;
      if affected <> 0 then raise exception '% can update tax scenarios', member.role; end if;
      delete from public.investment_scenarios where id = scenario_id;
      get diagnostics affected = row_count;
      if affected <> 0 then raise exception '% can delete tax scenarios', member.role; end if;
    end if;
  end loop;

  perform set_config('request.jwt.claims', jsonb_build_object('sub', context.foreign_owner_id, 'role', 'authenticated')::text, true);
  if (select count(*) from public.investment_scenarios) <> 1 or
     (select name from public.investment_scenarios) <> 'Foreign scenario' then
    raise exception 'Foreign owner sees another organization';
  end if;
end
$test$;

set local role anon;
do $test$
begin
  begin
    perform 1 from public.investment_scenarios;
    raise exception 'Anonymous users can read tax scenarios';
  exception when insufficient_privilege then null;
  end;
end
$test$;

reset role;
select 'investment_scenarios: role isolation, CRUD, organization scope, grants and size constraints passed' as result;
rollback;
