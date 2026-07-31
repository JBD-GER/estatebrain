-- Keep the public onboarding boundary as strict as the application schema and
-- let owners who deliberately started empty resume the guided portfolio setup.

create or replace function public.complete_onboarding(p_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_existing_organization_id uuid;
  v_organization_id uuid;
  v_setup_mode text := coalesce(p_payload ->> 'setupMode', 'portfolio');
  v_unit jsonb;
  v_lease_start_text text;
  v_lease_start date;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'A permanent account is required' using errcode = '42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Onboarding payload must be an object'
      using errcode = '22023';
  end if;
  if v_setup_mode not in ('portfolio', 'empty') then
    raise exception 'Invalid setup mode' using errcode = '22023';
  end if;

  perform 1
    from public.profiles
   where id = v_user_id
   for update;
  if not found then
    raise exception 'Profile not found' using errcode = '23503';
  end if;

  select om.organization_id
    into v_existing_organization_id
    from public.organization_members as om
   where om.user_id = v_user_id
     and om.status = 'active'
   order by om.created_at
   limit 1;

  if v_existing_organization_id is not null then
    return v_existing_organization_id;
  end if;

  if v_setup_mode = 'portfolio' then
    if jsonb_typeof(p_payload -> 'units') is distinct from 'array'
       or jsonb_array_length(p_payload -> 'units') not between 1 and 100 then
      raise exception 'Between one and one hundred units are required'
        using errcode = '22023';
    end if;

    for v_unit in
      select value from jsonb_array_elements(p_payload -> 'units')
    loop
      if v_unit ->> 'status' = 'occupied' then
        v_lease_start_text :=
          nullif(trim(coalesce(v_unit ->> 'leaseStart', '')), '');
        if v_lease_start_text is null
           or v_lease_start_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
          raise exception 'Occupied units require a valid lease start'
            using errcode = '22023';
        end if;
        begin
          v_lease_start := v_lease_start_text::date;
        exception
          when others then
            raise exception 'Occupied units require a valid lease start'
              using errcode = '22023';
        end;
      end if;
    end loop;

    p_payload := jsonb_set(
      p_payload,
      '{property,unitCount}',
      to_jsonb(jsonb_array_length(p_payload -> 'units')),
      true
    );

    return private.complete_portfolio_onboarding_v1(p_payload);
  end if;

  if coalesce(p_payload ->> 'importMode', 'none') <> 'none' then
    raise exception 'Empty setup cannot import sample data'
      using errcode = '22023';
  end if;
  if jsonb_typeof(p_payload -> 'organization') is distinct from 'object'
     or jsonb_typeof(p_payload -> 'tax') is distinct from 'object' then
    raise exception 'Organization and tax settings are required'
      using errcode = '22023';
  end if;

  v_organization_id := public.create_organization_with_owner(
    p_payload #>> '{organization,name}',
    case p_payload #>> '{organization,organizationType}'
      when 'private' then 'private_person'
      when 'company' then 'company'
      else null
    end,
    jsonb_build_object(
      'street', p_payload #>> '{organization,street}',
      'postal_code', p_payload #>> '{organization,postalCode}',
      'city', p_payload #>> '{organization,city}',
      'country_code', 'DE'
    ),
    coalesce(p_payload #>> '{organization,currency}', 'EUR'),
    (p_payload #>> '{organization,taxYear}')::integer
  );

  insert into public.tax_profiles (
    organization_id,
    user_id,
    marginal_tax_rate,
    effective_tax_rate,
    church_tax_enabled,
    solidarity_surcharge_enabled,
    assumed_taxable_income_cents,
    assessment_type,
    calculations_enabled,
    created_by
  )
  values (
    v_organization_id,
    v_user_id,
    (nullif(p_payload #>> '{tax,marginalTaxRate}', '')::numeric / 100),
    (nullif(p_payload #>> '{tax,effectiveTaxRate}', '')::numeric / 100),
    coalesce((p_payload #>> '{tax,churchTax}')::boolean, false),
    coalesce((p_payload #>> '{tax,solidaritySurcharge}')::boolean, false),
    case
      when nullif(p_payload #>> '{tax,taxableIncome}', '') is null then null
      else round((p_payload #>> '{tax,taxableIncome}')::numeric * 100)::bigint
    end,
    case p_payload #>> '{tax,filingStatus}'
      when 'joint' then 'joint'
      else 'individual'
    end,
    coalesce((p_payload #>> '{tax,calculationsEnabled}')::boolean, true),
    v_user_id
  );

  update public.profiles
     set onboarding_completed_at = coalesce(onboarding_completed_at, now())
   where id = v_user_id;

  return v_organization_id;
end
$$;

create or replace function public.resume_portfolio_onboarding(
  p_organization_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_organization_id uuid;
  v_kind public.organization_kind;
  v_property_id uuid;
  v_unit_id uuid;
  v_lease_id uuid;
  v_unit jsonb;
  v_unit_status text;
  v_unit_counter integer := 0;
  v_lease_start_text text;
  v_lease_start date;
  v_financing_cents bigint;
  v_import_mode text := coalesce(p_payload ->> 'importMode', 'none');
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'A permanent account is required' using errcode = '42501';
  end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Onboarding payload must be an object'
      using errcode = '22023';
  end if;
  if jsonb_typeof(p_payload -> 'organization') is distinct from 'object'
     or jsonb_typeof(p_payload -> 'tax') is distinct from 'object'
     or jsonb_typeof(p_payload -> 'property') is distinct from 'object'
     or jsonb_typeof(p_payload -> 'units') is distinct from 'array'
     or jsonb_array_length(p_payload -> 'units') not between 1 and 100 then
    raise exception 'Complete onboarding sections are required'
      using errcode = '22023';
  end if;
  if v_import_mode not in ('none', 'demo') then
    raise exception 'Invalid import mode' using errcode = '22023';
  end if;

  select organization_row.id
    into v_organization_id
    from public.organizations as organization_row
    join public.organization_members as member_row
      on member_row.organization_id = organization_row.id
   where organization_row.id = p_organization_id
     and organization_row.archived_at is null
     and member_row.user_id = v_user_id
     and member_row.role = 'owner'
     and member_row.status = 'active'
   for update of organization_row, member_row;

  if v_organization_id is null then
    raise exception 'Owned organization not found' using errcode = '42501';
  end if;

  -- The organization row lock makes retries safe. If the first request
  -- committed but its response was lost, do not create a second property.
  if exists (
    select 1
      from public.properties as property_row
     where property_row.organization_id = v_organization_id
  ) then
    return v_organization_id;
  end if;

  for v_unit in
    select value from jsonb_array_elements(p_payload -> 'units')
  loop
    if v_unit ->> 'status' = 'occupied' then
      v_lease_start_text :=
        nullif(trim(coalesce(v_unit ->> 'leaseStart', '')), '');
      if v_lease_start_text is null
         or v_lease_start_text !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
        raise exception 'Occupied units require a valid lease start'
          using errcode = '22023';
      end if;
      begin
        v_lease_start := v_lease_start_text::date;
      exception
        when others then
          raise exception 'Occupied units require a valid lease start'
            using errcode = '22023';
      end;
    end if;
  end loop;

  v_kind := case p_payload #>> '{organization,organizationType}'
    when 'private' then 'private_person'::public.organization_kind
    when 'company' then 'company'::public.organization_kind
    else null
  end;
  if v_kind is null then
    raise exception 'Invalid organization type' using errcode = '22023';
  end if;

  update public.organizations
     set name = trim(p_payload #>> '{organization,name}'),
         kind = v_kind,
         street = nullif(trim(coalesce(
           p_payload #>> '{organization,street}',
           ''
         )), ''),
         postal_code = nullif(trim(coalesce(
           p_payload #>> '{organization,postalCode}',
           ''
         )), ''),
         city = nullif(trim(coalesce(
           p_payload #>> '{organization,city}',
           ''
         )), ''),
         default_currency =
           coalesce(p_payload #>> '{organization,currency}', 'EUR')
   where id = v_organization_id;

  insert into public.tax_profiles (
    organization_id,
    user_id,
    marginal_tax_rate,
    effective_tax_rate,
    church_tax_enabled,
    solidarity_surcharge_enabled,
    assumed_taxable_income_cents,
    assessment_type,
    calculations_enabled,
    created_by
  )
  values (
    v_organization_id,
    v_user_id,
    (nullif(p_payload #>> '{tax,marginalTaxRate}', '')::numeric / 100),
    (nullif(p_payload #>> '{tax,effectiveTaxRate}', '')::numeric / 100),
    coalesce((p_payload #>> '{tax,churchTax}')::boolean, false),
    coalesce((p_payload #>> '{tax,solidaritySurcharge}')::boolean, false),
    case
      when nullif(p_payload #>> '{tax,taxableIncome}', '') is null then null
      else round((p_payload #>> '{tax,taxableIncome}')::numeric * 100)::bigint
    end,
    case p_payload #>> '{tax,filingStatus}'
      when 'joint' then 'joint'
      else 'individual'
    end,
    coalesce((p_payload #>> '{tax,calculationsEnabled}')::boolean, true),
    v_user_id
  )
  on conflict (organization_id, user_id) do update
    set marginal_tax_rate = excluded.marginal_tax_rate,
        effective_tax_rate = excluded.effective_tax_rate,
        church_tax_enabled = excluded.church_tax_enabled,
        solidarity_surcharge_enabled =
          excluded.solidarity_surcharge_enabled,
        assumed_taxable_income_cents =
          excluded.assumed_taxable_income_cents,
        assessment_type = excluded.assessment_type,
        calculations_enabled = excluded.calculations_enabled;

  insert into public.tax_years (
    organization_id,
    year,
    created_by
  )
  values (
    v_organization_id,
    (p_payload #>> '{organization,taxYear}')::integer,
    v_user_id
  )
  on conflict (organization_id, year) do nothing;

  insert into public.properties (
    organization_id,
    name,
    property_type,
    street,
    postal_code,
    city,
    country_code,
    purchase_date,
    purchase_price_cents,
    acquisition_costs_cents,
    land_value_cents,
    building_value_cents,
    total_area_sqm,
    rentable_area_sqm,
    current_market_value_cents,
    expected_monthly_rent_cents,
    unit_count,
    created_by
  )
  values (
    v_organization_id,
    p_payload #>> '{property,name}',
    p_payload #>> '{property,propertyType}',
    p_payload #>> '{property,street}',
    p_payload #>> '{property,postalCode}',
    p_payload #>> '{property,city}',
    'DE',
    nullif(p_payload #>> '{property,purchaseDate}', '')::date,
    round(coalesce(
      (p_payload #>> '{property,purchasePrice}')::numeric,
      0
    ) * 100)::bigint,
    round(coalesce(
      (p_payload #>> '{property,acquisitionCosts}')::numeric,
      0
    ) * 100)::bigint,
    round(coalesce(
      (p_payload #>> '{property,landValue}')::numeric,
      0
    ) * 100)::bigint,
    round(coalesce(
      (p_payload #>> '{property,buildingValue}')::numeric,
      0
    ) * 100)::bigint,
    (p_payload #>> '{property,totalArea}')::numeric,
    (p_payload #>> '{property,totalArea}')::numeric,
    round(coalesce(
      (p_payload #>> '{property,marketValue}')::numeric,
      0
    ) * 100)::bigint,
    round(coalesce(
      (p_payload #>> '{property,expectedMonthlyRent}')::numeric,
      0
    ) * 100)::bigint,
    jsonb_array_length(p_payload -> 'units'),
    v_user_id
  )
  returning id into v_property_id;

  for v_unit in
    select value from jsonb_array_elements(p_payload -> 'units')
  loop
    v_unit_counter := v_unit_counter + 1;
    v_unit_status := case v_unit ->> 'status'
      when 'occupied' then 'rented'
      when 'vacant' then 'vacant'
      when 'renovation' then 'renovation'
      else null
    end;

    if v_unit_status is null then
      raise exception 'Invalid unit status at position %', v_unit_counter
        using errcode = '22023';
    end if;

    insert into public.units (
      organization_id,
      property_id,
      unit_number,
      floor,
      area_sqm,
      rooms,
      target_cold_rent_cents,
      ancillary_prepayment_cents,
      parking_rent_cents,
      status,
      created_by
    )
    values (
      v_organization_id,
      v_property_id,
      v_unit ->> 'unitNumber',
      nullif(trim(coalesce(v_unit ->> 'floor', '')), ''),
      (v_unit ->> 'area')::numeric,
      (v_unit ->> 'rooms')::numeric,
      round(coalesce((v_unit ->> 'baseRent')::numeric, 0) * 100)::bigint,
      round(coalesce(
        (v_unit ->> 'serviceCharge')::numeric,
        0
      ) * 100)::bigint,
      round(coalesce(
        (v_unit ->> 'parkingRent')::numeric,
        0
      ) * 100)::bigint,
      v_unit_status,
      v_user_id
    )
    returning id into v_unit_id;

    if v_unit ->> 'status' = 'occupied' then
      v_lease_start := (v_unit ->> 'leaseStart')::date;

      insert into public.leases (
        organization_id,
        unit_id,
        lease_number,
        starts_on,
        cold_rent_cents,
        ancillary_prepayment_cents,
        parking_rent_cents,
        status,
        created_by
      )
      values (
        v_organization_id,
        v_unit_id,
        'ONB-' || lpad(v_unit_counter::text, 3, '0'),
        v_lease_start,
        round(coalesce((v_unit ->> 'baseRent')::numeric, 0) * 100)::bigint,
        round(coalesce(
          (v_unit ->> 'serviceCharge')::numeric,
          0
        ) * 100)::bigint,
        round(coalesce(
          (v_unit ->> 'parkingRent')::numeric,
          0
        ) * 100)::bigint,
        'active',
        v_user_id
      )
      returning id into v_lease_id;

      insert into public.rent_schedules (
        organization_id,
        lease_id,
        valid_from,
        due_day,
        cold_rent_cents,
        ancillary_prepayment_cents,
        parking_rent_cents,
        created_by
      )
      values (
        v_organization_id,
        v_lease_id,
        v_lease_start,
        3,
        round(coalesce((v_unit ->> 'baseRent')::numeric, 0) * 100)::bigint,
        round(coalesce(
          (v_unit ->> 'serviceCharge')::numeric,
          0
        ) * 100)::bigint,
        round(coalesce(
          (v_unit ->> 'parkingRent')::numeric,
          0
        ) * 100)::bigint,
        v_user_id
      );
    end if;
  end loop;

  v_financing_cents :=
    round(coalesce(
      (p_payload #>> '{property,currentFinancing}')::numeric,
      0
    ) * 100)::bigint;

  if v_financing_cents > 0 then
    insert into public.loans (
      organization_id,
      property_id,
      lender_name,
      original_principal_cents,
      current_balance_cents,
      nominal_interest_rate,
      monthly_payment_cents,
      status,
      notes,
      created_by
    )
    values (
      v_organization_id,
      v_property_id,
      'Bestehende Finanzierung (Onboarding)',
      v_financing_cents,
      v_financing_cents,
      0,
      0,
      'active',
      'Zinssatz und Rate ergänzen; Werte sind bis zur Bestätigung unvollständig.',
      v_user_id
    );
  end if;

  if v_import_mode = 'demo' then
    perform public.seed_demo_organization(v_organization_id);
  end if;

  update public.profiles
     set onboarding_completed_at = coalesce(onboarding_completed_at, now())
   where id = v_user_id;

  return v_organization_id;
end
$$;

revoke all on function public.complete_onboarding(jsonb)
  from public, anon;
grant execute on function public.complete_onboarding(jsonb)
  to authenticated, service_role;

revoke all on function public.resume_portfolio_onboarding(uuid, jsonb)
  from public, anon;
grant execute on function public.resume_portfolio_onboarding(uuid, jsonb)
  to authenticated, service_role;

comment on function public.complete_onboarding(jsonb) is
  'Atomically completes first-run setup and requires a valid lease start for every occupied unit.';
comment on function public.resume_portfolio_onboarding(uuid, jsonb) is
  'Atomically adds the first guided portfolio to an owner-controlled organization that was deliberately started empty.';
