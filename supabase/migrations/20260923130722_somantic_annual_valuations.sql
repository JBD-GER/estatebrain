begin;
alter table public.properties add column valuation_details jsonb not null default '{}'::jsonb check (jsonb_typeof(valuation_details)='object');
create table public.somantic_valuation_reports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete restrict,
  valuation_year integer not null check (valuation_year between 2000 and 9999),
  status text not null check (status in ('pending','succeeded','insufficient','failed','uncertain')),
  input jsonb not null check (jsonb_typeof(input)='object'),
  response jsonb,
  error_message text,
  valuation_id uuid references public.valuations(id) on delete set null,
  requested_by uuid references auth.users(id) on delete set null,
  requested_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(property_id,valuation_year)
);
create index somantic_reports_org_idx on public.somantic_valuation_reports(organization_id);
create index somantic_reports_valuation_idx on public.somantic_valuation_reports(valuation_id);
create index somantic_reports_requester_idx on public.somantic_valuation_reports(requested_by);
alter table public.somantic_valuation_reports enable row level security;
revoke all on public.somantic_valuation_reports from anon,authenticated;
grant select on public.somantic_valuation_reports to authenticated;
grant all on public.somantic_valuation_reports to service_role;
create policy somantic_reports_read on public.somantic_valuation_reports for select to authenticated using (private.can_view_property(organization_id,property_id));

-- The quota is reserved under a property lock BEFORE the external request.
-- Neither deleting a projected valuation nor changing its date releases it.
create function private.reserve_somantic_valuation(p_organization_id uuid,p_property_id uuid,p_input jsonb)
returns uuid language plpgsql security definer set search_path=pg_catalog as $$
declare p public.properties%rowtype; r public.somantic_valuation_reports%rowtype; y integer := extract(year from now() at time zone 'Europe/Berlin'); result uuid;
begin
  if auth.uid() is null or not private.has_org_role(p_organization_id,array['owner','admin','property_manager']::public.app_role[])
    or not private.can_view_property(p_organization_id,p_property_id) then raise exception 'Insufficient permission' using errcode='42501'; end if;
  select * into p from public.properties where id=p_property_id and organization_id=p_organization_id and archived_at is null for update;
  if not found then raise exception 'Property unavailable' using errcode='P0002'; end if;
  if p.country_code<>'DE' then raise exception 'Only German properties supported' using errcode='22023'; end if;
  if jsonb_typeof(p_input)<>'object' or coalesce(p_input->>'typ','') not in ('haus','wohnung')
    or length(coalesce(p_input->>'street',''))<3 or coalesce(p_input->>'postcode','') !~ '^\d{5}$'
    or length(coalesce(p_input->>'city',''))<2 or coalesce((p_input->>'square_meters')::numeric,0)<=0 then
    raise exception 'Incomplete property data' using errcode='22023';
  end if;
  select * into r from public.somantic_valuation_reports where property_id=p.id and valuation_year=y for update;
  if found then
    if r.status<>'failed' then raise exception 'Annual valuation already reserved' using errcode='23505'; end if;
    if r.requested_at > now()-interval '1 minute' then raise exception 'Please wait before retrying' using errcode='55P03'; end if;
    update public.somantic_valuation_reports set status='pending',input=p_input,response=null,error_message=null,requested_at=now(),completed_at=null,requested_by=auth.uid() where id=r.id;
    result:=r.id;
  else
    insert into public.somantic_valuation_reports(organization_id,property_id,valuation_year,status,input,requested_by)
    values(p_organization_id,p.id,y,'pending',p_input,auth.uid()) returning id into result;
  end if;
  update public.properties set valuation_details=p_input where id=p.id;
  return result;
end $$;
revoke all on function private.reserve_somantic_valuation(uuid,uuid,jsonb) from public,anon;
grant execute on function private.reserve_somantic_valuation(uuid,uuid,jsonb) to authenticated;
create function public.reserve_somantic_valuation(p_organization_id uuid,p_property_id uuid,p_input jsonb)
returns uuid language sql security invoker set search_path=pg_catalog as $$ select private.reserve_somantic_valuation(p_organization_id,p_property_id,p_input); $$;
revoke all on function public.reserve_somantic_valuation(uuid,uuid,jsonb) from public,anon;
grant execute on function public.reserve_somantic_valuation(uuid,uuid,jsonb) to authenticated;

-- Only the trusted server can persist provider responses and change market value.
create function public.finish_somantic_valuation(p_report_id uuid,p_response jsonb)
returns uuid language plpgsql security invoker set search_path=pg_catalog as $$
declare r public.somantic_valuation_reports%rowtype; v uuid; price numeric;
begin
  -- Same property-first lock order as the existing valuation projection triggers.
  perform 1 from public.properties where id=(select property_id from public.somantic_valuation_reports where id=p_report_id) for update;
  select * into r from public.somantic_valuation_reports where id=p_report_id for update;
  if not found then raise exception 'Report unavailable' using errcode='P0002'; end if;
  if r.status in ('succeeded','insufficient') then return r.id; end if;
  if r.status not in ('pending','uncertain') then raise exception 'Report not pending' using errcode='23514'; end if;
  price := (p_response->'estimates'->>'price')::numeric;
  if price>0 then
    insert into public.valuations(organization_id,property_id,valued_on,market_value_cents,source_type,source_name,source_url,assumptions,created_by)
    values(r.organization_id,r.property_id,(r.requested_at at time zone 'Europe/Berlin')::date,round(price*100)::bigint,'market_report','Somantic','https://www.somantic.net/developers/docs',jsonb_build_object('somantic_report_id',r.id,'input',r.input,'response',p_response),r.requested_by) returning id into v;
  end if;
  update public.somantic_valuation_reports set response=p_response,valuation_id=v,status=case when price>0 then 'succeeded' else 'insufficient' end,completed_at=now(),error_message=null where id=r.id;
  return r.id;
end $$;
revoke all on function public.finish_somantic_valuation(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.finish_somantic_valuation(uuid,jsonb) to service_role;
commit;
