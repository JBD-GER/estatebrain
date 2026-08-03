-- Additive portfolio/onboarding v2 contract.
--
-- This migration deliberately keeps the original onboarding RPCs and legacy
-- columns intact. Atomic wrapper RPCs complete/resume the established setup
-- and finalize the richer, explicitly separated v2 inputs in one transaction.

begin;

-- ---------------------------------------------------------------------------
-- Properties: operational/scenario boundary, canonical type vocabulary and
-- acquisition-cost allocation inputs.
-- ---------------------------------------------------------------------------

update public.properties
   set property_type = 'apartment_building'
 where property_type = 'multi_family';

alter table public.properties
  add column property_mode text not null default 'existing',
  add column land_area_sqm numeric(12,2),
  add column standard_land_value_cents_per_sqm bigint,
  add column land_ownership_share numeric(9,8) not null default 1,
  add column real_estate_transfer_tax_rate numeric(7,6),
  add column real_estate_transfer_tax_cents bigint not null default 0,
  add column broker_fee_cents bigint not null default 0,
  add column notary_fee_cents bigint not null default 0,
  add column land_registry_fee_cents bigint not null default 0,
  add column other_acquisition_costs_cents bigint not null default 0,
  add column building_purchase_price_cents bigint,
  add column total_acquisition_cost_cents bigint,
  add column market_value_status text,
  add column market_value_source text;

update public.properties as property_row
   set market_value_status = case
         when property_row.current_market_value_cents is null then 'pending'
         else 'manual'
       end,
       market_value_source = case
         when property_row.current_market_value_cents is null then null
         else coalesce(
           (
             select valuation_row.source_type
               from public.valuations as valuation_row
              where valuation_row.organization_id = property_row.organization_id
                and valuation_row.property_id = property_row.id
              order by valuation_row.valued_on desc,
                       valuation_row.created_at desc,
                       valuation_row.id desc
              limit 1
           ),
           'legacy_property_value'
         )
       end;

with latest_valuation as (
  select distinct on (
    valuation_row.organization_id,
    valuation_row.property_id
  )
    valuation_row.organization_id,
    valuation_row.property_id,
    valuation_row.source_type
  from public.valuations as valuation_row
  order by
    valuation_row.organization_id,
    valuation_row.property_id,
    valuation_row.valued_on desc,
    valuation_row.created_at desc,
    valuation_row.id desc
)
update public.properties as property_row
   set market_value_status = case
         when lower(btrim(latest_valuation.source_type)) =
              'purchase_price_proxy' then 'estimated'
         when lower(btrim(latest_valuation.source_type)) in (
           'connected_provider',
           'external_provider',
           'verified_provider'
         ) then 'verified'
         else 'manual'
       end,
       market_value_source = latest_valuation.source_type
  from latest_valuation
 where latest_valuation.organization_id = property_row.organization_id
   and latest_valuation.property_id = property_row.id
   and property_row.current_market_value_cents is not null;

alter table public.properties
  alter column market_value_status set default 'pending',
  alter column market_value_status set not null;

alter table public.properties
  add constraint properties_property_mode_v2_check
    check (property_mode in ('existing', 'scenario')) not valid,
  add constraint properties_property_type_v2_check
    check (
      property_type in (
        'condominium',
        'apartment_building',
        'single_family',
        'semi_detached',
        'terraced_house',
        'commercial',
        'mixed_use'
      )
    ) not valid,
  add constraint properties_acquisition_v2_nonnegative_check
    check (
      (land_area_sqm is null or land_area_sqm > 0)
      and (
        standard_land_value_cents_per_sqm is null
        or standard_land_value_cents_per_sqm >= 0
      )
      and land_ownership_share between 0 and 1
      and (
        real_estate_transfer_tax_rate is null
        or real_estate_transfer_tax_rate between 0 and 1
      )
      and real_estate_transfer_tax_cents >= 0
      and broker_fee_cents >= 0
      and notary_fee_cents >= 0
      and land_registry_fee_cents >= 0
      and other_acquisition_costs_cents >= 0
      and (
        building_purchase_price_cents is null
        or building_purchase_price_cents >= 0
      )
      and (
        total_acquisition_cost_cents is null
        or total_acquisition_cost_cents >= 0
      )
    ) not valid,
  add constraint properties_market_value_status_v2_check
    check (
      market_value_status in ('pending', 'estimated', 'manual', 'verified')
    ) not valid,
  add constraint properties_market_value_source_v2_length_check
    check (
      market_value_source is null
      or char_length(btrim(market_value_source)) between 1 and 120
    ) not valid;

alter table public.properties
  validate constraint properties_property_mode_v2_check,
  validate constraint properties_property_type_v2_check,
  validate constraint properties_acquisition_v2_nonnegative_check,
  validate constraint properties_market_value_status_v2_check,
  validate constraint properties_market_value_source_v2_length_check;

create index properties_org_mode_active_v2_idx
  on public.properties (organization_id, property_mode, status)
  where archived_at is null;

create or replace function private.normalize_property_type_v2()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  -- Compatibility for the original demo seed and any in-flight v1 draft.
  if new.property_type = 'multi_family' then
    new.property_type := 'apartment_building';
  end if;
  return new;
end
$$;

drop trigger if exists properties_normalize_property_type_v2
  on public.properties;
create trigger properties_normalize_property_type_v2
  before insert or update of property_type on public.properties
  for each row execute function private.normalize_property_type_v2();

revoke all on function private.normalize_property_type_v2()
  from public, anon, authenticated, service_role;

comment on column public.properties.property_mode is
  'Strict portfolio boundary: existing records affect operational KPIs; scenario records are simulations.';
comment on column public.properties.land_ownership_share is
  'Miteigentumsanteil as a decimal rate from 0 to 1; ETW land allocation multiplies area, standard land value and this share.';
comment on column public.properties.building_purchase_price_cents is
  'Pure building purchase price: purchase_price_cents minus land_value_cents.';
comment on column public.properties.total_acquisition_cost_cents is
  'Purchase price plus acquisition_costs_cents.';
comment on column public.properties.building_value_cents is
  'Modeled depreciable building basis: total acquisition cost minus land value.';

-- The existing valuation trigger already owns the canonical projection for
-- direct table mutations. Extend it to keep the new provenance fields under
-- the same row lock and ordering rule used for the projected amount.
create or replace function private.refresh_valuation_projection()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_organization_id uuid;
  v_property_id uuid;
  v_current_market_value_cents bigint;
  v_current_source_type text;
begin
  if tg_op = 'DELETE' then
    v_organization_id := old.organization_id;
    v_property_id := old.property_id;
  else
    v_organization_id := new.organization_id;
    v_property_id := new.property_id;
  end if;

  select
    valuation_row.market_value_cents,
    valuation_row.source_type
    into
      v_current_market_value_cents,
      v_current_source_type
    from public.valuations as valuation_row
   where valuation_row.organization_id = v_organization_id
     and valuation_row.property_id = v_property_id
   order by
     valuation_row.valued_on desc,
     valuation_row.created_at desc,
     valuation_row.id desc
   limit 1;

  update public.properties as property_row
     set current_market_value_cents = v_current_market_value_cents,
         market_value_status = case
           when v_current_source_type is null then 'pending'
           when lower(btrim(v_current_source_type)) = 'purchase_price_proxy'
             then 'estimated'
           when lower(btrim(v_current_source_type)) in (
             'connected_provider',
             'external_provider',
             'verified_provider'
           ) then 'verified'
           else 'manual'
         end,
         market_value_source = v_current_source_type
   where property_row.organization_id = v_organization_id
     and property_row.id = v_property_id;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

revoke all on function private.refresh_valuation_projection()
  from public, anon, authenticated, service_role;

create or replace function private.guard_property_market_value_provenance_v2()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    if current_user in ('anon', 'authenticated')
       and (
         new.market_value_status = 'verified'
         or lower(btrim(coalesce(new.market_value_source, ''))) in (
           'connected_provider',
           'external_provider',
           'verified_provider'
         )
       ) then
      raise exception 'Verified property market-value provenance requires a trusted provider workflow'
        using errcode = '42501';
    end if;
    return new;
  end if;

  if (
       new.market_value_status is distinct from old.market_value_status
       or new.market_value_source is distinct from old.market_value_source
     )
     and current_user in ('anon', 'authenticated') then
    raise exception 'Property market-value provenance is maintained by valuation workflows'
      using errcode = '42501';
  end if;
  return new;
end
$$;

drop trigger if exists properties_market_value_provenance_v2
  on public.properties;
create trigger properties_market_value_provenance_v2
  before update of market_value_status, market_value_source
  on public.properties
  for each row
  execute function private.guard_property_market_value_provenance_v2();

drop trigger if exists properties_market_value_provenance_insert_v2
  on public.properties;
create trigger properties_market_value_provenance_insert_v2
  before insert on public.properties
  for each row
  execute function private.guard_property_market_value_provenance_v2();

revoke all on function private.guard_property_market_value_provenance_v2()
  from public, anon, authenticated, service_role;

-- Provider-backed source types are a reserved trust boundary. Interactive
-- users can record appraisals and other cited methods, but those remain manual;
-- only service/database roles may create or mutate a verified provider row.
create or replace function private.guard_verified_valuation_source_v2()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_trusted_roles constant text[] := array[
    'postgres',
    'service_role',
    'supabase_admin'
  ];
begin
  if current_user::text = any(v_trusted_roles) then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op = 'INSERT'
     and lower(btrim(new.source_type)) in (
       'connected_provider',
       'external_provider',
       'verified_provider'
     ) then
    raise exception 'Verified valuation sources require a trusted provider role'
      using errcode = '42501';
  elsif tg_op = 'UPDATE'
        and (
          lower(btrim(old.source_type)) in (
            'connected_provider',
            'external_provider',
            'verified_provider'
          )
          or lower(btrim(new.source_type)) in (
            'connected_provider',
            'external_provider',
            'verified_provider'
          )
        ) then
    raise exception 'Verified provider valuations cannot be changed by an interactive role'
      using errcode = '42501';
  elsif tg_op = 'DELETE'
        and lower(btrim(old.source_type)) in (
          'connected_provider',
          'external_provider',
          'verified_provider'
        ) then
    raise exception 'Verified provider valuations cannot be deleted by an interactive role'
      using errcode = '42501';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

drop trigger if exists valuations_verified_source_v2
  on public.valuations;
create trigger valuations_verified_source_v2
  before insert or update or delete on public.valuations
  for each row execute function private.guard_verified_valuation_source_v2();

revoke all on function private.guard_verified_valuation_source_v2()
  from public, anon, authenticated, service_role;

-- Keep the new market-value provenance fields aligned with the valuation that
-- currently drives the property projection. Only reserved, service-backed
-- provider sources are marked verified; every interactively entered method,
-- including an appraisal, remains manual.
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
  v_current_market_value_cents bigint;
  v_current_source_type text;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  -- Serializing by property prevents concurrent valuations from leaving any
  -- denormalized projection or provenance field behind the latest history row.
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

  select
    valuation_row.market_value_cents,
    valuation_row.source_type
    into
      v_current_market_value_cents,
      v_current_source_type
    from public.valuations as valuation_row
   where valuation_row.organization_id = p_organization_id
     and valuation_row.property_id = p_property_id
   order by
     valuation_row.valued_on desc,
     valuation_row.created_at desc,
     valuation_row.id desc
   limit 1;

  update public.properties as property_row
     set current_market_value_cents = v_current_market_value_cents,
         market_value_status = case
           when lower(btrim(v_current_source_type)) = 'purchase_price_proxy'
             then 'estimated'
           when lower(btrim(v_current_source_type)) in (
             'connected_provider',
             'external_provider',
             'verified_provider'
           ) then 'verified'
           else 'manual'
         end,
         market_value_source = v_current_source_type
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
) from public, anon, authenticated, service_role;

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
  'Atomically appends a valuation and refreshes the property market-value amount, status and source from the latest dated valuation.';

-- ---------------------------------------------------------------------------
-- Explicit ancillary-charge semantics and financing type.
-- ---------------------------------------------------------------------------

alter table public.units
  add column ancillary_charge_type text not null default 'advance';
alter table public.leases
  add column ancillary_charge_type text not null default 'advance';
alter table public.rent_schedules
  add column ancillary_charge_type text not null default 'advance';

alter table public.units
  add constraint units_ancillary_charge_type_v2_check
    check (ancillary_charge_type in ('advance', 'flat_rate', 'none'))
    not valid,
  add constraint units_ancillary_none_v2_check
    check (
      ancillary_charge_type <> 'none'
      or ancillary_prepayment_cents = 0
    ) not valid;
alter table public.leases
  add constraint leases_ancillary_charge_type_v2_check
    check (ancillary_charge_type in ('advance', 'flat_rate', 'none'))
    not valid,
  add constraint leases_ancillary_none_v2_check
    check (
      ancillary_charge_type <> 'none'
      or ancillary_prepayment_cents = 0
    ) not valid;
alter table public.rent_schedules
  add constraint rent_schedules_ancillary_charge_type_v2_check
    check (ancillary_charge_type in ('advance', 'flat_rate', 'none'))
    not valid,
  add constraint rent_schedules_ancillary_none_v2_check
    check (
      ancillary_charge_type <> 'none'
      or ancillary_prepayment_cents = 0
    ) not valid;

alter table public.units
  validate constraint units_ancillary_charge_type_v2_check,
  validate constraint units_ancillary_none_v2_check;
alter table public.leases
  validate constraint leases_ancillary_charge_type_v2_check,
  validate constraint leases_ancillary_none_v2_check;
alter table public.rent_schedules
  validate constraint rent_schedules_ancillary_charge_type_v2_check,
  validate constraint rent_schedules_ancillary_none_v2_check;

alter table public.loans
  add column loan_type text not null default 'annuity';
alter table public.loans
  add constraint loans_loan_type_v2_check
    check (
      loan_type in (
        'annuity',
        'repayment',
        'interest_only',
        'variable',
        'other'
      )
    ) not valid;
alter table public.loans
  validate constraint loans_loan_type_v2_check;

comment on column public.units.target_cold_rent_cents is
  'Market/target cold rent per month (SOLL), not contractual rent and not a payment.';
comment on column public.leases.cold_rent_cents is
  'Contract cold rent per month (IST contract value at lease start).';
comment on column public.rent_schedules.cold_rent_cents is
  'Historized contract cold rent per month (IST contract value).';
comment on column public.loans.loan_type is
  'Financing model; interest and principal portions remain payment-period facts in loan_payments.';

-- ---------------------------------------------------------------------------
-- Depreciation source and opening balance for an existing property.
-- ---------------------------------------------------------------------------

alter table public.depreciation_assets
  add column source_type text not null default 'calculated',
  add column source_document_id uuid,
  add column basis_as_of date,
  add column opening_accumulated_depreciation_cents bigint,
  add column opening_remaining_basis_cents bigint,
  add column manual_annual_depreciation_cents bigint;

-- A composite key keeps the optional source document in the same organization
-- structurally, independently of RLS or the generic organization-scope trigger.
alter table public.documents
  add constraint documents_organization_id_id_v2_key
    unique (organization_id, id);

alter table public.depreciation_assets
  add constraint depreciation_assets_source_document_v2_fkey
    foreign key (organization_id, source_document_id)
    references public.documents (organization_id, id)
    on delete set null (source_document_id);

create index depreciation_assets_source_document_v2_idx
  on public.depreciation_assets (organization_id, source_document_id)
  where source_document_id is not null;

update public.depreciation_assets
   set manual_annual_depreciation_cents =
         round(depreciable_basis_cents * annual_rate)::bigint
 where calculation_method = 'manual'
   and manual_annual_depreciation_cents is null;

alter table public.depreciation_assets
  alter column annual_rate drop not null,
  drop constraint depreciation_assets_rate;

alter table public.depreciation_assets
  add constraint depreciation_assets_source_type_v2_check
    check (source_type in ('calculated', 'tax_return', 'manual')) not valid,
  add constraint depreciation_assets_rate_v2_check
    check (
      (annual_rate is null or annual_rate > 0 and annual_rate <= 1)
      and (calculation_method <> 'straight_line' or annual_rate is not null)
      and (
        calculation_method <> 'manual'
        or manual_annual_depreciation_cents is not null
      )
    ) not valid,
  add constraint depreciation_assets_opening_values_v2_check
    check (
      (
        opening_accumulated_depreciation_cents is null
        or opening_accumulated_depreciation_cents between 0 and depreciable_basis_cents
      )
      and (
        opening_remaining_basis_cents is null
        or opening_remaining_basis_cents between 0 and depreciable_basis_cents
      )
      and (
        opening_accumulated_depreciation_cents is null
        or opening_remaining_basis_cents is null
        or opening_accumulated_depreciation_cents
           + opening_remaining_basis_cents <= depreciable_basis_cents
      )
      and (
        manual_annual_depreciation_cents is null
        or manual_annual_depreciation_cents >= 0
      )
    ) not valid;

alter table public.depreciation_assets
  validate constraint depreciation_assets_source_type_v2_check,
  validate constraint depreciation_assets_rate_v2_check,
  validate constraint depreciation_assets_opening_values_v2_check;

comment on column public.depreciation_assets.source_type is
  'calculated = modeled from acquisition data; tax_return = annual AfA adopted from a tax return; manual = explicit user input.';
comment on column public.depreciation_assets.manual_annual_depreciation_cents is
  'Authoritative annual AfA when calculation_method is manual; annual_rate may then be NULL.';

-- ---------------------------------------------------------------------------
-- Personal tax calculation mode and annual tariff inputs.
-- ---------------------------------------------------------------------------

alter table public.tax_profiles
  add column calculation_mode text not null default 'automatic',
  add column other_taxable_income_cents bigint,
  add column rental_inputs_confirmed_at timestamptz,
  add column tariff_year integer,
  add column tariff_version text;

update public.tax_profiles
   set other_taxable_income_cents = assumed_taxable_income_cents
 where other_taxable_income_cents is null
   and assumed_taxable_income_cents is not null;

update public.tax_profiles
   set calculation_mode = case
     when effective_tax_rate is not null and marginal_tax_rate is null
       then 'manual'
     else 'automatic'
   end;

alter table public.tax_profiles
  add constraint tax_profiles_calculation_mode_v2_check
    check (calculation_mode in ('automatic', 'manual')) not valid,
  add constraint tax_profiles_other_income_v2_check
    check (
      other_taxable_income_cents is null
      or other_taxable_income_cents >= 0
    ) not valid,
  add constraint tax_profiles_tariff_year_v2_check
    check (tariff_year is null or tariff_year between 1900 and 2200)
    not valid,
  add constraint tax_profiles_tariff_version_v2_check
    check (
      tariff_version is null
      or char_length(btrim(tariff_version)) between 1 and 120
    ) not valid;

alter table public.tax_profiles
  validate constraint tax_profiles_calculation_mode_v2_check,
  validate constraint tax_profiles_other_income_v2_check,
  validate constraint tax_profiles_tariff_year_v2_check,
  validate constraint tax_profiles_tariff_version_v2_check;

comment on column public.tax_profiles.calculation_mode is
  'automatic uses a versioned tariff calculation; manual uses effective_tax_rate supplied by the user.';
comment on column public.tax_profiles.rental_inputs_confirmed_at is
  'User confirmation that contractual rental inputs are complete enough for an automatic estimate.';

-- ---------------------------------------------------------------------------
-- Auditable cancellation of monthly rent claims.
-- ---------------------------------------------------------------------------

alter table public.rent_claims
  add column cancelled_at timestamptz,
  add column cancelled_by uuid references auth.users(id) on delete set null,
  add column cancellation_reason text;

update public.rent_claims
   set cancelled_at = coalesce(cancelled_at, updated_at),
       cancelled_by = coalesce(cancelled_by, created_by),
       cancellation_reason = coalesce(
         nullif(btrim(cancellation_reason), ''),
         'Legacy-Stornierung'
       )
 where status = 'cancelled';

alter table public.rent_claims
  add constraint rent_claims_cancellation_metadata_v2_check
    check (
      (
        status = 'cancelled'
        and cancelled_at is not null
        and cancellation_reason is not null
        and char_length(btrim(cancellation_reason)) between 3 and 500
      )
      or (
        status <> 'cancelled'
        and cancelled_at is null
        and cancelled_by is null
        and cancellation_reason is null
      )
    ) not valid;

alter table public.rent_claims
  validate constraint rent_claims_cancellation_metadata_v2_check;

create index rent_claims_cancelled_by_v2_idx
  on public.rent_claims (cancelled_by)
  where cancelled_by is not null;

create or replace function public.cancel_rent_claim(
  p_rent_claim_id uuid,
  p_reason text
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_claim public.rent_claims%rowtype;
  v_reason text := nullif(btrim(p_reason), '');
begin
  if v_user_id is null
     or coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_rent_claim_id is null
     or v_reason is null
     or char_length(v_reason) not between 3 and 500 then
    raise exception 'A cancellation reason between 3 and 500 characters is required'
      using errcode = '22023';
  end if;

  select claim_row.*
    into v_claim
    from public.rent_claims as claim_row
   where claim_row.id = p_rent_claim_id
   for update;

  if not found then
    raise exception 'Rent claim not found' using errcode = 'P0002';
  end if;

  if not private.has_org_role(
    v_claim.organization_id,
    array[
      'owner',
      'admin',
      'property_manager',
      'accounting'
    ]::public.app_role[]
  ) then
    raise exception 'Insufficient permission to cancel this rent claim'
      using errcode = '42501';
  end if;

  if v_claim.status = 'cancelled' then
    return v_claim.id;
  end if;

  if v_claim.paid_cents <> 0
     or exists (
       select 1
         from public.rent_payments as payment_row
        where payment_row.organization_id = v_claim.organization_id
          and payment_row.rent_claim_id = v_claim.id
          and payment_row.allocation_status = 'confirmed'
     ) then
    raise exception 'Reverse confirmed payments before cancelling the claim'
      using errcode = '23514';
  end if;

  update public.rent_claims
     set status = 'cancelled',
         cancelled_at = now(),
         cancelled_by = v_user_id,
         cancellation_reason = v_reason
   where id = v_claim.id;

  return v_claim.id;
end
$$;

revoke all on function public.cancel_rent_claim(uuid, text)
  from public, anon, authenticated, service_role;
grant execute on function public.cancel_rent_claim(uuid, text)
  to authenticated;

comment on function public.cancel_rent_claim(uuid, text) is
  'Owner/admin/property-manager/accounting-only, append-audited cancellation path. Claims with confirmed payments must be reversed first.';

-- Direct browser mutation stays disabled; cancellation is RPC-only and
-- historical claims cannot be physically deleted through RLS.
revoke insert, update, delete on public.rent_claims from authenticated;
drop policy if exists rent_claims_delete_bookkeeping on public.rent_claims;

-- Scenario properties may carry planning units and financing assumptions, but
-- must never acquire an operational lease or a monthly rent claim.
create or replace function private.guard_lease_existing_property_v2()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_property_mode text;
begin
  select property_row.property_mode
    into v_property_mode
    from public.units as unit_row
    join public.properties as property_row
      on property_row.id = unit_row.property_id
     and property_row.organization_id = unit_row.organization_id
   where unit_row.id = new.unit_id
     and unit_row.organization_id = new.organization_id;

  if v_property_mode is null then
    raise exception 'Lease unit and property were not found in the organization'
      using errcode = '23503';
  end if;
  if v_property_mode <> 'existing' then
    raise exception 'Scenario properties cannot have operational leases'
      using errcode = '23514';
  end if;
  return new;
end
$$;

create or replace function private.guard_rent_claim_existing_property_v2()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_property_mode text;
begin
  select property_row.property_mode
    into v_property_mode
    from public.leases as lease_row
    join public.units as unit_row
      on unit_row.id = lease_row.unit_id
     and unit_row.organization_id = lease_row.organization_id
    join public.properties as property_row
      on property_row.id = unit_row.property_id
     and property_row.organization_id = unit_row.organization_id
   where lease_row.id = new.lease_id
     and lease_row.organization_id = new.organization_id;

  if v_property_mode is null then
    raise exception 'Rent-claim lease and property were not found in the organization'
      using errcode = '23503';
  end if;
  if v_property_mode <> 'existing' then
    raise exception 'Scenario properties cannot generate rent claims'
      using errcode = '23514';
  end if;
  return new;
end
$$;

create or replace function private.guard_property_mode_transition_v2()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.property_mode = 'scenario'
     and old.property_mode is distinct from 'scenario'
     and exists (
       select 1
         from public.units as unit_row
         join public.leases as lease_row
           on lease_row.organization_id = unit_row.organization_id
          and lease_row.unit_id = unit_row.id
        where unit_row.organization_id = old.organization_id
          and unit_row.property_id = old.id
     ) then
    raise exception 'A property with lease history cannot become a scenario'
      using errcode = '23514';
  end if;
  return new;
end
$$;

create or replace function private.guard_leased_unit_move_v2()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if (
       new.organization_id is distinct from old.organization_id
       or new.property_id is distinct from old.property_id
     )
     and exists (
       select 1
         from public.leases as lease_row
        where lease_row.unit_id = old.id
     ) then
    raise exception 'A unit with lease history cannot be moved to another property or organization'
      using errcode = '23514';
  end if;
  return new;
end
$$;

drop trigger if exists leases_existing_property_v2 on public.leases;
create trigger leases_existing_property_v2
  before insert or update of organization_id, unit_id on public.leases
  for each row execute function private.guard_lease_existing_property_v2();

drop trigger if exists rent_claims_existing_property_v2
  on public.rent_claims;
create trigger rent_claims_existing_property_v2
  before insert or update of organization_id, lease_id on public.rent_claims
  for each row execute function private.guard_rent_claim_existing_property_v2();

drop trigger if exists properties_mode_transition_v2 on public.properties;
create trigger properties_mode_transition_v2
  before update of property_mode on public.properties
  for each row execute function private.guard_property_mode_transition_v2();

drop trigger if exists units_leased_move_v2 on public.units;
create trigger units_leased_move_v2
  before update of organization_id, property_id on public.units
  for each row execute function private.guard_leased_unit_move_v2();

revoke all on function private.guard_lease_existing_property_v2()
  from public, anon, authenticated, service_role;
revoke all on function private.guard_rent_claim_existing_property_v2()
  from public, anon, authenticated, service_role;
revoke all on function private.guard_property_mode_transition_v2()
  from public, anon, authenticated, service_role;
revoke all on function private.guard_leased_unit_move_v2()
  from public, anon, authenticated, service_role;

comment on function private.guard_lease_existing_property_v2() is
  'Trigger-only invariant: operational leases belong only to existing properties.';
comment on function private.guard_rent_claim_existing_property_v2() is
  'Trigger-only invariant: rent claims can never be created for scenario properties.';

-- Preserve the established, heavily validated tenant/lease transaction as a
-- private implementation. The public v2 wrapper validates the new ancillary
-- semantics and synchronizes lease, schedule and unit atomically.
alter function public.create_tenant_lease(uuid, jsonb)
  set schema private;
alter function private.create_tenant_lease(uuid, jsonb)
  rename to create_tenant_lease_v1;

revoke all on function private.create_tenant_lease_v1(uuid, jsonb)
  from public, anon, authenticated, service_role;

create or replace function public.create_tenant_lease(
  p_organization_id uuid,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_property_id uuid;
  v_unit_id uuid;
  v_ancillary_charge_type text := coalesce(
    nullif(btrim(p_payload ->> 'ancillary_charge_type'), ''),
    'advance'
  );
  v_ancillary_cents bigint;
  v_result jsonb;
  v_lease_id uuid;
  v_rent_schedule_id uuid;
begin
  if v_user_id is null
     or coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false)
     or p_organization_id is null
     or not private.can_manage_leases(p_organization_id) then
    raise exception 'Insufficient permission to create tenant leases'
      using errcode = '42501';
  end if;

  if p_payload is null or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Lease payload must be an object'
      using errcode = '22023';
  end if;

  begin
    v_property_id := (p_payload ->> 'property_id')::uuid;
    v_unit_id := (p_payload ->> 'unit_id')::uuid;
    v_ancillary_cents :=
      (p_payload ->> 'ancillary_prepayment_cents')::bigint;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Lease payload contains invalid values'
        using errcode = '22023';
  end;

  if v_ancillary_charge_type not in ('advance', 'flat_rate', 'none')
     or (
       v_ancillary_charge_type = 'none'
       and coalesce(v_ancillary_cents, 0) <> 0
     ) then
    raise exception 'Ancillary charge type and amount are inconsistent'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
      from public.properties as property_row
      join public.units as unit_row
        on unit_row.organization_id = property_row.organization_id
       and unit_row.property_id = property_row.id
     where property_row.organization_id = p_organization_id
       and property_row.id = v_property_id
       and property_row.property_mode = 'existing'
       and property_row.status = 'active'
       and property_row.archived_at is null
       and unit_row.id = v_unit_id
       and unit_row.archived_at is null
  ) then
    raise exception 'Operational leases require an existing property and matching unit'
      using errcode = '23514';
  end if;

  v_result := private.create_tenant_lease_v1(
    p_organization_id,
    p_payload
  );
  v_lease_id := (v_result ->> 'lease_id')::uuid;
  v_rent_schedule_id := (v_result ->> 'rent_schedule_id')::uuid;

  update public.leases
     set ancillary_charge_type = v_ancillary_charge_type
   where organization_id = p_organization_id
     and id = v_lease_id;

  update public.rent_schedules
     set ancillary_charge_type = v_ancillary_charge_type
   where organization_id = p_organization_id
     and id = v_rent_schedule_id;

  update public.units
     set ancillary_charge_type = v_ancillary_charge_type,
         ancillary_prepayment_cents = v_ancillary_cents
   where organization_id = p_organization_id
     and id = v_unit_id;

  return v_result;
end
$$;

revoke all on function public.create_tenant_lease(uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.create_tenant_lease(uuid, jsonb)
  to authenticated;

comment on function public.create_tenant_lease(uuid, jsonb) is
  'Authenticated existing-property lease transaction; adds advance/flat-rate/none ancillary semantics while retaining v1 validation.';

-- ---------------------------------------------------------------------------
-- Idempotent second phase for the v2 onboarding payload.
-- ---------------------------------------------------------------------------

create or replace function public.finalize_onboarding_v2(
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
  v_requested_property_id uuid;
  v_property_id uuid;
  v_property_mode text;
  v_property_type text;
  v_construction_year integer;
  v_purchase_date date;
  v_purchase_price_cents bigint;
  v_land_area_sqm numeric(12,2);
  v_standard_land_value_cents_per_sqm bigint;
  v_land_ownership_share numeric(9,8);
  v_transfer_tax_rate numeric(7,6);
  v_transfer_tax_cents bigint;
  v_broker_fee_cents bigint;
  v_notary_fee_cents bigint;
  v_land_registry_fee_cents bigint;
  v_other_acquisition_costs_cents bigint;
  v_acquisition_costs_cents bigint;
  v_total_acquisition_cost_cents bigint;
  v_land_value_cents bigint;
  v_building_purchase_price_cents bigint;
  v_building_value_cents bigint;
  v_unit jsonb;
  v_unit_position integer := 0;
  v_unit_id uuid;
  v_unit_number text;
  v_unit_status text;
  v_contract_cold_rent_cents bigint;
  v_target_cold_rent_cents bigint;
  v_service_charge_cents bigint;
  v_parking_rent_cents bigint;
  v_ancillary_charge_type text;
  v_expected_monthly_rent_cents bigint := 0;
  v_lease_id uuid;
  v_schedule_id uuid;
  v_financing_enabled boolean;
  v_loan_type text;
  v_lender_name text;
  v_original_principal_cents bigint;
  v_current_balance_cents bigint;
  v_nominal_interest_rate numeric(9,6);
  v_initial_repayment_rate numeric(9,6);
  v_monthly_payment_cents bigint;
  v_disbursed_on date;
  v_fixed_rate_until date;
  v_loan_id uuid;
  v_depreciation_mode text;
  v_annual_rate numeric(7,6);
  v_manual_annual_depreciation_cents bigint;
  v_depreciation_asset_id uuid;
  v_tax_year_id uuid;
  v_tax_year integer;
  v_tax_calculation_mode text;
  v_manual_effective_tax_rate numeric(7,6);
  v_other_taxable_income_cents bigint;
  v_assessment_type text;
  v_rental_inputs_complete boolean;
  v_calculated_marginal_rate numeric(7,6);
  v_calculated_effective_rate numeric(7,6);
  v_proxy_valuation_id uuid;
begin
  if v_user_id is null
     or coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_organization_id is null
     or p_payload is null
     or jsonb_typeof(p_payload) <> 'object'
     or jsonb_typeof(p_payload -> 'property') is distinct from 'object'
     or jsonb_typeof(p_payload -> 'units') is distinct from 'array'
     or jsonb_typeof(p_payload -> 'financing') is distinct from 'object'
     or jsonb_typeof(p_payload -> 'tax') is distinct from 'object' then
    raise exception 'Complete onboarding v2 sections are required'
      using errcode = '22023';
  end if;

  if jsonb_array_length(p_payload -> 'units') not between 1 and 100 then
    raise exception 'Between one and one hundred units are required'
      using errcode = '22023';
  end if;

  -- Lock the organization and caller membership together. SECURITY DEFINER is
  -- used only to finish the cross-table transaction; authorization never
  -- trusts an organization ID or role supplied in the payload.
  perform 1
    from public.organizations as organization_row
    join public.organization_members as member_row
      on member_row.organization_id = organization_row.id
   where organization_row.id = p_organization_id
     and organization_row.archived_at is null
     and member_row.user_id = v_user_id
     and member_row.role = 'owner'
     and member_row.status = 'active'
   for update of organization_row, member_row;

  if not found then
    raise exception 'An active organization owner is required'
      using errcode = '42501';
  end if;

  begin
    v_requested_property_id := nullif(
      p_payload #>> '{property,id}',
      ''
    )::uuid;
  exception
    when invalid_text_representation then
      raise exception 'Property ID is invalid' using errcode = '22023';
  end;

  if v_requested_property_id is not null then
    select property_row.id
      into v_property_id
      from public.properties as property_row
     where property_row.id = v_requested_property_id
       and property_row.organization_id = p_organization_id
       and property_row.created_by = v_user_id
       and property_row.archived_at is null
     for update;
  else
    select property_row.id
      into v_property_id
      from public.properties as property_row
     where property_row.organization_id = p_organization_id
       and property_row.created_by = v_user_id
       and property_row.archived_at is null
       and property_row.name = p_payload #>> '{property,name}'
       and property_row.street = p_payload #>> '{property,street}'
       and property_row.postal_code = p_payload #>> '{property,postalCode}'
       and property_row.city = p_payload #>> '{property,city}'
     order by property_row.created_at desc, property_row.id desc
     limit 1
     for update;
  end if;

  if v_property_id is null then
    raise exception 'The property created by onboarding was not found'
      using errcode = 'P0002';
  end if;

  begin
    v_property_mode := p_payload #>> '{property,propertyMode}';
    v_property_type := p_payload #>> '{property,propertyType}';
    if v_property_type = 'multi_family' then
      v_property_type := 'apartment_building';
    end if;
    v_construction_year :=
      (p_payload #>> '{property,constructionYear}')::integer;
    v_purchase_date := (p_payload #>> '{property,purchaseDate}')::date;
    v_purchase_price_cents := round(
      (p_payload #>> '{property,purchasePrice}')::numeric * 100
    )::bigint;
    v_land_area_sqm :=
      (p_payload #>> '{property,landArea}')::numeric(12,2);
    v_standard_land_value_cents_per_sqm := round(
      (p_payload #>> '{property,standardLandValue}')::numeric * 100
    )::bigint;
    v_land_ownership_share := (
      (p_payload #>> '{property,landOwnershipSharePercent}')::numeric / 100
    )::numeric(9,8);
    v_transfer_tax_rate := (
      (p_payload #>> '{property,realEstateTransferTaxRate}')::numeric / 100
    )::numeric(7,6);
    v_broker_fee_cents := round(
      coalesce((p_payload #>> '{property,brokerFee}')::numeric, 0) * 100
    )::bigint;
    v_notary_fee_cents := round(
      coalesce((p_payload #>> '{property,notaryFee}')::numeric, 0) * 100
    )::bigint;
    v_land_registry_fee_cents := round(
      coalesce((p_payload #>> '{property,landRegistryFee}')::numeric, 0) * 100
    )::bigint;
    v_other_acquisition_costs_cents := round(
      coalesce(
        (p_payload #>> '{property,otherAcquisitionCosts}')::numeric,
        0
      ) * 100
    )::bigint;
  exception
    when invalid_text_representation
      or invalid_datetime_format
      or datetime_field_overflow
      or numeric_value_out_of_range then
      raise exception 'Property acquisition payload contains invalid values'
        using errcode = '22023';
  end;

  if v_property_mode is null
     or v_property_mode not in ('existing', 'scenario')
     or v_property_type is null
     or v_property_type not in (
       'condominium',
       'apartment_building',
       'single_family',
       'semi_detached',
       'terraced_house',
       'commercial',
       'mixed_use'
     )
     or v_construction_year is null
     or v_construction_year not between 1000 and 2200
     or v_purchase_date is null
     or v_purchase_price_cents is null
     or v_purchase_price_cents <= 0
     or v_land_area_sqm is null
     or v_land_area_sqm <= 0
     or v_standard_land_value_cents_per_sqm is null
     or v_standard_land_value_cents_per_sqm < 0
     or v_land_ownership_share is null
     or v_land_ownership_share not between 0 and 1
     or v_transfer_tax_rate is null
     or v_transfer_tax_rate not between 0 and 1
     or least(
       v_broker_fee_cents,
       v_notary_fee_cents,
       v_land_registry_fee_cents,
       v_other_acquisition_costs_cents
     ) < 0 then
    raise exception 'Property acquisition values are outside valid ranges'
      using errcode = '22023';
  end if;

  if v_property_type <> 'apartment_building'
     and jsonb_array_length(p_payload -> 'units') <> 1 then
    raise exception 'Only apartment buildings can contain multiple units in onboarding'
      using errcode = '22023';
  end if;

  v_transfer_tax_cents := round(
    v_purchase_price_cents::numeric * v_transfer_tax_rate
  )::bigint;
  v_land_value_cents := round(
    v_land_area_sqm
      * v_standard_land_value_cents_per_sqm
      * v_land_ownership_share
  )::bigint;
  v_acquisition_costs_cents :=
    v_transfer_tax_cents
    + v_broker_fee_cents
    + v_notary_fee_cents
    + v_land_registry_fee_cents
    + v_other_acquisition_costs_cents;
  v_total_acquisition_cost_cents :=
    v_purchase_price_cents + v_acquisition_costs_cents;
  v_building_purchase_price_cents :=
    v_purchase_price_cents - v_land_value_cents;
  v_building_value_cents :=
    v_total_acquisition_cost_cents - v_land_value_cents;

  if v_building_purchase_price_cents < 0
     or v_building_value_cents < 0 then
    raise exception 'Land value cannot exceed the purchase price'
      using errcode = '22023';
  end if;

  if v_property_mode = 'scenario'
     and exists (
       select 1
         from public.units as unit_row
         join public.leases as lease_row
           on lease_row.organization_id = unit_row.organization_id
          and lease_row.unit_id = unit_row.id
        where unit_row.organization_id = p_organization_id
          and unit_row.property_id = v_property_id
     ) then
    raise exception 'A property with lease history cannot be finalized as a scenario'
      using errcode = '23514';
  end if;

  update public.properties
     set property_mode = v_property_mode,
         property_type = v_property_type,
         construction_year = v_construction_year,
         purchase_date = v_purchase_date,
         purchase_price_cents = v_purchase_price_cents,
         land_area_sqm = v_land_area_sqm,
         standard_land_value_cents_per_sqm =
           v_standard_land_value_cents_per_sqm,
         land_ownership_share = v_land_ownership_share,
         real_estate_transfer_tax_rate = v_transfer_tax_rate,
         real_estate_transfer_tax_cents = v_transfer_tax_cents,
         broker_fee_cents = v_broker_fee_cents,
         notary_fee_cents = v_notary_fee_cents,
         land_registry_fee_cents = v_land_registry_fee_cents,
         other_acquisition_costs_cents =
           v_other_acquisition_costs_cents,
         acquisition_costs_cents = v_acquisition_costs_cents,
         total_acquisition_cost_cents = v_total_acquisition_cost_cents,
         land_value_cents = v_land_value_cents,
         building_purchase_price_cents =
           v_building_purchase_price_cents,
         building_value_cents = v_building_value_cents
   where id = v_property_id
     and organization_id = p_organization_id;

  for v_unit in
    select value from jsonb_array_elements(p_payload -> 'units')
  loop
    v_unit_position := v_unit_position + 1;
    begin
      v_unit_number := nullif(btrim(v_unit ->> 'unitNumber'), '');
      v_contract_cold_rent_cents := round(
        coalesce((v_unit ->> 'contractColdRent')::numeric, 0) * 100
      )::bigint;
      v_target_cold_rent_cents := round(
        coalesce((v_unit ->> 'targetColdRent')::numeric, 0) * 100
      )::bigint;
      v_service_charge_cents := round(
        coalesce((v_unit ->> 'serviceCharge')::numeric, 0) * 100
      )::bigint;
      v_parking_rent_cents := round(
        coalesce((v_unit ->> 'parkingRent')::numeric, 0) * 100
      )::bigint;
      v_ancillary_charge_type := coalesce(
        nullif(btrim(v_unit ->> 'ancillaryChargeType'), ''),
        'advance'
      );
      v_unit_status := case v_unit ->> 'status'
        when 'occupied' then 'rented'
        when 'vacant' then 'vacant'
        when 'renovation' then 'renovation'
        else null
      end;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'Unit % contains invalid rent values', v_unit_position
          using errcode = '22023';
    end;

    if v_unit_number is null
       or v_unit_status is null
       or v_target_cold_rent_cents <= 0
       or least(
         v_contract_cold_rent_cents,
         v_service_charge_cents,
         v_parking_rent_cents
       ) < 0
       or v_ancillary_charge_type not in ('advance', 'flat_rate', 'none')
       or (
         v_ancillary_charge_type = 'none'
         and v_service_charge_cents <> 0
       )
       or (
         v_property_mode = 'existing'
         and v_unit_status = 'rented'
         and v_contract_cold_rent_cents <= 0
       )
       or (
         v_property_mode = 'scenario'
         and v_unit_status = 'rented'
       ) then
      raise exception 'Unit % has inconsistent contract/market rent values',
        v_unit_position using errcode = '22023';
    end if;

    select unit_row.id
      into v_unit_id
      from public.units as unit_row
     where unit_row.organization_id = p_organization_id
       and unit_row.property_id = v_property_id
       and unit_row.unit_number = v_unit_number
       and unit_row.archived_at is null
     for update;

    if v_unit_id is null then
      raise exception 'Onboarding unit % was not found', v_unit_position
        using errcode = 'P0002';
    end if;

    update public.units
       set target_cold_rent_cents = v_target_cold_rent_cents,
           ancillary_prepayment_cents = v_service_charge_cents,
           ancillary_charge_type = v_ancillary_charge_type,
           parking_rent_cents = v_parking_rent_cents,
           status = v_unit_status,
           vacancy_since = case
             when v_unit_status = 'vacant'
               then coalesce(vacancy_since, current_date)
             else null
           end
     where id = v_unit_id
       and organization_id = p_organization_id;

    v_expected_monthly_rent_cents :=
      v_expected_monthly_rent_cents + v_target_cold_rent_cents;

    if v_property_mode = 'existing' and v_unit_status = 'rented' then
      select lease_row.id
        into v_lease_id
        from public.leases as lease_row
       where lease_row.organization_id = p_organization_id
         and lease_row.unit_id = v_unit_id
         and lease_row.status in ('active', 'notice_given')
         and lease_row.archived_at is null
       order by lease_row.created_at desc, lease_row.id desc
       limit 1
       for update;

      if v_lease_id is null then
        raise exception 'Occupied onboarding unit % has no active lease',
          v_unit_position using errcode = '23503';
      end if;

      update public.leases
         set cold_rent_cents = v_contract_cold_rent_cents,
             ancillary_prepayment_cents = v_service_charge_cents,
             ancillary_charge_type = v_ancillary_charge_type,
             parking_rent_cents = v_parking_rent_cents
       where id = v_lease_id
         and organization_id = p_organization_id;

      select schedule_row.id
        into v_schedule_id
        from public.rent_schedules as schedule_row
       where schedule_row.organization_id = p_organization_id
         and schedule_row.lease_id = v_lease_id
       order by schedule_row.valid_from desc,
                schedule_row.created_at desc,
                schedule_row.id desc
       limit 1
       for update;

      if v_schedule_id is null then
        raise exception 'Occupied onboarding unit % has no rent schedule',
          v_unit_position using errcode = '23503';
      end if;

      update public.rent_schedules
         set cold_rent_cents = v_contract_cold_rent_cents,
             ancillary_prepayment_cents = v_service_charge_cents,
             ancillary_charge_type = v_ancillary_charge_type,
             parking_rent_cents = v_parking_rent_cents
       where id = v_schedule_id
         and organization_id = p_organization_id;
    end if;

    v_unit_id := null;
    v_lease_id := null;
    v_schedule_id := null;
  end loop;

  update public.properties
     set expected_monthly_rent_cents = v_expected_monthly_rent_cents
   where id = v_property_id
     and organization_id = p_organization_id;

  -- Detailed financing replaces the zero-rate placeholder used by v1. A
  -- marker in notes makes retries update the same record without treating a
  -- later user-created loan as onboarding state.
  begin
    v_financing_enabled := coalesce(
      (p_payload #>> '{financing,enabled}')::boolean,
      false
    );
  exception
    when invalid_text_representation then
      raise exception 'Financing enabled flag is invalid'
        using errcode = '22023';
  end;

  if v_financing_enabled then
    begin
      v_loan_type := p_payload #>> '{financing,loanType}';
      v_lender_name := nullif(
        btrim(p_payload #>> '{financing,lenderName}'),
        ''
      );
      v_original_principal_cents := round(
        (p_payload #>> '{financing,originalPrincipal}')::numeric * 100
      )::bigint;
      v_current_balance_cents := round(
        (p_payload #>> '{financing,currentBalance}')::numeric * 100
      )::bigint;
      v_nominal_interest_rate := (
        (p_payload #>> '{financing,nominalInterestRate}')::numeric / 100
      )::numeric(9,6);
      v_initial_repayment_rate := case
        when nullif(
          p_payload #>> '{financing,initialRepaymentRate}',
          ''
        ) is null then null
        else (
          (p_payload #>> '{financing,initialRepaymentRate}')::numeric / 100
        )::numeric(9,6)
      end;
      v_monthly_payment_cents := round(
        (p_payload #>> '{financing,monthlyPayment}')::numeric * 100
      )::bigint;
      v_disbursed_on := case
        when nullif(p_payload #>> '{financing,disbursedOn}', '') is null
          then null
        else (p_payload #>> '{financing,disbursedOn}')::date
      end;
      v_fixed_rate_until := case
        when nullif(p_payload #>> '{financing,fixedRateUntil}', '') is null
          then null
        else (p_payload #>> '{financing,fixedRateUntil}')::date
      end;
    exception
      when invalid_text_representation
        or invalid_datetime_format
        or datetime_field_overflow
        or numeric_value_out_of_range then
        raise exception 'Financing payload contains invalid values'
          using errcode = '22023';
    end;

    if v_loan_type is null
       or v_loan_type not in (
         'annuity',
         'repayment',
         'interest_only',
         'variable',
         'other'
       )
       or v_lender_name is null
       or char_length(v_lender_name) > 160
       or v_original_principal_cents is null
       or v_original_principal_cents <= 0
       or v_current_balance_cents is null
       or v_current_balance_cents <= 0
       or v_current_balance_cents > v_original_principal_cents
       or v_nominal_interest_rate is null
       or v_nominal_interest_rate not between 0 and 1
       or (
         v_initial_repayment_rate is not null
         and v_initial_repayment_rate not between 0 and 1
       )
       or v_monthly_payment_cents is null
       or v_monthly_payment_cents <= 0
       or (
         v_disbursed_on is not null
         and v_fixed_rate_until is not null
         and v_fixed_rate_until < v_disbursed_on
       ) then
      raise exception 'Financing values are outside valid ranges'
        using errcode = '22023';
    end if;

    select loan_row.id
      into v_loan_id
      from public.loans as loan_row
     where loan_row.organization_id = p_organization_id
       and loan_row.property_id = v_property_id
       and loan_row.archived_at is null
       and (
         loan_row.notes = '[onboarding:v2]'
         or loan_row.lender_name = 'Bestehende Finanzierung (Onboarding)'
       )
     order by loan_row.created_at desc, loan_row.id desc
     limit 1
     for update;

    if v_loan_id is null then
      insert into public.loans (
        organization_id,
        property_id,
        lender_name,
        loan_type,
        original_principal_cents,
        current_balance_cents,
        nominal_interest_rate,
        initial_repayment_rate,
        monthly_payment_cents,
        disbursed_on,
        fixed_rate_until,
        status,
        notes,
        created_by
      )
      values (
        p_organization_id,
        v_property_id,
        v_lender_name,
        v_loan_type,
        v_original_principal_cents,
        v_current_balance_cents,
        v_nominal_interest_rate,
        v_initial_repayment_rate,
        v_monthly_payment_cents,
        v_disbursed_on,
        v_fixed_rate_until,
        'active',
        '[onboarding:v2]',
        v_user_id
      )
      returning id into v_loan_id;
    else
      update public.loans
         set lender_name = v_lender_name,
             loan_type = v_loan_type,
             original_principal_cents = v_original_principal_cents,
             current_balance_cents = v_current_balance_cents,
             nominal_interest_rate = v_nominal_interest_rate,
             initial_repayment_rate = v_initial_repayment_rate,
             monthly_payment_cents = v_monthly_payment_cents,
             disbursed_on = v_disbursed_on,
             fixed_rate_until = v_fixed_rate_until,
             status = 'active',
             notes = '[onboarding:v2]'
       where id = v_loan_id
         and organization_id = p_organization_id;
    end if;
  end if;

  -- Existing-property AfA from a tax return is stored as an explicit annual
  -- amount. Calculated AfA remains rate-based and versioned in the explanation;
  -- no land value enters the depreciable basis.
  v_depreciation_mode := p_payload #>> '{property,depreciationMode}';
  if v_depreciation_mode is null
     or v_depreciation_mode not in ('calculated', 'tax_return') then
    raise exception 'Depreciation mode is invalid' using errcode = '22023';
  end if;

  if v_depreciation_mode = 'tax_return' then
    if v_property_mode <> 'existing' then
      raise exception 'Tax-return AfA is available only for existing properties'
        using errcode = '22023';
    end if;
    begin
      v_manual_annual_depreciation_cents := round(
        (p_payload #>> '{property,existingAnnualDepreciation}')::numeric * 100
      )::bigint;
    exception
      when invalid_text_representation or numeric_value_out_of_range then
        raise exception 'Existing annual depreciation is invalid'
          using errcode = '22023';
    end;
    if v_manual_annual_depreciation_cents is null
       or v_manual_annual_depreciation_cents <= 0 then
      raise exception 'Existing annual depreciation must be positive'
        using errcode = '22023';
    end if;
    v_annual_rate := null;
  else
    v_manual_annual_depreciation_cents := null;
    v_annual_rate := case
      when v_property_type = 'commercial' and v_construction_year > 1985
        then 0.03
      when v_property_type = 'commercial' then 0.025
      when v_construction_year >= 2023 then 0.03
      when v_construction_year >= 1925 then 0.02
      else 0.025
    end;
  end if;

  begin
    v_tax_year := (p_payload #>> '{organization,taxYear}')::integer;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Tax year is invalid' using errcode = '22023';
  end;

  if v_tax_year is null or v_tax_year not between 1900 and 2200 then
    raise exception 'Tax year is invalid' using errcode = '22023';
  end if;

  select tax_year_row.id
    into v_tax_year_id
    from public.tax_years as tax_year_row
   where tax_year_row.organization_id = p_organization_id
     and tax_year_row.year = v_tax_year
   limit 1;

  if v_tax_year_id is null then
    raise exception 'Tax year created by onboarding was not found'
      using errcode = 'P0002';
  end if;

  select asset_row.id
    into v_depreciation_asset_id
    from public.depreciation_assets as asset_row
   where asset_row.organization_id = p_organization_id
     and asset_row.property_id = v_property_id
     and asset_row.name = 'Gebäude-AfA (Onboarding v2)'
     and asset_row.archived_at is null
   order by asset_row.created_at desc, asset_row.id desc
   limit 1
   for update;

  if v_depreciation_asset_id is null then
    insert into public.depreciation_assets (
      organization_id,
      property_id,
      tax_year_id,
      name,
      asset_type,
      acquisition_date,
      use_start_date,
      acquisition_cost_cents,
      land_share_cents,
      depreciable_basis_cents,
      annual_rate,
      manual_adjustment_cents,
      calculation_method,
      source_type,
      basis_as_of,
      opening_remaining_basis_cents,
      manual_annual_depreciation_cents,
      explanation,
      created_by
    )
    values (
      p_organization_id,
      v_property_id,
      v_tax_year_id,
      'Gebäude-AfA (Onboarding v2)',
      'building',
      v_purchase_date,
      v_purchase_date,
      v_total_acquisition_cost_cents,
      v_land_value_cents,
      v_building_value_cents,
      v_annual_rate,
      0,
      case
        when v_depreciation_mode = 'tax_return' then 'manual'
        else 'straight_line'
      end,
      v_depreciation_mode,
      v_purchase_date,
      case
        when v_depreciation_mode = 'calculated'
          then v_building_value_cents
        else null
      end,
      v_manual_annual_depreciation_cents,
      case
        when v_depreciation_mode = 'tax_return'
          then 'Jährliche AfA aus der Steuererklärung übernommen; Nutzereingabe, fachlich zu prüfen.'
        else 'Lineare Gebäude-AfA aus Baujahr und modellierter Gebäudebasis; Regelstand Onboarding v2.'
      end,
      v_user_id
    )
    returning id into v_depreciation_asset_id;
  else
    update public.depreciation_assets
       set tax_year_id = v_tax_year_id,
           acquisition_date = v_purchase_date,
           use_start_date = v_purchase_date,
           acquisition_cost_cents = v_total_acquisition_cost_cents,
           land_share_cents = v_land_value_cents,
           depreciable_basis_cents = v_building_value_cents,
           annual_rate = v_annual_rate,
           calculation_method = case
             when v_depreciation_mode = 'tax_return' then 'manual'
             else 'straight_line'
           end,
           source_type = v_depreciation_mode,
           basis_as_of = v_purchase_date,
           opening_remaining_basis_cents = case
             when v_depreciation_mode = 'calculated'
               then v_building_value_cents
             else null
           end,
           manual_annual_depreciation_cents =
             v_manual_annual_depreciation_cents,
           explanation = case
             when v_depreciation_mode = 'tax_return'
               then 'Jährliche AfA aus der Steuererklärung übernommen; Nutzereingabe, fachlich zu prüfen.'
             else 'Lineare Gebäude-AfA aus Baujahr und modellierter Gebäudebasis; Regelstand Onboarding v2.'
           end
     where id = v_depreciation_asset_id
       and organization_id = p_organization_id;
  end if;

  begin
    v_tax_calculation_mode := p_payload #>> '{tax,calculationMode}';
    v_manual_effective_tax_rate := case
      when nullif(
        p_payload #>> '{tax,manualEffectiveTaxRate}',
        ''
      ) is null then null
      else (
        (p_payload #>> '{tax,manualEffectiveTaxRate}')::numeric / 100
      )::numeric(7,6)
    end;
    v_other_taxable_income_cents := case
      when nullif(p_payload #>> '{tax,otherTaxableIncome}', '') is null
        then null
      else round(
        (p_payload #>> '{tax,otherTaxableIncome}')::numeric * 100
      )::bigint
    end;
    v_assessment_type := case p_payload #>> '{tax,filingStatus}'
      when 'joint' then 'joint'
      when 'single' then 'individual'
      else null
    end;
    v_rental_inputs_complete := coalesce(
      (p_payload #>> '{tax,rentalIncomeComplete}')::boolean,
      false
    );
    v_calculated_marginal_rate := case
      when nullif(
        p_payload #>> '{tax,calculatedMarginalTaxRate}',
        ''
      ) is not null then (
        (p_payload #>> '{tax,calculatedMarginalTaxRate}')::numeric / 100
      )::numeric(7,6)
      when nullif(
        p_payload #>> '{derived,automaticTaxEstimate,marginalTaxRate}',
        ''
      ) is not null then (
        p_payload #>> '{derived,automaticTaxEstimate,marginalTaxRate}'
      )::numeric(7,6)
      else null
    end;
    v_calculated_effective_rate := case
      when nullif(
        p_payload #>> '{tax,calculatedEffectiveTaxRate}',
        ''
      ) is not null then (
        (p_payload #>> '{tax,calculatedEffectiveTaxRate}')::numeric / 100
      )::numeric(7,6)
      when nullif(
        p_payload #>> '{derived,automaticTaxEstimate,effectiveTaxRate}',
        ''
      ) is not null then (
        p_payload #>> '{derived,automaticTaxEstimate,effectiveTaxRate}'
      )::numeric(7,6)
      else null
    end;
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'Tax payload contains invalid values'
        using errcode = '22023';
  end;

  if v_tax_calculation_mode is null
     or v_tax_calculation_mode not in ('automatic', 'manual')
     or v_assessment_type is null
     or (
       v_manual_effective_tax_rate is not null
       and v_manual_effective_tax_rate not between 0 and 1
     )
     or (
       v_calculated_marginal_rate is not null
       and v_calculated_marginal_rate not between 0 and 1
     )
     or (
       v_calculated_effective_rate is not null
       and v_calculated_effective_rate not between 0 and 1
     )
     or (
       v_other_taxable_income_cents is not null
       and v_other_taxable_income_cents < 0
     )
     or (
       v_tax_calculation_mode = 'manual'
       and v_manual_effective_tax_rate is null
     )
     or (
       v_tax_calculation_mode = 'automatic'
       and (
         v_other_taxable_income_cents is null
         or not v_rental_inputs_complete
         or v_tax_year <> 2026
         or v_calculated_marginal_rate is null
         or v_calculated_effective_rate is null
       )
     ) then
    raise exception 'Tax values are incomplete or outside valid ranges'
      using errcode = '22023';
  end if;

  update public.tax_profiles
     set calculation_mode = v_tax_calculation_mode,
         effective_tax_rate = case
           when v_tax_calculation_mode = 'manual'
             then v_manual_effective_tax_rate
           else v_calculated_effective_rate
         end,
         marginal_tax_rate = case
           when v_tax_calculation_mode = 'automatic'
             then v_calculated_marginal_rate
           else null
         end,
         other_taxable_income_cents = case
           when v_tax_calculation_mode = 'automatic'
             then v_other_taxable_income_cents
           else null
         end,
         assumed_taxable_income_cents = case
           when v_tax_calculation_mode = 'automatic'
             then v_other_taxable_income_cents
           else null
         end,
         assessment_type = v_assessment_type,
         church_tax_enabled = coalesce(
           (p_payload #>> '{tax,churchTax}')::boolean,
           false
         ),
         solidarity_surcharge_enabled = coalesce(
           (p_payload #>> '{tax,solidaritySurcharge}')::boolean,
           false
         ),
         calculations_enabled = true,
         rental_inputs_confirmed_at = case
           when v_rental_inputs_complete
             then coalesce(rental_inputs_confirmed_at, now())
           else null
         end,
         tariff_year = case
           when v_tax_calculation_mode = 'automatic' then 2026
           else null
         end,
         tariff_version = case
           when v_tax_calculation_mode = 'automatic'
             then 'de_estg_32a_2026_v1'
           else null
         end
   where organization_id = p_organization_id
     and user_id = v_user_id;

  if not found then
    raise exception 'Tax profile created by onboarding was not found'
      using errcode = 'P0002';
  end if;

  -- The first market value is deliberately a transparent low-confidence
  -- purchase-price proxy. It is history-backed, unlike the former direct
  -- property field, and later manual/verified valuations remain authoritative.
  select valuation_row.id
    into v_proxy_valuation_id
    from public.valuations as valuation_row
   where valuation_row.organization_id = p_organization_id
     and valuation_row.property_id = v_property_id
     and valuation_row.source_type = 'purchase_price_proxy'
     and valuation_row.assumptions @> '{"onboardingV2": true}'::jsonb
   order by valuation_row.created_at
   limit 1
   for update;

  if v_proxy_valuation_id is null then
    insert into public.valuations (
      organization_id,
      property_id,
      valued_on,
      market_value_cents,
      source_type,
      source_name,
      confidence,
      assumptions,
      created_by
    )
    values (
      p_organization_id,
      v_property_id,
      current_date,
      v_purchase_price_cents,
      'purchase_price_proxy',
      'Onboarding-Schätzung auf Basis des Kaufpreises',
      0.25,
      jsonb_build_object(
        'onboardingV2', true,
        'method', 'purchase_price_proxy',
        'purchaseDate', v_purchase_date,
        'note', 'Unverbindlicher Startwert; aktuelle Marktwertermittlung ausstehend.'
      ),
      v_user_id
    )
    returning id into v_proxy_valuation_id;
  end if;

  update public.properties
     set market_value_status = case
           when market_value_status in ('manual', 'verified')
             then market_value_status
           else 'estimated'
         end,
         market_value_source = case
           when market_value_status in ('manual', 'verified')
             then market_value_source
           else 'purchase_price_proxy'
         end
   where id = v_property_id
     and organization_id = p_organization_id;

  if v_property_mode = 'existing' then
    -- Idempotent through rent_claims(lease_id, claim_month). Scenario mode
    -- never enters this path and is additionally protected by triggers.
    perform public.generate_monthly_rent_claims(
      p_organization_id,
      current_date
    );
  end if;

  return v_property_id;
end
$$;

revoke all on function public.finalize_onboarding_v2(uuid, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.finalize_onboarding_v2(uuid, jsonb)
  to authenticated;

comment on function public.finalize_onboarding_v2(uuid, jsonb) is
  'Owner-only idempotent phase after complete_onboarding/resume_portfolio_onboarding. Persists acquisition allocation, contract vs market rent, financing, AfA source, tax mode and a purchase-price-proxy valuation; returns the finalized property UUID.';

-- Keep the legacy creation boundary and the v2 fachliche finalization in one
-- database transaction. If either phase fails, PostgreSQL rolls back the
-- organization/property setup instead of leaving a partially upgraded
-- portfolio behind.
create or replace function public.complete_onboarding_v2(
  p_legacy_payload jsonb,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_organization_id uuid;
begin
  v_organization_id := public.complete_onboarding(p_legacy_payload);
  perform public.finalize_onboarding_v2(v_organization_id, p_payload);
  return v_organization_id;
end
$$;

create or replace function public.resume_portfolio_onboarding_v2(
  p_organization_id uuid,
  p_legacy_payload jsonb,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_organization_id uuid;
begin
  v_organization_id := public.resume_portfolio_onboarding(
    p_organization_id,
    p_legacy_payload
  );
  perform public.finalize_onboarding_v2(v_organization_id, p_payload);
  return v_organization_id;
end
$$;

revoke all on function public.complete_onboarding_v2(jsonb, jsonb)
  from public, anon, authenticated, service_role;
grant execute on function public.complete_onboarding_v2(jsonb, jsonb)
  to authenticated;

revoke all on function public.resume_portfolio_onboarding_v2(
  uuid,
  jsonb,
  jsonb
) from public, anon, authenticated, service_role;
grant execute on function public.resume_portfolio_onboarding_v2(
  uuid,
  jsonb,
  jsonb
) to authenticated;

comment on function public.complete_onboarding_v2(jsonb, jsonb) is
  'Atomically creates a first portfolio with the legacy persistence boundary and applies all v2 acquisition, rent, financing, tax and valuation semantics.';
comment on function public.resume_portfolio_onboarding_v2(uuid, jsonb, jsonb) is
  'Atomically resumes an owner portfolio setup and applies all v2 acquisition, rent, financing, tax and valuation semantics.';

commit;
