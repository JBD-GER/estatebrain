-- First-run onboarding hardening:
-- - serialize setup per profile so retries and parallel tabs are idempotent
-- - support an organization-only setup with no property or sample records
-- - derive the property unit count from the submitted unit rows
-- - keep the lower-level organization RPC out of browser reach

alter function public.complete_onboarding(jsonb) set schema private;
alter function private.complete_onboarding(jsonb)
  rename to complete_portfolio_onboarding_v1;

revoke all on function private.complete_portfolio_onboarding_v1(jsonb)
  from public, anon, authenticated, service_role;

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

  -- Profiles are created with auth users. Locking the caller's row makes the
  -- membership check and setup atomic across retries and parallel browser tabs.
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
    if jsonb_typeof(p_payload -> 'units') <> 'array'
       or jsonb_array_length(p_payload -> 'units') not between 1 and 100 then
      raise exception 'Between one and one hundred units are required'
        using errcode = '22023';
    end if;

    -- The database, not a second client field, owns the aggregate unit count.
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
  if jsonb_typeof(p_payload -> 'organization') <> 'object'
     or jsonb_typeof(p_payload -> 'tax') <> 'object' then
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
     set onboarding_completed_at = now()
   where id = v_user_id;

  return v_organization_id;
end
$$;

revoke all on function public.complete_onboarding(jsonb) from public, anon;
grant execute on function public.complete_onboarding(jsonb)
  to authenticated, service_role;

revoke all on function public.create_organization_with_owner(
  text,
  text,
  jsonb,
  text,
  integer
) from public, anon, authenticated;
grant execute on function public.create_organization_with_owner(
  text,
  text,
  jsonb,
  text,
  integer
) to service_role;

comment on function public.complete_onboarding(jsonb) is
  'Atomically and idempotently completes either an empty or portfolio first-run setup.';
