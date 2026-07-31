-- Keep the valuation history and the property-level market value projection in
-- one transaction. Dashboard and portfolio KPIs read the projection from
-- properties.current_market_value_cents, while the market module reads the
-- detailed history from valuations.

begin;

create or replace function public.create_valuation(
  p_organization_id uuid,
  p_property_id uuid,
  p_valued_on date,
  p_market_value_cents bigint,
  p_source_type text,
  p_source_name text
)
returns uuid
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_valuation_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Serializing by property prevents two concurrent valuations from leaving
  -- the denormalized current value behind the latest history row.
  perform 1
    from public.properties as property_row
   where property_row.organization_id = p_organization_id
     and property_row.id = p_property_id
   for update;

  if not found then
    raise exception 'Property not found or inaccessible' using errcode = 'P0002';
  end if;

  insert into public.valuations (
    organization_id,
    property_id,
    valued_on,
    market_value_cents,
    source_type,
    source_name,
    created_by
  )
  values (
    p_organization_id,
    p_property_id,
    p_valued_on,
    p_market_value_cents,
    p_source_type,
    nullif(trim(p_source_name), ''),
    v_user_id
  )
  returning id into v_valuation_id;

  update public.properties as property_row
     set current_market_value_cents = (
      select valuation_row.market_value_cents
        from public.valuations as valuation_row
       where valuation_row.organization_id = p_organization_id
         and valuation_row.property_id = p_property_id
       order by
         valuation_row.valued_on desc,
         valuation_row.created_at desc,
         valuation_row.id desc
       limit 1
    )
   where property_row.organization_id = p_organization_id
     and property_row.id = p_property_id;

  if not found then
    raise exception 'Property market value could not be updated'
      using errcode = 'P0002';
  end if;

  return v_valuation_id;
end
$$;

revoke all on function public.create_valuation(
  uuid,
  uuid,
  date,
  bigint,
  text,
  text
) from public, anon, authenticated;

grant execute on function public.create_valuation(
  uuid,
  uuid,
  date,
  bigint,
  text,
  text
) to authenticated, service_role;

comment on function public.create_valuation(
  uuid,
  uuid,
  date,
  bigint,
  text,
  text
) is
  'Atomically appends a valuation and refreshes the property market-value projection from the latest dated valuation.';

commit;
