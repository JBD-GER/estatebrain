-- General acquisition costs must be allocated to land AND building. The land
-- portion, including its ancillary costs, is not depreciable. This migration
-- corrects future automatic calculations without rewriting any saved assets
-- or historical/manual tax-return amounts.
begin;

create or replace function private.property_building_basis_cents_v3(
  p_purchase_price_cents bigint,
  p_acquisition_costs_cents bigint,
  p_land_purchase_value_cents bigint
)
returns bigint
language plpgsql
immutable
parallel safe
security invoker
set search_path = pg_catalog
as $$
begin
  if p_purchase_price_cents is null
     or p_acquisition_costs_cents is null
     or p_land_purchase_value_cents is null
     or p_purchase_price_cents < 0
     or p_acquisition_costs_cents < 0
     or p_land_purchase_value_cents < 0
     or p_land_purchase_value_cents > p_purchase_price_cents then
    raise exception 'Valid purchase price, acquisition costs and allocated land value are required'
      using errcode = '22023';
  end if;
  if p_purchase_price_cents = 0 then
    if p_acquisition_costs_cents > 0 then
      raise exception 'A positive purchase price is required to allocate acquisition costs'
        using errcode = '22023';
    end if;
    return 0;
  end if;
  return (
    p_purchase_price_cents::numeric + p_acquisition_costs_cents
    - p_land_purchase_value_cents
    - round(
      p_acquisition_costs_cents::numeric * p_land_purchase_value_cents
      / p_purchase_price_cents
    )
  )::bigint;
end
$$;

revoke all on function private.property_building_basis_cents_v3(bigint, bigint, bigint)
  from public, anon, authenticated, service_role;

-- Keep the already-hardened, 1,000-line transaction and its ACL unchanged.
-- Guard each exact replacement, so an unexpected definition aborts the whole
-- migration instead of silently replacing unrelated validation or auth logic.
do $patch$
declare
  v_definition text := pg_get_functiondef('public.finalize_onboarding_v2(uuid,jsonb)'::regprocedure);
  v_old text;
  v_new text;
begin
  v_old := E'  v_building_value_cents :=\n    v_total_acquisition_cost_cents - v_land_value_cents;';
  v_new := E'  v_building_value_cents :=\n    private.property_building_basis_cents_v3(\n      v_purchase_price_cents,\n      v_acquisition_costs_cents,\n      v_land_value_cents\n    );';
  if position(v_old in v_definition) = 0 then
    raise exception 'Unexpected onboarding definition: building basis expression not found';
  end if;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := E'      v_total_acquisition_cost_cents,\n      v_land_value_cents,\n      v_building_value_cents,';
  v_new := E'      v_total_acquisition_cost_cents,\n      v_total_acquisition_cost_cents - v_building_value_cents,\n      v_building_value_cents,';
  if position(v_old in v_definition) = 0 then
    raise exception 'Unexpected onboarding definition: asset insert allocation not found';
  end if;
  v_definition := replace(v_definition, v_old, v_new);

  v_old := '           land_share_cents = v_land_value_cents,';
  v_new := '           land_share_cents = v_total_acquisition_cost_cents - v_building_value_cents,';
  if position(v_old in v_definition) = 0 then
    raise exception 'Unexpected onboarding definition: asset update allocation not found';
  end if;
  v_definition := replace(v_definition, v_old, v_new);
  v_definition := replace(v_definition,
    'Lineare Gebäude-AfA aus Baujahr und modellierter Gebäudebasis; Regelstand Onboarding v2.',
    'Lineare Gebäude-AfA aus Baujahr und Gebäudekaufpreis zuzüglich anteiliger Gebäudenebenkosten; Grundstücksnebenkosten nicht abschreibbar.');
  execute v_definition;
end
$patch$;

create or replace function private.initialize_property_models_v2()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_tax_year_id uuid;
  v_annual_rate numeric(7,6);
  v_building_basis_cents bigint;
  v_total_acquisition_cents bigint;
begin
  if new.market_value_status <> 'estimated'
     or new.market_value_source <> 'purchase_price_proxy'
     or new.current_market_value_cents is null then
    return new;
  end if;

  insert into public.valuations (
    organization_id, property_id, valued_on, market_value_cents,
    source_type, source_name, confidence, assumptions, created_by
  ) values (
    new.organization_id, new.id, current_date, new.current_market_value_cents,
    'purchase_price_proxy', 'Startschätzung auf Basis des Kaufpreises', 0.25,
    jsonb_build_object(
      'propertyCreationV2', true,
      'method', 'purchase_price_proxy',
      'note', 'Unverbindlicher Startwert; aktuelle Marktwertermittlung ausstehend.'
    ),
    new.created_by
  );

  if new.purchase_date is null
     or new.construction_year is null
     or new.purchase_price_cents is null
     or new.purchase_price_cents <= 0
     or new.land_value_cents is null then
    return new;
  end if;

  -- Derive the asset basis server-side, independently of client-supplied
  -- building_value_cents. The latter is also correctly allocated by the app.
  v_building_basis_cents := private.property_building_basis_cents_v3(
    new.purchase_price_cents,
    new.acquisition_costs_cents,
    new.land_value_cents
  );
  if v_building_basis_cents <= 0 then
    return new;
  end if;
  v_total_acquisition_cents := new.purchase_price_cents + new.acquisition_costs_cents;

  select tax_year_row.id into v_tax_year_id
    from public.tax_years as tax_year_row
   where tax_year_row.organization_id = new.organization_id
   order by (tax_year_row.year = extract(year from current_date)::integer) desc,
     tax_year_row.year desc
   limit 1;

  v_annual_rate := case
    when new.property_type = 'commercial' and new.construction_year > 1985 then 0.03
    when new.property_type = 'commercial' then 0.025
    when new.construction_year >= 2023 then 0.03
    when new.construction_year >= 1925 then 0.02
    else 0.025
  end;

  insert into public.depreciation_assets (
    organization_id, property_id, tax_year_id, name, asset_type,
    acquisition_date, use_start_date, acquisition_cost_cents,
    land_share_cents, depreciable_basis_cents, annual_rate,
    manual_adjustment_cents, calculation_method, source_type,
    basis_as_of, manual_annual_depreciation_cents, explanation, created_by
  ) values (
    new.organization_id, new.id, v_tax_year_id,
    'Gebäude-AfA (Immobilienanlage v2)', 'building',
    new.purchase_date, new.purchase_date, v_total_acquisition_cents,
    v_total_acquisition_cents - v_building_basis_cents,
    v_building_basis_cents, v_annual_rate, 0,
    'straight_line', 'calculated', new.purchase_date, null,
    'Lineare Gebäude-AfA aus Baujahr und Gebäudekaufpreis zuzüglich anteiliger Gebäudenebenkosten; Grundstücksnebenkosten nicht abschreibbar. Bei Bestandsobjekten mit der Steuererklärung abgleichen.',
    new.created_by
  );
  return new;
end
$$;

revoke all on function private.initialize_property_models_v2()
  from public, anon, authenticated, service_role;

comment on function private.property_building_basis_cents_v3(bigint, bigint, bigint) is
  'Internal pure cost allocation: building purchase price plus proportional ancillary costs, excluding all land costs.';
comment on column public.properties.building_value_cents is
  'Automatically calculated building purchase price plus proportional building acquisition costs. Historical/manual entries are retained and require review; this is not a market valuation.';

do $verify$
begin
  if private.property_building_basis_cents_v3(50000000, 5785000, 16000000) <> 37933800
     or private.property_building_basis_cents_v3(30000000, 3600000, 2500000) <> 30800000
     or private.property_building_basis_cents_v3(10000000, 1100000, 10000000) <> 0
     or private.property_building_basis_cents_v3(3, 2, 1) <> 3 then
    raise exception 'Acquisition cost allocation reference check failed';
  end if;
end
$verify$;

commit;
