begin;

-- Delete a report and its projected valuation together, preserving the history
-- of all other requests. The existing valuation trigger restores the prior value.
create function private.delete_property_valuation(
  p_organization_id uuid,
  p_valuation_id uuid default null,
  p_report_id uuid default null,
  p_updated_at timestamptz default null
) returns void language plpgsql security definer set search_path=pg_catalog as $$
declare
  v_property_id uuid;
  v_valuation_id uuid := p_valuation_id;
  report public.somantic_valuation_reports%rowtype;
  record_updated timestamptz;
begin
  if auth.uid() is null or not private.has_org_role(p_organization_id,array['owner','admin','property_manager']::public.app_role[]) then
    raise exception 'Insufficient permission' using errcode='42501';
  end if;
  if num_nonnulls(p_valuation_id,p_report_id)<>1 then
    raise exception 'Choose exactly one valuation or report' using errcode='22023';
  end if;
  if p_report_id is not null then
    select r.property_id into v_property_id from public.somantic_valuation_reports r where r.id=p_report_id and r.organization_id=p_organization_id;
  else
    select v.property_id into v_property_id from public.valuations v where v.id=p_valuation_id and v.organization_id=p_organization_id;
  end if;
  if v_property_id is null then raise exception 'Valuation unavailable' using errcode='P0002'; end if;
  if not private.can_view_property(p_organization_id,v_property_id) then raise exception 'Insufficient permission' using errcode='42501'; end if;

  -- Same property-first lock order as reservation and completion.
  perform 1 from public.properties p where p.id=v_property_id and p.organization_id=p_organization_id for update;
  select r.* into report from public.somantic_valuation_reports r
    where r.organization_id=p_organization_id and r.property_id=v_property_id
      and ((p_report_id is not null and r.id=p_report_id) or (p_valuation_id is not null and r.valuation_id=p_valuation_id)) for update;
  if p_report_id is not null and not found then raise exception 'Report unavailable' using errcode='P0002'; end if;
  if report.status in ('pending','uncertain') then
    raise exception 'Request still in progress or unconfirmed' using errcode='55000';
  end if;
  if p_report_id is not null then v_valuation_id:=report.valuation_id; end if;
  if v_valuation_id is not null then
    select v.updated_at into record_updated from public.valuations v
      where v.id=v_valuation_id and v.organization_id=p_organization_id and v.property_id=v_property_id for update;
    if not found then raise exception 'Valuation unavailable' using errcode='P0002'; end if;
    if p_updated_at is not null and record_updated is distinct from p_updated_at then
      raise exception 'Valuation changed since loading' using errcode='40001';
    end if;
  end if;
  if report.id is not null then
    delete from public.somantic_valuation_reports r where r.id=report.id and r.organization_id=p_organization_id;
  end if;
  if v_valuation_id is not null then
    delete from public.valuations v where v.id=v_valuation_id and v.organization_id=p_organization_id;
  end if;
end $$;
revoke all on function private.delete_property_valuation(uuid,uuid,uuid,timestamptz) from public,anon;
grant execute on function private.delete_property_valuation(uuid,uuid,uuid,timestamptz) to authenticated;
create function public.delete_property_valuation(
  p_organization_id uuid,
  p_valuation_id uuid default null,
  p_report_id uuid default null,
  p_updated_at timestamptz default null
) returns void language sql security invoker set search_path=pg_catalog as $$
  select private.delete_property_valuation(p_organization_id,p_valuation_id,p_report_id,p_updated_at);
$$;
revoke all on function public.delete_property_valuation(uuid,uuid,uuid,timestamptz) from public,anon;
grant execute on function public.delete_property_valuation(uuid,uuid,uuid,timestamptz) to authenticated;
commit;
