begin;

-- Keep every completed report, but allow another valuation in the same year.
alter table public.somantic_valuation_reports
  drop constraint somantic_valuation_reports_property_id_valuation_year_key;
create index somantic_reports_property_history_idx
  on public.somantic_valuation_reports(property_id,requested_at desc);
create unique index somantic_reports_one_active_request_idx
  on public.somantic_valuation_reports(property_id)
  where status in ('pending','uncertain');

create or replace function private.reserve_somantic_valuation(p_organization_id uuid,p_property_id uuid,p_input jsonb)
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

  -- Serialize external requests across all years; unresolved calls may already be billed.
  if exists(select 1 from public.somantic_valuation_reports where property_id=p.id and status in ('pending','uncertain')) then
    raise exception 'A valuation request is already in progress or awaiting confirmation' using errcode='23505';
  end if;
  select * into r from public.somantic_valuation_reports where property_id=p.id order by requested_at desc,id desc limit 1;
  if found and r.status='failed' and r.requested_at > now()-interval '1 minute' then
    raise exception 'Please wait before retrying' using errcode='55P03';
  end if;

  insert into public.somantic_valuation_reports(organization_id,property_id,valuation_year,status,input,requested_by)
  values(p_organization_id,p.id,y,'pending',p_input,auth.uid()) returning id into result;
  update public.properties set valuation_details=p_input where id=p.id;
  return result;
end $$;
revoke all on function private.reserve_somantic_valuation(uuid,uuid,jsonb) from public,anon;
grant execute on function private.reserve_somantic_valuation(uuid,uuid,jsonb) to authenticated;

commit;
