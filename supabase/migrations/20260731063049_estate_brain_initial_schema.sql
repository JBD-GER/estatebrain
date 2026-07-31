-- Estate Brain initial multi-tenant schema
-- Monetary values are stored as integer cents unless a column explicitly says otherwise.

begin;

create extension if not exists pgcrypto with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

alter default privileges in schema private revoke execute on functions from public, anon;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;

create type public.app_role as enum (
  'owner',
  'admin',
  'property_manager',
  'accounting',
  'employee',
  'tenant'
);

create type public.membership_status as enum ('invited', 'active', 'suspended');
create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');
create type public.organization_kind as enum ('private_person', 'company');
create type public.record_status as enum ('draft', 'active', 'inactive', 'archived');
create type public.priority_level as enum ('low', 'medium', 'high', 'urgent');
create type public.payment_status as enum ('open', 'partial', 'paid', 'overpaid', 'cancelled');
create type public.match_status as enum ('unmatched', 'suggested', 'confirmed', 'rejected');
create type public.document_review_status as enum (
  'complete',
  'missing',
  'unreadable',
  'unclear_assignment',
  'review_required',
  'reviewed'
);
create type public.task_status as enum ('open', 'in_progress', 'blocked', 'done', 'cancelled');
create type public.sync_status as enum ('pending', 'running', 'succeeded', 'failed', 'partial');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  display_name text,
  phone text,
  avatar_url text,
  locale text not null default 'de-DE',
  timezone text not null default 'Europe/Berlin',
  onboarding_completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_format check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint profiles_locale_length check (char_length(locale) between 2 and 16),
  constraint profiles_timezone_length check (char_length(timezone) between 1 and 64)
);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind public.organization_kind not null default 'private_person',
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  street text,
  house_number text,
  postal_code text,
  city text,
  country_code text not null default 'DE',
  default_currency text not null default 'EUR',
  tax_year_start_month smallint not null default 1,
  demo_seeded_at timestamptz,
  retention_days integer,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint organizations_name_length check (char_length(trim(name)) between 2 and 160),
  constraint organizations_country_code check (country_code ~ '^[A-Z]{2}$'),
  constraint organizations_currency check (default_currency ~ '^[A-Z]{3}$'),
  constraint organizations_tax_year_month check (tax_year_start_month between 1 and 12),
  constraint organizations_retention_days check (retention_days is null or retention_days >= 0),
  constraint organizations_settings_object check (jsonb_typeof(settings) = 'object')
);

create table public.organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  status public.membership_status not null default 'active',
  is_property_restricted boolean not null default false,
  invited_by uuid references auth.users(id) on delete set null,
  joined_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint organization_members_unique_user unique (organization_id, user_id),
  constraint organization_members_active_joined check (
    status <> 'active' or joined_at is not null
  )
);

create unique index organization_members_one_active_owner_idx
  on public.organization_members (organization_id)
  where role = 'owner' and status = 'active';

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  role public.app_role not null,
  token_hash bytea not null unique,
  status public.invitation_status not null default 'pending',
  expires_at timestamptz not null,
  invited_by uuid not null references auth.users(id) on delete restrict,
  accepted_by uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  tenant_id uuid,
  property_restricted boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invitations_email_format check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint invitations_expiry_after_creation check (expires_at > created_at),
  constraint invitations_acceptance_consistent check (
    (status = 'accepted' and accepted_by is not null and accepted_at is not null)
    or status <> 'accepted'
  ),
  constraint invitations_tenant_role_consistent check (
    (role = 'tenant' and tenant_id is not null)
    or (role <> 'tenant' and tenant_id is null)
  )
);

create unique index invitations_one_pending_email_idx
  on public.invitations (organization_id, lower(email))
  where status = 'pending';

create table public.properties (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  property_type text not null default 'apartment_building',
  street text not null,
  house_number text,
  postal_code text not null,
  city text not null,
  country_code text not null default 'DE',
  latitude numeric(9,6),
  longitude numeric(9,6),
  construction_year smallint,
  purchase_date date,
  purchase_price_cents bigint,
  acquisition_costs_cents bigint not null default 0,
  land_value_cents bigint,
  building_value_cents bigint,
  total_area_sqm numeric(12,2),
  rentable_area_sqm numeric(12,2),
  current_market_value_cents bigint,
  expected_monthly_rent_cents bigint,
  unit_count integer,
  energy_rating text,
  energy_consumption_kwh_sqm numeric(10,2),
  annual_management_cost_cents bigint not null default 0,
  annual_insurance_cost_cents bigint not null default 0,
  annual_property_tax_cents bigint not null default 0,
  annual_non_recoverable_cost_cents bigint not null default 0,
  notes text,
  status public.record_status not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint properties_name_length check (char_length(trim(name)) between 1 and 160),
  constraint properties_country_code check (country_code ~ '^[A-Z]{2}$'),
  constraint properties_latitude check (latitude is null or latitude between -90 and 90),
  constraint properties_longitude check (longitude is null or longitude between -180 and 180),
  constraint properties_construction_year check (
    construction_year is null or construction_year between 1000 and 2200
  ),
  constraint properties_nonnegative_money check (
    (purchase_price_cents is null or purchase_price_cents >= 0)
    and acquisition_costs_cents >= 0
    and (land_value_cents is null or land_value_cents >= 0)
    and (building_value_cents is null or building_value_cents >= 0)
    and (current_market_value_cents is null or current_market_value_cents >= 0)
    and (expected_monthly_rent_cents is null or expected_monthly_rent_cents >= 0)
    and annual_management_cost_cents >= 0
    and annual_insurance_cost_cents >= 0
    and annual_property_tax_cents >= 0
    and annual_non_recoverable_cost_cents >= 0
  ),
  constraint properties_areas check (
    (total_area_sqm is null or total_area_sqm > 0)
    and (rentable_area_sqm is null or rentable_area_sqm > 0)
    and (total_area_sqm is null or rentable_area_sqm is null or rentable_area_sqm <= total_area_sqm)
  ),
  constraint properties_unit_count check (unit_count is null or unit_count >= 0)
);

create table public.property_assignments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  member_id uuid not null references public.organization_members(id) on delete cascade,
  can_manage_tasks boolean not null default true,
  can_manage_documents boolean not null default true,
  can_manage_messages boolean not null default true,
  valid_from date,
  valid_until date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint property_assignments_unique unique (property_id, member_id),
  constraint property_assignments_date_order check (
    valid_until is null or valid_from is null or valid_until >= valid_from
  )
);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  unit_number text not null,
  address_addition text,
  floor text,
  area_sqm numeric(10,2),
  rooms numeric(5,2),
  unit_type text not null default 'apartment',
  target_cold_rent_cents bigint not null default 0,
  ancillary_prepayment_cents bigint not null default 0,
  parking_rent_cents bigint not null default 0,
  other_rent_cents bigint not null default 0,
  deposit_target_cents bigint not null default 0,
  status text not null default 'vacant',
  vacancy_since date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint units_unique_number unique (property_id, unit_number),
  constraint units_area check (area_sqm is null or area_sqm > 0),
  constraint units_rooms check (rooms is null or rooms > 0),
  constraint units_nonnegative_money check (
    target_cold_rent_cents >= 0
    and ancillary_prepayment_cents >= 0
    and parking_rent_cents >= 0
    and other_rent_cents >= 0
    and deposit_target_cents >= 0
  ),
  constraint units_status check (status in ('vacant', 'rented', 'reserved', 'renovation', 'inactive'))
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tenant_type text not null default 'person',
  first_name text,
  last_name text,
  company_name text,
  email text,
  phone text,
  street text,
  house_number text,
  postal_code text,
  city text,
  country_code text not null default 'DE',
  notes text,
  status public.record_status not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint tenants_type check (tenant_type in ('person', 'company')),
  constraint tenants_name check (
    (tenant_type = 'person' and coalesce(char_length(trim(first_name)), 0) + coalesce(char_length(trim(last_name)), 0) > 0)
    or (tenant_type = 'company' and coalesce(char_length(trim(company_name)), 0) > 0)
  ),
  constraint tenants_email_format check (email is null or email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  constraint tenants_country_code check (country_code ~ '^[A-Z]{2}$')
);

alter table public.invitations
  add constraint invitations_tenant_fk
  foreign key (tenant_id) references public.tenants(id) on delete cascade;

create table public.tenant_users (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  is_primary boolean not null default false,
  verified_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_users_unique unique (tenant_id, user_id),
  constraint tenant_users_unique_user_per_org unique (organization_id, user_id)
);

create table public.leases (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  unit_id uuid not null references public.units(id) on delete restrict,
  lease_number text,
  starts_on date not null,
  ends_on date,
  notice_period_months smallint not null default 3,
  due_day smallint not null default 3,
  cold_rent_cents bigint not null,
  ancillary_prepayment_cents bigint not null default 0,
  parking_rent_cents bigint not null default 0,
  other_rent_cents bigint not null default 0,
  deposit_cents bigint not null default 0,
  deposit_paid_cents bigint not null default 0,
  deposit_status public.payment_status not null default 'open',
  status text not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint leases_date_order check (ends_on is null or ends_on >= starts_on),
  constraint leases_notice check (notice_period_months between 0 and 120),
  constraint leases_due_day check (due_day between 1 and 31),
  constraint leases_nonnegative_money check (
    cold_rent_cents >= 0
    and ancillary_prepayment_cents >= 0
    and parking_rent_cents >= 0
    and other_rent_cents >= 0
    and deposit_cents >= 0
    and deposit_paid_cents >= 0
  ),
  constraint leases_status check (status in ('draft', 'active', 'notice_given', 'ended', 'cancelled'))
);

create unique index leases_one_current_per_unit_idx
  on public.leases (unit_id)
  where status in ('active', 'notice_given') and archived_at is null;

create table public.lease_tenants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lease_id uuid not null references public.leases(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete restrict,
  is_primary boolean not null default false,
  occupancy_starts_on date,
  occupancy_ends_on date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint lease_tenants_unique unique (lease_id, tenant_id),
  constraint lease_tenants_date_order check (
    occupancy_ends_on is null
    or occupancy_starts_on is null
    or occupancy_ends_on >= occupancy_starts_on
  )
);

create unique index lease_tenants_one_primary_idx
  on public.lease_tenants (lease_id)
  where is_primary;

create table public.rent_schedules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lease_id uuid not null references public.leases(id) on delete cascade,
  valid_from date not null,
  valid_until date,
  due_day smallint not null default 3,
  cold_rent_cents bigint not null,
  ancillary_prepayment_cents bigint not null default 0,
  parking_rent_cents bigint not null default 0,
  other_rent_cents bigint not null default 0,
  reason text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rent_schedules_date_order check (valid_until is null or valid_until >= valid_from),
  constraint rent_schedules_due_day check (due_day between 1 and 31),
  constraint rent_schedules_nonnegative_money check (
    cold_rent_cents >= 0
    and ancillary_prepayment_cents >= 0
    and parking_rent_cents >= 0
    and other_rent_cents >= 0
  )
);

create table public.rent_claims (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  lease_id uuid not null references public.leases(id) on delete restrict,
  rent_schedule_id uuid references public.rent_schedules(id) on delete set null,
  claim_month date not null,
  due_date date not null,
  cold_rent_cents bigint not null default 0,
  ancillary_cents bigint not null default 0,
  parking_cents bigint not null default 0,
  other_cents bigint not null default 0,
  amount_cents bigint generated always as (
    cold_rent_cents + ancillary_cents + parking_cents + other_cents
  ) stored,
  paid_cents bigint not null default 0,
  status public.payment_status not null default 'open',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rent_claims_month_start check (claim_month = date_trunc('month', claim_month)::date),
  constraint rent_claims_nonnegative_money check (
    cold_rent_cents >= 0
    and ancillary_cents >= 0
    and parking_cents >= 0
    and other_cents >= 0
    and paid_cents >= 0
  ),
  constraint rent_claims_unique unique (lease_id, claim_month)
);

create table public.bank_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  provider text not null,
  provider_connection_ref text,
  mode text not null default 'demo',
  status text not null default 'pending',
  consent_expires_at timestamptz,
  last_synced_at timestamptz,
  error_code text,
  error_message text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint bank_connections_mode check (mode in ('demo', 'provider')),
  constraint bank_connections_status check (status in ('pending', 'active', 'reauthorization_required', 'error', 'revoked'))
);

create unique index bank_connections_provider_ref_idx
  on public.bank_connections (provider, provider_connection_ref)
  where provider_connection_ref is not null;

create table public.bank_accounts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  connection_id uuid references public.bank_connections(id) on delete set null,
  property_id uuid references public.properties(id) on delete set null,
  provider_account_ref text,
  account_name text not null,
  iban_last4 text,
  iban_hash bytea,
  currency text not null default 'EUR',
  account_type text,
  current_balance_cents bigint,
  available_balance_cents bigint,
  balance_as_of timestamptz,
  is_primary boolean not null default false,
  status public.record_status not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint bank_accounts_iban_last4 check (iban_last4 is null or iban_last4 ~ '^[A-Z0-9]{4}$'),
  constraint bank_accounts_currency check (currency ~ '^[A-Z]{3}$'),
  constraint bank_accounts_provider_ref_unique unique (connection_id, provider_account_ref)
);

create table public.bank_transactions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bank_account_id uuid not null references public.bank_accounts(id) on delete cascade,
  provider_transaction_ref text,
  booked_on date not null,
  value_on date,
  amount_cents bigint not null,
  currency text not null default 'EUR',
  counterparty_name text,
  counterparty_iban_last4 text,
  counterparty_iban_hash bytea,
  remittance_information text,
  bank_code text,
  match_status public.match_status not null default 'unmatched',
  is_ignored boolean not null default false,
  raw_data jsonb not null default '{}'::jsonb,
  imported_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint bank_transactions_currency check (currency ~ '^[A-Z]{3}$'),
  constraint bank_transactions_raw_object check (jsonb_typeof(raw_data) = 'object'),
  constraint bank_transactions_provider_unique unique (bank_account_id, provider_transaction_ref)
);

create table public.expense_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  name text not null,
  parent_id uuid references public.expense_categories(id) on delete set null,
  is_tax_relevant_default boolean not null default false,
  is_cash_effective_default boolean not null default true,
  is_capitalizable_default boolean not null default false,
  is_recoverable_default boolean not null default false,
  sort_order integer not null default 0,
  is_system boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint expense_categories_unique_code unique (organization_id, code),
  constraint expense_categories_code check (code ~ '^[a-z0-9][a-z0-9_-]{1,63}$'),
  constraint expense_categories_name check (char_length(trim(name)) between 1 and 120)
);

create table public.income_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete restrict,
  unit_id uuid references public.units(id) on delete set null,
  lease_id uuid references public.leases(id) on delete set null,
  bank_transaction_id uuid references public.bank_transactions(id) on delete set null,
  entry_date date not null,
  amount_cents bigint not null,
  currency text not null default 'EUR',
  category text not null,
  description text not null,
  payment_status public.payment_status not null default 'paid',
  tax_relevant boolean,
  tax_year integer,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint income_entries_amount check (amount_cents >= 0),
  constraint income_entries_currency check (currency ~ '^[A-Z]{3}$'),
  constraint income_entries_tax_year check (tax_year is null or tax_year between 1900 and 2200)
);

create table public.expense_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete restrict,
  unit_id uuid references public.units(id) on delete set null,
  category_id uuid references public.expense_categories(id) on delete set null,
  bank_transaction_id uuid references public.bank_transactions(id) on delete set null,
  entry_date date not null,
  service_date date,
  amount_cents bigint not null,
  net_amount_cents bigint,
  tax_amount_cents bigint,
  currency text not null default 'EUR',
  description text not null,
  payment_status public.payment_status not null default 'open',
  document_status public.document_review_status not null default 'missing',
  is_cash_effective boolean not null default true,
  is_tax_relevant boolean,
  is_interest boolean not null default false,
  is_principal boolean not null default false,
  is_capitalizable boolean not null default false,
  is_deductible boolean,
  is_recoverable boolean not null default false,
  tax_year integer,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint expense_entries_amounts check (
    amount_cents >= 0
    and (net_amount_cents is null or net_amount_cents >= 0)
    and (tax_amount_cents is null or tax_amount_cents >= 0)
    and (net_amount_cents is null or tax_amount_cents is null or net_amount_cents + tax_amount_cents = amount_cents)
  ),
  constraint expense_entries_currency check (currency ~ '^[A-Z]{3}$'),
  constraint expense_entries_tax_year check (tax_year is null or tax_year between 1900 and 2200),
  constraint expense_entries_interest_principal check (not (is_interest and is_principal))
);

create table public.rent_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  rent_claim_id uuid not null references public.rent_claims(id) on delete restrict,
  bank_transaction_id uuid references public.bank_transactions(id) on delete set null,
  paid_on date not null,
  amount_cents bigint not null,
  allocation_status text not null default 'confirmed',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint rent_payments_amount check (amount_cents > 0),
  constraint rent_payments_allocation_status check (allocation_status in ('suggested', 'confirmed', 'reversed')),
  constraint rent_payments_unique_transaction unique (rent_claim_id, bank_transaction_id)
);

create table public.transaction_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  bank_transaction_id uuid not null references public.bank_transactions(id) on delete cascade,
  rent_claim_id uuid references public.rent_claims(id) on delete cascade,
  income_entry_id uuid references public.income_entries(id) on delete cascade,
  expense_entry_id uuid references public.expense_entries(id) on delete cascade,
  confidence numeric(5,4),
  explanation text not null,
  status public.match_status not null default 'suggested',
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  rejected_by uuid references auth.users(id) on delete set null,
  rejected_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transaction_matches_one_target check (
    num_nonnulls(rent_claim_id, income_entry_id, expense_entry_id) = 1
  ),
  constraint transaction_matches_confidence check (confidence is null or confidence between 0 and 1),
  constraint transaction_matches_confirmation check (
    (status = 'confirmed' and confirmed_by is not null and confirmed_at is not null)
    or status <> 'confirmed'
  ),
  constraint transaction_matches_rejection check (
    (status = 'rejected' and rejected_by is not null and rejected_at is not null)
    or status <> 'rejected'
  )
);

create unique index transaction_matches_one_confirmed_transaction_idx
  on public.transaction_matches (bank_transaction_id)
  where status = 'confirmed';

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid references public.properties(id) on delete set null,
  unit_id uuid references public.units(id) on delete set null,
  lease_id uuid references public.leases(id) on delete set null,
  storage_bucket text not null default 'documents',
  storage_path text not null,
  original_file_name text not null,
  mime_type text not null,
  size_bytes bigint not null,
  sha256 bytea,
  document_type text not null default 'other',
  title text,
  document_date date,
  review_status public.document_review_status not null default 'review_required',
  payment_status public.payment_status,
  tenant_visible boolean not null default false,
  ocr_status public.sync_status not null default 'pending',
  archived_at timestamptz,
  retention_until date,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint documents_storage_bucket check (
    storage_bucket in ('documents', 'property-images', 'message-attachments')
  ),
  constraint documents_size check (size_bytes > 0 and size_bytes <= 52428800),
  constraint documents_storage_path check (
    storage_path !~ '(^|/)\.\.?(/|$)'
    and split_part(storage_path, '/', 1) = organization_id::text
  ),
  constraint documents_unique_path unique (storage_bucket, storage_path)
);

create table public.document_extractions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  provider text not null,
  provider_version text,
  status public.sync_status not null default 'pending',
  extracted_vendor_name text,
  extracted_invoice_number text,
  extracted_invoice_date date,
  extracted_service_date date,
  gross_amount_cents bigint,
  net_amount_cents bigint,
  tax_amount_cents bigint,
  extracted_currency text,
  extracted_address jsonb,
  extracted_fields jsonb not null default '{}'::jsonb,
  confidence numeric(5,4),
  duplicate_of_document_id uuid references public.documents(id) on delete set null,
  error_code text,
  error_message text,
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_extractions_money check (
    (gross_amount_cents is null or gross_amount_cents >= 0)
    and (net_amount_cents is null or net_amount_cents >= 0)
    and (tax_amount_cents is null or tax_amount_cents >= 0)
  ),
  constraint document_extractions_currency check (
    extracted_currency is null or extracted_currency ~ '^[A-Z]{3}$'
  ),
  constraint document_extractions_confidence check (confidence is null or confidence between 0 and 1),
  constraint document_extractions_fields_object check (jsonb_typeof(extracted_fields) = 'object'),
  constraint document_extractions_address_object check (
    extracted_address is null or jsonb_typeof(extracted_address) = 'object'
  )
);

create table public.tax_profiles (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  marginal_tax_rate numeric(7,6),
  effective_tax_rate numeric(7,6),
  church_tax_enabled boolean not null default false,
  church_tax_rate numeric(7,6),
  solidarity_surcharge_enabled boolean not null default false,
  solidarity_surcharge_rate numeric(7,6),
  assumed_taxable_income_cents bigint,
  assessment_type text not null default 'individual',
  calculations_enabled boolean not null default true,
  disclaimer_accepted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tax_profiles_unique_user unique (organization_id, user_id),
  constraint tax_profiles_rates check (
    (marginal_tax_rate is null or marginal_tax_rate between 0 and 1)
    and (effective_tax_rate is null or effective_tax_rate between 0 and 1)
    and (church_tax_rate is null or church_tax_rate between 0 and 1)
    and (solidarity_surcharge_rate is null or solidarity_surcharge_rate between 0 and 1)
  ),
  constraint tax_profiles_income check (
    assumed_taxable_income_cents is null or assumed_taxable_income_cents >= 0
  ),
  constraint tax_profiles_assessment_type check (assessment_type in ('individual', 'joint'))
);

create table public.tax_years (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  year integer not null,
  status text not null default 'open',
  locked_at timestamptz,
  locked_by uuid references auth.users(id) on delete set null,
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tax_years_unique unique (organization_id, year),
  constraint tax_years_year check (year between 1900 and 2200),
  constraint tax_years_status check (status in ('open', 'in_review', 'prepared', 'locked', 'archived')),
  constraint tax_years_lock_consistent check (
    (status = 'locked' and locked_at is not null and locked_by is not null)
    or status <> 'locked'
  )
);

create table public.tax_assumptions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tax_year_id uuid not null references public.tax_years(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  assumption_key text not null,
  numeric_value numeric(20,6),
  amount_cents bigint,
  text_value text,
  boolean_value boolean,
  unit text,
  explanation text not null,
  source text,
  is_user_confirmed boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tax_assumptions_one_value check (
    num_nonnulls(numeric_value, amount_cents, text_value, boolean_value) = 1
  ),
  constraint tax_assumptions_amount check (amount_cents is null or amount_cents >= 0),
  constraint tax_assumptions_unique unique (tax_year_id, property_id, assumption_key)
);

create table public.depreciation_assets (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  tax_year_id uuid references public.tax_years(id) on delete set null,
  name text not null,
  asset_type text not null default 'building',
  acquisition_date date not null,
  use_start_date date not null,
  acquisition_cost_cents bigint not null,
  land_share_cents bigint not null default 0,
  depreciable_basis_cents bigint not null,
  annual_rate numeric(7,6) not null,
  useful_life_years numeric(8,2),
  manual_adjustment_cents bigint not null default 0,
  calculation_method text not null default 'straight_line',
  explanation text not null,
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint depreciation_assets_costs check (
    acquisition_cost_cents >= 0
    and land_share_cents >= 0
    and depreciable_basis_cents >= 0
    and land_share_cents <= acquisition_cost_cents
  ),
  constraint depreciation_assets_rate check (annual_rate > 0 and annual_rate <= 1),
  constraint depreciation_assets_life check (useful_life_years is null or useful_life_years > 0),
  constraint depreciation_assets_method check (calculation_method in ('straight_line', 'manual'))
);

create table public.tax_calculation_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  tax_year_id uuid not null references public.tax_years(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  calculated_for_user_id uuid references auth.users(id) on delete set null,
  period_start date not null,
  period_end date not null,
  rental_income_cents bigint not null default 0,
  operating_expenses_cents bigint not null default 0,
  interest_cents bigint not null default 0,
  depreciation_cents bigint not null default 0,
  other_deductible_cents bigint not null default 0,
  estimated_taxable_result_cents bigint not null default 0,
  assumed_tax_rate numeric(7,6) not null default 0,
  estimated_tax_effect_cents bigint not null default 0,
  cashflow_before_tax_cents bigint not null default 0,
  cashflow_after_tax_cents bigint not null default 0,
  calculation_input jsonb not null,
  calculation_version text not null,
  disclaimer text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tax_snapshots_period check (period_end >= period_start),
  constraint tax_snapshots_rate check (assumed_tax_rate between 0 and 1),
  constraint tax_snapshots_input_object check (jsonb_typeof(calculation_input) = 'object')
);

create table public.loans (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete restrict,
  lender_name text not null,
  loan_number text,
  original_principal_cents bigint not null,
  current_balance_cents bigint not null,
  nominal_interest_rate numeric(9,6) not null,
  initial_repayment_rate numeric(9,6),
  monthly_payment_cents bigint not null,
  disbursed_on date,
  fixed_rate_until date,
  maturity_date date,
  annual_special_repayment_limit_cents bigint,
  financing_cost_cents bigint not null default 0,
  status text not null default 'active',
  notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint loans_money check (
    original_principal_cents > 0
    and current_balance_cents >= 0
    and current_balance_cents <= original_principal_cents
    and monthly_payment_cents >= 0
    and (annual_special_repayment_limit_cents is null or annual_special_repayment_limit_cents >= 0)
    and financing_cost_cents >= 0
  ),
  constraint loans_rates check (
    nominal_interest_rate >= 0 and nominal_interest_rate <= 1
    and (initial_repayment_rate is null or initial_repayment_rate between 0 and 1)
  ),
  constraint loans_dates check (
    maturity_date is null or disbursed_on is null or maturity_date >= disbursed_on
  ),
  constraint loans_status check (status in ('draft', 'active', 'refinancing_due', 'repaid', 'cancelled'))
);

create table public.loan_payments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  loan_id uuid not null references public.loans(id) on delete restrict,
  bank_transaction_id uuid references public.bank_transactions(id) on delete set null,
  due_date date not null,
  paid_on date,
  payment_cents bigint not null,
  interest_cents bigint not null,
  principal_cents bigint not null,
  fees_cents bigint not null default 0,
  remaining_balance_cents bigint,
  is_special_repayment boolean not null default false,
  status public.payment_status not null default 'open',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint loan_payments_money check (
    payment_cents >= 0
    and interest_cents >= 0
    and principal_cents >= 0
    and fees_cents >= 0
    and (remaining_balance_cents is null or remaining_balance_cents >= 0)
    and interest_cents + principal_cents + fees_cents = payment_cents
  )
);

create table public.valuations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  valued_on date not null,
  market_value_cents bigint not null,
  source_type text not null,
  source_name text,
  source_url text,
  confidence numeric(5,4),
  gross_yield numeric(9,6),
  net_yield numeric(9,6),
  expected_sale_cost_cents bigint,
  early_repayment_cost_cents bigint,
  assumptions jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint valuations_money check (
    market_value_cents >= 0
    and (expected_sale_cost_cents is null or expected_sale_cost_cents >= 0)
    and (early_repayment_cost_cents is null or early_repayment_cost_cents >= 0)
  ),
  constraint valuations_confidence check (confidence is null or confidence between 0 and 1),
  constraint valuations_yields check (
    (gross_yield is null or gross_yield >= -1)
    and (net_yield is null or net_yield >= -1)
  ),
  constraint valuations_assumptions_object check (jsonb_typeof(assumptions) = 'object')
);

create table public.market_rent_comparisons (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  unit_id uuid references public.units(id) on delete cascade,
  data_date date not null,
  source_type text not null,
  source_name text not null,
  source_url text,
  minimum_cents_per_sqm bigint,
  median_cents_per_sqm bigint not null,
  maximum_cents_per_sqm bigint,
  current_cents_per_sqm bigint,
  potential_monthly_rent_cents bigint,
  uncertainty_note text not null,
  is_demo_data boolean not null default false,
  assumptions jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_rent_values check (
    median_cents_per_sqm >= 0
    and (minimum_cents_per_sqm is null or minimum_cents_per_sqm >= 0)
    and (maximum_cents_per_sqm is null or maximum_cents_per_sqm >= median_cents_per_sqm)
    and (minimum_cents_per_sqm is null or minimum_cents_per_sqm <= median_cents_per_sqm)
    and (current_cents_per_sqm is null or current_cents_per_sqm >= 0)
    and (potential_monthly_rent_cents is null or potential_monthly_rent_cents >= 0)
  ),
  constraint market_rent_assumptions_object check (jsonb_typeof(assumptions) = 'object')
);

create table public.renovation_projects (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  unit_id uuid references public.units(id) on delete set null,
  name text not null,
  description text,
  condition_rating smallint,
  priority public.priority_level not null default 'medium',
  planned_start_date date,
  planned_end_date date,
  actual_start_date date,
  actual_end_date date,
  estimated_cost_cents bigint not null default 0,
  actual_cost_cents bigint not null default 0,
  contingency_rate numeric(7,6) not null default 0.10,
  expected_lifetime_years numeric(8,2),
  expected_monthly_rent_increase_cents bigint,
  expected_value_increase_cents bigint,
  status public.task_status not null default 'open',
  responsible_member_id uuid references public.organization_members(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint renovation_projects_condition check (condition_rating is null or condition_rating between 1 and 5),
  constraint renovation_projects_dates check (
    (planned_end_date is null or planned_start_date is null or planned_end_date >= planned_start_date)
    and (actual_end_date is null or actual_start_date is null or actual_end_date >= actual_start_date)
  ),
  constraint renovation_projects_money check (
    estimated_cost_cents >= 0
    and actual_cost_cents >= 0
    and (expected_monthly_rent_increase_cents is null or expected_monthly_rent_increase_cents >= 0)
    and (expected_value_increase_cents is null or expected_value_increase_cents >= 0)
  ),
  constraint renovation_projects_contingency check (contingency_rate between 0 and 1),
  constraint renovation_projects_lifetime check (expected_lifetime_years is null or expected_lifetime_years > 0)
);

create table public.renovation_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  renovation_project_id uuid not null references public.renovation_projects(id) on delete cascade,
  category text not null,
  description text not null,
  quantity numeric(12,3) not null default 1,
  unit text not null default 'pauschal',
  estimated_unit_cost_cents bigint not null default 0,
  actual_cost_cents bigint not null default 0,
  quote_vendor text,
  status public.task_status not null default 'open',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint renovation_items_quantity check (quantity > 0),
  constraint renovation_items_costs check (
    estimated_unit_cost_cents >= 0 and actual_cost_cents >= 0
  ),
  constraint renovation_items_category check (
    category in (
      'roof', 'facade', 'windows', 'heating', 'electrical', 'sanitary',
      'pipes', 'floors', 'interior', 'energy', 'fire_protection',
      'outdoor', 'other'
    )
  )
);

create table public.maintenance_reserves (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete cascade,
  as_of_date date not null,
  current_balance_cents bigint not null default 0,
  monthly_contribution_cents bigint not null default 0,
  target_balance_cents bigint,
  calculation_basis text,
  assumptions jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint maintenance_reserves_money check (
    current_balance_cents >= 0
    and monthly_contribution_cents >= 0
    and (target_balance_cents is null or target_balance_cents >= 0)
  ),
  constraint maintenance_reserves_assumptions_object check (jsonb_typeof(assumptions) = 'object'),
  constraint maintenance_reserves_unique unique (property_id, as_of_date)
);

create table public.optimization_insights (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  unit_id uuid references public.units(id) on delete cascade,
  insight_type text not null,
  title text not null,
  explanation text not null,
  priority public.priority_level not null default 'medium',
  estimated_impact_cents bigint,
  next_review text,
  status text not null default 'open',
  responsible_member_id uuid references public.organization_members(id) on delete set null,
  dismissed_by uuid references auth.users(id) on delete set null,
  dismissed_at timestamptz,
  source_snapshot jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint optimization_insights_status check (status in ('open', 'in_review', 'done', 'dismissed')),
  constraint optimization_insights_dismissal check (
    (status = 'dismissed' and dismissed_by is not null and dismissed_at is not null)
    or status <> 'dismissed'
  ),
  constraint optimization_insights_snapshot_object check (jsonb_typeof(source_snapshot) = 'object')
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  unit_id uuid references public.units(id) on delete cascade,
  lease_id uuid references public.leases(id) on delete cascade,
  subject text not null,
  category text not null default 'general',
  priority public.priority_level not null default 'medium',
  status text not null default 'open',
  is_internal boolean not null default false,
  assigned_member_id uuid references public.organization_members(id) on delete set null,
  last_message_at timestamptz,
  closed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint conversations_subject_length check (char_length(trim(subject)) between 1 and 240),
  constraint conversations_category check (
    category in ('repair', 'damage', 'utilities', 'payment', 'document', 'general', 'termination', 'handover', 'other')
  ),
  constraint conversations_status check (status in ('open', 'waiting_tenant', 'waiting_team', 'resolved', 'closed')),
  constraint conversations_internal_lease check (not is_internal or lease_id is null)
);

create table public.conversation_participants (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  participant_role text not null,
  last_read_at timestamptz,
  notifications_enabled boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint conversation_participants_one_identity check (
    num_nonnulls(user_id, tenant_id) = 1
  ),
  constraint conversation_participants_role check (participant_role in ('team', 'tenant', 'observer'))
);

create unique index conversation_participants_user_unique_idx
  on public.conversation_participants (conversation_id, user_id)
  where user_id is not null;

create unique index conversation_participants_tenant_unique_idx
  on public.conversation_participants (conversation_id, tenant_id)
  where tenant_id is not null;

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  author_tenant_id uuid references public.tenants(id) on delete set null,
  body text not null,
  is_internal_note boolean not null default false,
  sent_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint messages_one_author check (
    num_nonnulls(author_user_id, author_tenant_id) = 1
  ),
  constraint messages_body_length check (char_length(trim(body)) between 1 and 20000)
);

create table public.maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid not null references public.properties(id) on delete restrict,
  unit_id uuid references public.units(id) on delete set null,
  lease_id uuid references public.leases(id) on delete set null,
  tenant_id uuid references public.tenants(id) on delete set null,
  conversation_id uuid references public.conversations(id) on delete set null,
  title text not null,
  description text not null,
  category text not null default 'repair',
  priority public.priority_level not null default 'medium',
  status public.task_status not null default 'open',
  assigned_member_id uuid references public.organization_members(id) on delete set null,
  reported_at timestamptz not null default now(),
  desired_date date,
  resolved_at timestamptz,
  tenant_visible_notes text,
  internal_notes text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint maintenance_requests_title check (char_length(trim(title)) between 1 and 240),
  constraint maintenance_requests_description check (char_length(trim(description)) between 1 and 20000),
  constraint maintenance_requests_category check (
    category in ('repair', 'damage', 'heating', 'water', 'electrical', 'security', 'handover', 'other')
  )
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  unit_id uuid references public.units(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete set null,
  maintenance_request_id uuid references public.maintenance_requests(id) on delete set null,
  title text not null,
  description text,
  category text not null default 'general',
  priority public.priority_level not null default 'medium',
  status public.task_status not null default 'open',
  due_at timestamptz,
  reminder_at timestamptz,
  responsible_member_id uuid references public.organization_members(id) on delete set null,
  recurrence_rule text,
  completed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint tasks_title check (char_length(trim(title)) between 1 and 240),
  constraint tasks_completion check (
    (status = 'done' and completed_at is not null) or status <> 'done'
  )
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  maintenance_request_id uuid references public.maintenance_requests(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  author_tenant_id uuid references public.tenants(id) on delete set null,
  body text not null,
  is_internal boolean not null default false,
  edited_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint comments_one_parent check (
    num_nonnulls(task_id, maintenance_request_id) = 1
  ),
  constraint comments_one_author check (
    num_nonnulls(author_user_id, author_tenant_id) = 1
  ),
  constraint comments_body_length check (char_length(trim(body)) between 1 and 10000)
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  notification_type text not null,
  title text not null,
  body text not null,
  entity_type text,
  entity_id uuid,
  action_url text,
  priority public.priority_level not null default 'medium',
  read_at timestamptz,
  dismissed_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint notifications_title_length check (char_length(trim(title)) between 1 and 240)
);

create table public.integration_connections (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_type text not null,
  provider text not null,
  mode text not null default 'demo',
  status text not null default 'pending',
  external_account_ref text,
  secret_reference text,
  configuration jsonb not null default '{}'::jsonb,
  scopes text[] not null default '{}'::text[],
  connected_by uuid references auth.users(id) on delete set null,
  connected_at timestamptz,
  last_synced_at timestamptz,
  expires_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint integration_connections_mode check (mode in ('demo', 'provider')),
  constraint integration_connections_status check (
    status in ('pending', 'active', 'reauthorization_required', 'error', 'revoked')
  ),
  constraint integration_connections_configuration_object check (jsonb_typeof(configuration) = 'object'),
  constraint integration_connections_no_inline_secrets check (
    configuration::text !~* '"(api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|credential)"\s*:'
  ),
  constraint integration_connections_unique unique (organization_id, integration_type, provider)
);

comment on column public.integration_connections.secret_reference is
  'Opaque server-side secret/vault reference only. Provider credentials must never be stored here.';

create table public.integration_sync_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  integration_connection_id uuid not null references public.integration_connections(id) on delete cascade,
  sync_type text not null,
  status public.sync_status not null default 'pending',
  started_at timestamptz,
  finished_at timestamptz,
  records_received integer not null default 0,
  records_created integer not null default 0,
  records_updated integer not null default 0,
  records_failed integer not null default 0,
  cursor_value text,
  error_code text,
  error_message text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint integration_sync_logs_counts check (
    records_received >= 0
    and records_created >= 0
    and records_updated >= 0
    and records_failed >= 0
  ),
  constraint integration_sync_logs_dates check (
    finished_at is null or started_at is null or finished_at >= started_at
  ),
  constraint integration_sync_logs_metadata_object check (jsonb_typeof(metadata) = 'object')
);

create table public.document_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  document_id uuid not null references public.documents(id) on delete cascade,
  property_id uuid references public.properties(id) on delete cascade,
  unit_id uuid references public.units(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  lease_id uuid references public.leases(id) on delete cascade,
  rent_claim_id uuid references public.rent_claims(id) on delete cascade,
  income_entry_id uuid references public.income_entries(id) on delete cascade,
  expense_entry_id uuid references public.expense_entries(id) on delete cascade,
  loan_id uuid references public.loans(id) on delete cascade,
  renovation_project_id uuid references public.renovation_projects(id) on delete cascade,
  renovation_item_id uuid references public.renovation_items(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete cascade,
  message_id uuid references public.messages(id) on delete cascade,
  maintenance_request_id uuid references public.maintenance_requests(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,
  link_type text not null default 'attachment',
  tenant_visible boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint document_links_one_target check (
    num_nonnulls(
      property_id, unit_id, tenant_id, lease_id, rent_claim_id, income_entry_id,
      expense_entry_id, loan_id, renovation_project_id, renovation_item_id,
      conversation_id, message_id, maintenance_request_id, task_id
    ) = 1
  )
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_role public.app_role,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  old_data jsonb,
  new_data jsonb,
  request_id text,
  ip_address inet,
  user_agent text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint audit_logs_old_object check (old_data is null or jsonb_typeof(old_data) = 'object'),
  constraint audit_logs_new_object check (new_data is null or jsonb_typeof(new_data) = 'object')
);

comment on table public.audit_logs is
  'Append-only security audit trail. UPDATE and DELETE are rejected by trigger.';

-- Indexes for tenant boundaries, common filters and foreign-key joins.
create index organization_members_user_idx on public.organization_members (user_id, status);
create index invitations_org_status_idx on public.invitations (organization_id, status, expires_at);
create index properties_org_status_idx on public.properties (organization_id, status);
create index properties_org_city_idx on public.properties (organization_id, city);
create index property_assignments_member_idx on public.property_assignments (member_id, property_id);
create index units_org_property_idx on public.units (organization_id, property_id, status);
create index tenants_org_name_idx on public.tenants (organization_id, last_name, first_name);
create index tenant_users_user_idx on public.tenant_users (user_id, organization_id);
create index leases_org_unit_idx on public.leases (organization_id, unit_id, status);
create index lease_tenants_tenant_idx on public.lease_tenants (tenant_id, lease_id);
create index rent_schedules_lease_period_idx on public.rent_schedules (lease_id, valid_from, valid_until);
create index rent_claims_org_due_idx on public.rent_claims (organization_id, due_date, status);
create index rent_payments_claim_idx on public.rent_payments (rent_claim_id, paid_on);
create index bank_accounts_org_idx on public.bank_accounts (organization_id, status);
create index bank_transactions_org_date_idx on public.bank_transactions (organization_id, booked_on desc);
create index bank_transactions_unmatched_idx on public.bank_transactions (organization_id, match_status)
  where not is_ignored;
create index transaction_matches_transaction_idx on public.transaction_matches (bank_transaction_id, status);
create index income_entries_org_date_idx on public.income_entries (organization_id, entry_date desc);
create index income_entries_property_date_idx on public.income_entries (property_id, entry_date desc);
create index expense_entries_org_date_idx on public.expense_entries (organization_id, entry_date desc);
create index expense_entries_property_date_idx on public.expense_entries (property_id, entry_date desc);
create index expense_entries_missing_document_idx on public.expense_entries (organization_id, document_status)
  where document_status <> 'complete' and archived_at is null;
create index documents_org_date_idx on public.documents (organization_id, document_date desc);
create index documents_property_idx on public.documents (property_id, unit_id);
create index document_extractions_document_idx on public.document_extractions (document_id, created_at desc);
create index tax_assumptions_year_property_idx on public.tax_assumptions (tax_year_id, property_id);
create index tax_snapshots_year_property_idx on public.tax_calculation_snapshots (tax_year_id, property_id, period_start);
create index loans_org_property_idx on public.loans (organization_id, property_id, status);
create index loan_payments_loan_due_idx on public.loan_payments (loan_id, due_date);
create index valuations_property_date_idx on public.valuations (property_id, valued_on desc);
create index market_rent_unit_date_idx on public.market_rent_comparisons (unit_id, data_date desc);
create index renovation_projects_property_idx on public.renovation_projects (property_id, status, planned_start_date);
create index renovation_items_project_idx on public.renovation_items (renovation_project_id, status);
create index optimization_insights_org_status_idx on public.optimization_insights (organization_id, status, priority);
create index conversations_org_updated_idx on public.conversations (organization_id, updated_at desc);
create index conversation_participants_user_idx on public.conversation_participants (user_id, conversation_id);
create index conversation_participants_tenant_idx on public.conversation_participants (tenant_id, conversation_id);
create index messages_conversation_sent_idx on public.messages (conversation_id, sent_at);
create index maintenance_requests_property_status_idx on public.maintenance_requests (property_id, status, priority);
create index tasks_org_due_idx on public.tasks (organization_id, status, due_at);
create index tasks_responsible_idx on public.tasks (responsible_member_id, status, due_at);
create index notifications_user_unread_idx on public.notifications (user_id, created_at desc)
  where read_at is null and dismissed_at is null;
create index integration_sync_logs_connection_idx on public.integration_sync_logs (integration_connection_id, created_at desc);
create index document_links_document_idx on public.document_links (document_id);
create index audit_logs_org_time_idx on public.audit_logs (organization_id, occurred_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, occurred_at desc);

-- Private authorization helpers. They intentionally bypass table RLS only to answer
-- narrow authorization questions and are not exposed through the Data API.
create or replace function private.current_member_role(p_organization_id uuid)
returns public.app_role
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select om.role
  from public.organization_members as om
  where om.organization_id = p_organization_id
    and om.user_id = (select auth.uid())
    and om.status = 'active'
  limit 1
$$;

create or replace function private.is_org_member(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.organization_members as om
      where om.organization_id = p_organization_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
    )
$$;

create or replace function private.has_org_role(
  p_organization_id uuid,
  p_roles public.app_role[]
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select coalesce(private.current_member_role(p_organization_id) = any(p_roles), false)
$$;

create or replace function private.can_manage_organization(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select private.has_org_role(
    p_organization_id,
    array['owner', 'admin']::public.app_role[]
  )
$$;

create or replace function private.can_manage_members(
  p_organization_id uuid,
  p_target_role public.app_role
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select case private.current_member_role(p_organization_id)
    when 'owner' then true
    when 'admin' then p_target_role <> 'owner'
    else false
  end
$$;

create or replace function private.is_tenant_for_tenant(
  p_organization_id uuid,
  p_tenant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.tenant_users as tu
      join public.organization_members as om
        on om.organization_id = tu.organization_id
       and om.user_id = tu.user_id
       and om.role = 'tenant'
       and om.status = 'active'
      where tu.organization_id = p_organization_id
        and tu.tenant_id = p_tenant_id
        and tu.user_id = (select auth.uid())
    )
$$;

create or replace function private.is_tenant_for_lease(
  p_organization_id uuid,
  p_lease_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select (select auth.uid()) is not null
    and exists (
      select 1
      from public.lease_tenants as lt
      join public.tenant_users as tu
        on tu.organization_id = lt.organization_id
       and tu.tenant_id = lt.tenant_id
      join public.organization_members as om
        on om.organization_id = tu.organization_id
       and om.user_id = tu.user_id
       and om.role = 'tenant'
       and om.status = 'active'
      where lt.organization_id = p_organization_id
        and lt.lease_id = p_lease_id
        and tu.user_id = (select auth.uid())
    )
$$;

create or replace function private.can_view_property(
  p_organization_id uuid,
  p_property_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select case private.current_member_role(p_organization_id)
    when 'owner' then true
    when 'admin' then true
    when 'property_manager' then true
    when 'accounting' then true
    when 'employee' then exists (
      select 1
      from public.property_assignments as pa
      join public.organization_members as om on om.id = pa.member_id
      where pa.organization_id = p_organization_id
        and pa.property_id = p_property_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
        and (pa.valid_from is null or pa.valid_from <= current_date)
        and (pa.valid_until is null or pa.valid_until >= current_date)
    )
    else false
  end
$$;

create or replace function private.can_operate_property(
  p_organization_id uuid,
  p_property_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select case private.current_member_role(p_organization_id)
    when 'owner' then true
    when 'admin' then true
    when 'property_manager' then true
    when 'employee' then exists (
      select 1
      from public.property_assignments as pa
      join public.organization_members as om on om.id = pa.member_id
      where pa.organization_id = p_organization_id
        and pa.property_id = p_property_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
        and (pa.valid_from is null or pa.valid_from <= current_date)
        and (pa.valid_until is null or pa.valid_until >= current_date)
    )
    else false
  end
$$;

create or replace function private.can_view_unit(
  p_organization_id uuid,
  p_unit_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.units as u
    where u.id = p_unit_id
      and u.organization_id = p_organization_id
      and (
        private.can_view_property(p_organization_id, u.property_id)
        or exists (
          select 1
          from public.leases as l
          where l.organization_id = p_organization_id
            and l.unit_id = u.id
            and private.is_tenant_for_lease(p_organization_id, l.id)
        )
      )
  )
$$;

create or replace function private.can_view_lease(
  p_organization_id uuid,
  p_lease_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.leases as l
    join public.units as u on u.id = l.unit_id
    where l.id = p_lease_id
      and l.organization_id = p_organization_id
      and (
        private.can_view_property(p_organization_id, u.property_id)
        or private.is_tenant_for_lease(p_organization_id, l.id)
      )
  )
$$;

create or replace function private.can_manage_leases(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select private.has_org_role(
    p_organization_id,
    array['owner', 'admin', 'property_manager']::public.app_role[]
  )
$$;

create or replace function private.can_read_bookkeeping(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select private.has_org_role(
    p_organization_id,
    array['owner', 'admin', 'property_manager', 'accounting']::public.app_role[]
  )
$$;

create or replace function private.can_write_bookkeeping(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select private.has_org_role(
    p_organization_id,
    array['owner', 'admin', 'property_manager', 'accounting']::public.app_role[]
  )
$$;

create or replace function private.can_delete_bookkeeping(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select private.has_org_role(
    p_organization_id,
    array['owner', 'admin', 'property_manager']::public.app_role[]
  )
$$;

create or replace function private.can_access_bank_data(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select private.has_org_role(
    p_organization_id,
    array['owner', 'admin', 'accounting']::public.app_role[]
  )
$$;

create or replace function private.can_access_tax_data(p_organization_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select private.has_org_role(
    p_organization_id,
    array['owner', 'admin', 'accounting']::public.app_role[]
  )
$$;

create or replace function private.can_view_tenant(
  p_organization_id uuid,
  p_tenant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select private.is_tenant_for_tenant(p_organization_id, p_tenant_id)
    or exists (
      select 1
      from public.lease_tenants as lt
      join public.leases as l on l.id = lt.lease_id
      join public.units as u on u.id = l.unit_id
      where lt.organization_id = p_organization_id
        and lt.tenant_id = p_tenant_id
        and private.can_view_property(p_organization_id, u.property_id)
    )
$$;

create or replace function private.can_view_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select p_profile_id = (select auth.uid())
    or exists (
      select 1
      from public.organization_members as viewer
      join public.organization_members as target
        on target.organization_id = viewer.organization_id
       and target.user_id = p_profile_id
       and target.status = 'active'
      where viewer.user_id = (select auth.uid())
        and viewer.status = 'active'
        and viewer.role <> 'tenant'
    )
$$;

create or replace function private.can_access_conversation(
  p_organization_id uuid,
  p_conversation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.conversations as c
    where c.organization_id = p_organization_id
      and c.id = p_conversation_id
      and (
        private.has_org_role(
          p_organization_id,
          array['owner', 'admin', 'property_manager']::public.app_role[]
        )
        or (
          private.current_member_role(p_organization_id) = 'employee'
          and (
            exists (
              select 1
              from public.conversation_participants as cp
              where cp.conversation_id = c.id
                and cp.user_id = (select auth.uid())
            )
            or (c.property_id is not null and private.can_operate_property(p_organization_id, c.property_id))
          )
        )
        or (
          private.current_member_role(p_organization_id) = 'accounting'
          and exists (
            select 1
            from public.conversation_participants as cp
            where cp.conversation_id = c.id
              and cp.user_id = (select auth.uid())
          )
        )
        or (
          private.current_member_role(p_organization_id) = 'tenant'
          and not c.is_internal
          and (
            exists (
              select 1
              from public.conversation_participants as cp
              join public.tenant_users as tu
                on tu.organization_id = cp.organization_id
               and tu.tenant_id = cp.tenant_id
              where cp.conversation_id = c.id
                and tu.user_id = (select auth.uid())
            )
            or (c.lease_id is not null and private.is_tenant_for_lease(p_organization_id, c.lease_id))
          )
        )
      )
  )
$$;

create or replace function private.can_access_maintenance_request(
  p_organization_id uuid,
  p_request_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.maintenance_requests as mr
    where mr.id = p_request_id
      and mr.organization_id = p_organization_id
      and (
        private.can_view_property(p_organization_id, mr.property_id)
        or (mr.tenant_id is not null and private.is_tenant_for_tenant(p_organization_id, mr.tenant_id))
        or (mr.lease_id is not null and private.is_tenant_for_lease(p_organization_id, mr.lease_id))
      )
  )
$$;

create or replace function private.can_access_task(
  p_organization_id uuid,
  p_task_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.tasks as t
    left join public.organization_members as assigned on assigned.id = t.responsible_member_id
    where t.id = p_task_id
      and t.organization_id = p_organization_id
      and (
        private.has_org_role(
          p_organization_id,
          array['owner', 'admin', 'property_manager']::public.app_role[]
        )
        or assigned.user_id = (select auth.uid())
        or (t.property_id is not null and private.can_operate_property(p_organization_id, t.property_id))
      )
  )
$$;

create or replace function private.can_read_document(
  p_organization_id uuid,
  p_document_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.documents as d
    where d.id = p_document_id
      and d.organization_id = p_organization_id
      and (
        private.has_org_role(
          p_organization_id,
          array['owner', 'admin', 'property_manager', 'accounting']::public.app_role[]
        )
        or (
          private.current_member_role(p_organization_id) = 'employee'
          and d.property_id is not null
          and private.can_operate_property(p_organization_id, d.property_id)
        )
        or (
          private.current_member_role(p_organization_id) = 'tenant'
          and d.tenant_visible
          and d.lease_id is not null
          and private.is_tenant_for_lease(p_organization_id, d.lease_id)
        )
      )
  )
$$;

create or replace function private.safe_path_uuid(p_path text, p_position integer)
returns uuid
language plpgsql
immutable
security invoker
set search_path = pg_catalog
as $$
declare
  v_part text;
begin
  v_part := split_part(p_path, '/', p_position);
  if v_part ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' then
    return v_part::uuid;
  end if;
  return null;
end
$$;

create or replace function private.can_read_document_object(p_path text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select private.can_read_document(
    private.safe_path_uuid(p_path, 1),
    private.safe_path_uuid(p_path, 2)
  )
$$;

create or replace function private.can_access_property_object(p_path text, p_write boolean default false)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select case
    when p_write then private.can_operate_property(
      private.safe_path_uuid(p_path, 1),
      private.safe_path_uuid(p_path, 2)
    )
    else private.can_view_property(
      private.safe_path_uuid(p_path, 1),
      private.safe_path_uuid(p_path, 2)
    )
  end
$$;

create or replace function private.can_access_message_object(p_path text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select private.can_access_conversation(
    private.safe_path_uuid(p_path, 1),
    private.safe_path_uuid(p_path, 2)
  )
$$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

create or replace function private.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  insert into public.profiles (id, email, full_name, display_name)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''),
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '')
  )
  on conflict (id) do nothing;
  return new;
end
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_auth_user();

create or replace function private.prevent_audit_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  raise exception 'audit_logs is append-only' using errcode = '55000';
end
$$;

create trigger audit_logs_append_only
  before update or delete on public.audit_logs
  for each row execute function private.prevent_audit_mutation();

create or replace function private.prevent_snapshot_mutation()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  raise exception 'tax calculation snapshots are immutable' using errcode = '55000';
end
$$;

create trigger tax_calculation_snapshots_immutable
  before update or delete on public.tax_calculation_snapshots
  for each row execute function private.prevent_snapshot_mutation();

create or replace function private.protect_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_org_id uuid := coalesce(new.organization_id, old.organization_id);
  v_owner_user_id uuid;
begin
  select o.owner_user_id
    into v_owner_user_id
    from public.organizations as o
   where o.id = v_org_id;

  -- During an organization cascade delete the parent is already gone.
  if v_owner_user_id is null then
    if tg_op = 'DELETE' then
      return old;
    end if;
    return new;
  end if;

  if tg_op in ('UPDATE', 'DELETE')
     and old.role = 'owner'
     and old.status = 'active'
     and (
       tg_op = 'DELETE'
       or new.role <> 'owner'
       or new.status <> 'active'
       or new.user_id <> old.user_id
     ) then
    raise exception 'The active organization owner membership cannot be removed or demoted'
      using errcode = '42501';
  end if;

  if tg_op in ('INSERT', 'UPDATE')
     and new.role = 'owner'
     and new.status = 'active'
     and new.user_id <> v_owner_user_id then
    raise exception 'Owner membership must match organizations.owner_user_id'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

create trigger organization_members_protect_owner
  before insert or update or delete on public.organization_members
  for each row execute function private.protect_owner_membership();

create or replace function private.protect_organization_owner()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if new.owner_user_id is distinct from old.owner_user_id then
    raise exception 'Organization ownership transfer requires a dedicated privileged flow'
      using errcode = '42501';
  end if;
  return new;
end
$$;

create trigger organizations_protect_owner
  before update on public.organizations
  for each row execute function private.protect_organization_owner();

create or replace function private.enforce_related_organization()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_related_id uuid;
  v_related_org_id uuid;
begin
  v_related_id := nullif(to_jsonb(new) ->> tg_argv[0], '')::uuid;
  if v_related_id is null then
    return new;
  end if;

  execute format(
    'select organization_id from %I.%I where id = $1',
    tg_argv[1],
    tg_argv[2]
  )
  into v_related_org_id
  using v_related_id;

  if v_related_org_id is null then
    raise foreign_key_violation using
      message = format('Related %s.%s row does not exist', tg_argv[1], tg_argv[2]);
  end if;

  if v_related_org_id <> new.organization_id then
    raise check_violation using
      message = format('%s must belong to the same organization', tg_argv[0]);
  end if;

  return new;
end
$$;

do $$
declare
  r record;
  v_trigger_name text;
begin
  for r in
    select *
    from (
      values
        ('invitations', 'tenant_id', 'public', 'tenants'),
        ('property_assignments', 'property_id', 'public', 'properties'),
        ('property_assignments', 'member_id', 'public', 'organization_members'),
        ('units', 'property_id', 'public', 'properties'),
        ('tenant_users', 'tenant_id', 'public', 'tenants'),
        ('leases', 'unit_id', 'public', 'units'),
        ('lease_tenants', 'lease_id', 'public', 'leases'),
        ('lease_tenants', 'tenant_id', 'public', 'tenants'),
        ('rent_schedules', 'lease_id', 'public', 'leases'),
        ('rent_claims', 'lease_id', 'public', 'leases'),
        ('rent_claims', 'rent_schedule_id', 'public', 'rent_schedules'),
        ('bank_accounts', 'connection_id', 'public', 'bank_connections'),
        ('bank_accounts', 'property_id', 'public', 'properties'),
        ('bank_transactions', 'bank_account_id', 'public', 'bank_accounts'),
        ('expense_categories', 'parent_id', 'public', 'expense_categories'),
        ('income_entries', 'property_id', 'public', 'properties'),
        ('income_entries', 'unit_id', 'public', 'units'),
        ('income_entries', 'lease_id', 'public', 'leases'),
        ('income_entries', 'bank_transaction_id', 'public', 'bank_transactions'),
        ('expense_entries', 'property_id', 'public', 'properties'),
        ('expense_entries', 'unit_id', 'public', 'units'),
        ('expense_entries', 'category_id', 'public', 'expense_categories'),
        ('expense_entries', 'bank_transaction_id', 'public', 'bank_transactions'),
        ('rent_payments', 'rent_claim_id', 'public', 'rent_claims'),
        ('rent_payments', 'bank_transaction_id', 'public', 'bank_transactions'),
        ('transaction_matches', 'bank_transaction_id', 'public', 'bank_transactions'),
        ('transaction_matches', 'rent_claim_id', 'public', 'rent_claims'),
        ('transaction_matches', 'income_entry_id', 'public', 'income_entries'),
        ('transaction_matches', 'expense_entry_id', 'public', 'expense_entries'),
        ('documents', 'property_id', 'public', 'properties'),
        ('documents', 'unit_id', 'public', 'units'),
        ('documents', 'lease_id', 'public', 'leases'),
        ('document_extractions', 'document_id', 'public', 'documents'),
        ('document_extractions', 'duplicate_of_document_id', 'public', 'documents'),
        ('tax_assumptions', 'tax_year_id', 'public', 'tax_years'),
        ('tax_assumptions', 'property_id', 'public', 'properties'),
        ('depreciation_assets', 'property_id', 'public', 'properties'),
        ('depreciation_assets', 'tax_year_id', 'public', 'tax_years'),
        ('tax_calculation_snapshots', 'tax_year_id', 'public', 'tax_years'),
        ('tax_calculation_snapshots', 'property_id', 'public', 'properties'),
        ('loans', 'property_id', 'public', 'properties'),
        ('loan_payments', 'loan_id', 'public', 'loans'),
        ('loan_payments', 'bank_transaction_id', 'public', 'bank_transactions'),
        ('valuations', 'property_id', 'public', 'properties'),
        ('market_rent_comparisons', 'property_id', 'public', 'properties'),
        ('market_rent_comparisons', 'unit_id', 'public', 'units'),
        ('renovation_projects', 'property_id', 'public', 'properties'),
        ('renovation_projects', 'unit_id', 'public', 'units'),
        ('renovation_projects', 'responsible_member_id', 'public', 'organization_members'),
        ('renovation_items', 'renovation_project_id', 'public', 'renovation_projects'),
        ('maintenance_reserves', 'property_id', 'public', 'properties'),
        ('optimization_insights', 'property_id', 'public', 'properties'),
        ('optimization_insights', 'unit_id', 'public', 'units'),
        ('optimization_insights', 'responsible_member_id', 'public', 'organization_members'),
        ('conversations', 'property_id', 'public', 'properties'),
        ('conversations', 'unit_id', 'public', 'units'),
        ('conversations', 'lease_id', 'public', 'leases'),
        ('conversations', 'assigned_member_id', 'public', 'organization_members'),
        ('conversation_participants', 'conversation_id', 'public', 'conversations'),
        ('conversation_participants', 'tenant_id', 'public', 'tenants'),
        ('messages', 'conversation_id', 'public', 'conversations'),
        ('messages', 'author_tenant_id', 'public', 'tenants'),
        ('maintenance_requests', 'property_id', 'public', 'properties'),
        ('maintenance_requests', 'unit_id', 'public', 'units'),
        ('maintenance_requests', 'lease_id', 'public', 'leases'),
        ('maintenance_requests', 'tenant_id', 'public', 'tenants'),
        ('maintenance_requests', 'conversation_id', 'public', 'conversations'),
        ('maintenance_requests', 'assigned_member_id', 'public', 'organization_members'),
        ('tasks', 'property_id', 'public', 'properties'),
        ('tasks', 'unit_id', 'public', 'units'),
        ('tasks', 'tenant_id', 'public', 'tenants'),
        ('tasks', 'maintenance_request_id', 'public', 'maintenance_requests'),
        ('tasks', 'responsible_member_id', 'public', 'organization_members'),
        ('comments', 'task_id', 'public', 'tasks'),
        ('comments', 'maintenance_request_id', 'public', 'maintenance_requests'),
        ('comments', 'author_tenant_id', 'public', 'tenants'),
        ('integration_sync_logs', 'integration_connection_id', 'public', 'integration_connections'),
        ('document_links', 'document_id', 'public', 'documents'),
        ('document_links', 'property_id', 'public', 'properties'),
        ('document_links', 'unit_id', 'public', 'units'),
        ('document_links', 'tenant_id', 'public', 'tenants'),
        ('document_links', 'lease_id', 'public', 'leases'),
        ('document_links', 'rent_claim_id', 'public', 'rent_claims'),
        ('document_links', 'income_entry_id', 'public', 'income_entries'),
        ('document_links', 'expense_entry_id', 'public', 'expense_entries'),
        ('document_links', 'loan_id', 'public', 'loans'),
        ('document_links', 'renovation_project_id', 'public', 'renovation_projects'),
        ('document_links', 'renovation_item_id', 'public', 'renovation_items'),
        ('document_links', 'conversation_id', 'public', 'conversations'),
        ('document_links', 'message_id', 'public', 'messages'),
        ('document_links', 'maintenance_request_id', 'public', 'maintenance_requests'),
        ('document_links', 'task_id', 'public', 'tasks')
    ) as relations(table_name, column_name, related_schema, related_table)
  loop
    v_trigger_name := format(
      'same_org_%s_%s_%s',
      left(r.table_name, 16),
      left(r.column_name, 16),
      left(md5(r.table_name || ':' || r.column_name), 8)
    );
    execute format(
      'create trigger %I before insert or update of %I, organization_id on public.%I
       for each row execute function private.enforce_related_organization(%L, %L, %L)',
      v_trigger_name,
      r.column_name,
      r.table_name,
      r.column_name,
      r.related_schema,
      r.related_table
    );
  end loop;
end
$$;

create or replace function private.tenant_request_scope_is_valid(
  p_organization_id uuid,
  p_property_id uuid,
  p_unit_id uuid,
  p_lease_id uuid,
  p_tenant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.leases as l
    join public.units as u on u.id = l.unit_id
    join public.lease_tenants as lt on lt.lease_id = l.id
    join public.tenant_users as tu
      on tu.organization_id = lt.organization_id
     and tu.tenant_id = lt.tenant_id
    where l.organization_id = p_organization_id
      and l.id = p_lease_id
      and u.property_id = p_property_id
      and (p_unit_id is null or p_unit_id = u.id)
      and lt.tenant_id = p_tenant_id
      and tu.user_id = (select auth.uid())
  )
$$;

-- Row Level Security: every public table is explicitly enabled.
do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'profiles', 'organizations', 'organization_members', 'invitations',
    'properties', 'property_assignments', 'units', 'tenants', 'tenant_users',
    'leases', 'lease_tenants', 'rent_schedules', 'rent_claims', 'rent_payments',
    'bank_accounts', 'bank_connections', 'bank_transactions', 'transaction_matches',
    'income_entries', 'expense_entries', 'expense_categories', 'documents',
    'document_links', 'document_extractions', 'tax_profiles', 'tax_years',
    'tax_assumptions', 'depreciation_assets', 'tax_calculation_snapshots',
    'loans', 'loan_payments', 'valuations', 'market_rent_comparisons',
    'renovation_projects', 'renovation_items', 'maintenance_reserves',
    'optimization_insights', 'conversations', 'conversation_participants',
    'messages', 'maintenance_requests', 'tasks', 'comments', 'notifications',
    'integration_connections', 'integration_sync_logs', 'audit_logs'
  ]
  loop
    execute format('alter table public.%I enable row level security', v_table);
  end loop;
end
$$;

create policy profiles_select
  on public.profiles for select to authenticated
  using ((select auth.uid()) is not null and private.can_view_profile(id));

create policy profiles_update_self
  on public.profiles for update to authenticated
  using ((select auth.uid()) is not null and id = (select auth.uid()))
  with check ((select auth.uid()) is not null and id = (select auth.uid()));

create policy organizations_select_member
  on public.organizations for select to authenticated
  using (private.is_org_member(id));

create policy organizations_update_management
  on public.organizations for update to authenticated
  using (private.can_manage_organization(id))
  with check (private.can_manage_organization(id));

create policy organizations_delete_owner
  on public.organizations for delete to authenticated
  using (private.has_org_role(id, array['owner']::public.app_role[]));

create policy organization_members_select
  on public.organization_members for select to authenticated
  using (
    private.is_org_member(organization_id)
    and (
      private.current_member_role(organization_id) <> 'tenant'
      or user_id = (select auth.uid())
    )
  );

create policy organization_members_insert_management
  on public.organization_members for insert to authenticated
  with check (
    private.can_manage_members(organization_id, role)
    and created_by = (select auth.uid())
  );

create policy organization_members_update_management
  on public.organization_members for update to authenticated
  using (private.can_manage_members(organization_id, role))
  with check (
    private.can_manage_members(organization_id, role)
    and organization_id = organization_id
  );

create policy organization_members_delete_management
  on public.organization_members for delete to authenticated
  using (private.can_manage_members(organization_id, role));

create policy invitations_select_management
  on public.invitations for select to authenticated
  using (private.can_manage_organization(organization_id));

create policy invitations_insert_management
  on public.invitations for insert to authenticated
  with check (
    private.can_manage_members(organization_id, role)
    and invited_by = (select auth.uid())
    and created_by = (select auth.uid())
  );

create policy invitations_update_management
  on public.invitations for update to authenticated
  using (private.can_manage_members(organization_id, role))
  with check (private.can_manage_members(organization_id, role));

create policy invitations_delete_owner
  on public.invitations for delete to authenticated
  using (private.has_org_role(organization_id, array['owner']::public.app_role[]));

create policy properties_select_scoped
  on public.properties for select to authenticated
  using (private.can_view_property(organization_id, id));

create policy properties_insert_management
  on public.properties for insert to authenticated
  with check (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
  );

create policy properties_update_management
  on public.properties for update to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
  )
  with check (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
  );

create policy properties_delete_management
  on public.properties for delete to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin']::public.app_role[]
    )
  );

create policy property_assignments_select_scoped
  on public.property_assignments for select to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
    or exists (
      select 1
      from public.organization_members as om
      where om.id = member_id
        and om.user_id = (select auth.uid())
        and om.status = 'active'
    )
  );

create policy property_assignments_insert_management
  on public.property_assignments for insert to authenticated
  with check (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
  );

create policy property_assignments_update_management
  on public.property_assignments for update to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
  )
  with check (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
  );

create policy property_assignments_delete_management
  on public.property_assignments for delete to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
  );

create policy units_select_scoped
  on public.units for select to authenticated
  using (private.can_view_unit(organization_id, id));

create policy units_insert_management
  on public.units for insert to authenticated
  with check (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
    and private.can_view_property(organization_id, property_id)
  );

create policy units_update_management
  on public.units for update to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
  )
  with check (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
    and private.can_view_property(organization_id, property_id)
  );

create policy units_delete_management
  on public.units for delete to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin']::public.app_role[]
    )
  );

create policy tenants_select_scoped
  on public.tenants for select to authenticated
  using (private.can_view_tenant(organization_id, id));

create policy tenants_insert_management
  on public.tenants for insert to authenticated
  with check (private.can_manage_leases(organization_id));

create policy tenants_update_scoped
  on public.tenants for update to authenticated
  using (
    private.can_manage_leases(organization_id)
    or private.is_tenant_for_tenant(organization_id, id)
  )
  with check (
    private.can_manage_leases(organization_id)
    or private.is_tenant_for_tenant(organization_id, id)
  );

create policy tenants_delete_management
  on public.tenants for delete to authenticated
  using (private.can_manage_leases(organization_id));

create policy tenant_users_select_scoped
  on public.tenant_users for select to authenticated
  using (
    private.can_manage_leases(organization_id)
    or user_id = (select auth.uid())
  );

create policy tenant_users_insert_management
  on public.tenant_users for insert to authenticated
  with check (private.can_manage_leases(organization_id));

create policy tenant_users_update_management
  on public.tenant_users for update to authenticated
  using (private.can_manage_leases(organization_id))
  with check (private.can_manage_leases(organization_id));

create policy tenant_users_delete_management
  on public.tenant_users for delete to authenticated
  using (private.can_manage_leases(organization_id));

create policy leases_select_scoped
  on public.leases for select to authenticated
  using (private.can_view_lease(organization_id, id));

create policy leases_insert_management
  on public.leases for insert to authenticated
  with check (
    private.can_manage_leases(organization_id)
    and private.can_view_unit(organization_id, unit_id)
  );

create policy leases_update_management
  on public.leases for update to authenticated
  using (private.can_manage_leases(organization_id))
  with check (
    private.can_manage_leases(organization_id)
    and private.can_view_unit(organization_id, unit_id)
  );

create policy leases_delete_management
  on public.leases for delete to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin']::public.app_role[]
    )
  );

create policy lease_tenants_select_scoped
  on public.lease_tenants for select to authenticated
  using (
    private.can_view_lease(organization_id, lease_id)
    or private.is_tenant_for_tenant(organization_id, tenant_id)
  );

create policy lease_tenants_insert_management
  on public.lease_tenants for insert to authenticated
  with check (
    private.can_manage_leases(organization_id)
    and private.can_view_lease(organization_id, lease_id)
  );

create policy lease_tenants_update_management
  on public.lease_tenants for update to authenticated
  using (private.can_manage_leases(organization_id))
  with check (
    private.can_manage_leases(organization_id)
    and private.can_view_lease(organization_id, lease_id)
  );

create policy lease_tenants_delete_management
  on public.lease_tenants for delete to authenticated
  using (private.can_manage_leases(organization_id));

create policy rent_schedules_select_scoped
  on public.rent_schedules for select to authenticated
  using (private.can_view_lease(organization_id, lease_id));

create policy rent_schedules_insert_management
  on public.rent_schedules for insert to authenticated
  with check (
    private.can_manage_leases(organization_id)
    and private.can_view_lease(organization_id, lease_id)
  );

create policy rent_schedules_update_management
  on public.rent_schedules for update to authenticated
  using (private.can_manage_leases(organization_id))
  with check (
    private.can_manage_leases(organization_id)
    and private.can_view_lease(organization_id, lease_id)
  );

create policy rent_schedules_delete_management
  on public.rent_schedules for delete to authenticated
  using (private.can_manage_leases(organization_id));

create policy rent_claims_select_scoped
  on public.rent_claims for select to authenticated
  using (private.can_view_lease(organization_id, lease_id));

create policy rent_claims_insert_bookkeeping
  on public.rent_claims for insert to authenticated
  with check (
    private.can_write_bookkeeping(organization_id)
    and private.can_view_lease(organization_id, lease_id)
  );

create policy rent_claims_update_bookkeeping
  on public.rent_claims for update to authenticated
  using (private.can_write_bookkeeping(organization_id))
  with check (
    private.can_write_bookkeeping(organization_id)
    and private.can_view_lease(organization_id, lease_id)
  );

create policy rent_claims_delete_bookkeeping
  on public.rent_claims for delete to authenticated
  using (private.can_delete_bookkeeping(organization_id));

create policy rent_payments_select_scoped
  on public.rent_payments for select to authenticated
  using (
    exists (
      select 1
      from public.rent_claims as rc
      where rc.id = rent_claim_id
        and private.can_view_lease(organization_id, rc.lease_id)
    )
  );

create policy rent_payments_insert_bookkeeping
  on public.rent_payments for insert to authenticated
  with check (private.can_write_bookkeeping(organization_id));

create policy rent_payments_update_bookkeeping
  on public.rent_payments for update to authenticated
  using (private.can_write_bookkeeping(organization_id))
  with check (private.can_write_bookkeeping(organization_id));

create policy rent_payments_delete_bookkeeping
  on public.rent_payments for delete to authenticated
  using (private.can_delete_bookkeeping(organization_id));

create policy bank_connections_select
  on public.bank_connections for select to authenticated
  using (private.can_access_bank_data(organization_id));

create policy bank_connections_insert_owner_admin
  on public.bank_connections for insert to authenticated
  with check (
    private.has_org_role(
      organization_id,
      array['owner', 'admin']::public.app_role[]
    )
  );

create policy bank_connections_update_owner_admin
  on public.bank_connections for update to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin']::public.app_role[]
    )
  )
  with check (
    private.has_org_role(
      organization_id,
      array['owner', 'admin']::public.app_role[]
    )
  );

create policy bank_connections_delete_owner
  on public.bank_connections for delete to authenticated
  using (private.has_org_role(organization_id, array['owner']::public.app_role[]));

create policy bank_accounts_select
  on public.bank_accounts for select to authenticated
  using (private.can_access_bank_data(organization_id));

create policy bank_accounts_insert_owner_admin
  on public.bank_accounts for insert to authenticated
  with check (
    private.has_org_role(
      organization_id,
      array['owner', 'admin']::public.app_role[]
    )
  );

create policy bank_accounts_update_owner_admin
  on public.bank_accounts for update to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin']::public.app_role[]
    )
  )
  with check (
    private.has_org_role(
      organization_id,
      array['owner', 'admin']::public.app_role[]
    )
  );

create policy bank_accounts_delete_owner
  on public.bank_accounts for delete to authenticated
  using (private.has_org_role(organization_id, array['owner']::public.app_role[]));

create policy bank_transactions_select
  on public.bank_transactions for select to authenticated
  using (private.can_access_bank_data(organization_id));

create policy bank_transactions_insert
  on public.bank_transactions for insert to authenticated
  with check (private.can_access_bank_data(organization_id));

create policy bank_transactions_update
  on public.bank_transactions for update to authenticated
  using (private.can_access_bank_data(organization_id))
  with check (private.can_access_bank_data(organization_id));

create policy bank_transactions_delete_owner_admin
  on public.bank_transactions for delete to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin']::public.app_role[]
    )
  );

create policy transaction_matches_select
  on public.transaction_matches for select to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager', 'accounting']::public.app_role[]
    )
  );

create policy transaction_matches_insert
  on public.transaction_matches for insert to authenticated
  with check (
    status = 'suggested'
    and private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager', 'accounting']::public.app_role[]
    )
  );

create policy transaction_matches_update
  on public.transaction_matches for update to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager', 'accounting']::public.app_role[]
    )
  )
  with check (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager', 'accounting']::public.app_role[]
    )
  );

create policy transaction_matches_delete
  on public.transaction_matches for delete to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin']::public.app_role[]
    )
  );

create policy expense_categories_select
  on public.expense_categories for select to authenticated
  using (private.can_read_bookkeeping(organization_id));

create policy expense_categories_insert
  on public.expense_categories for insert to authenticated
  with check (private.can_write_bookkeeping(organization_id));

create policy expense_categories_update
  on public.expense_categories for update to authenticated
  using (private.can_write_bookkeeping(organization_id))
  with check (private.can_write_bookkeeping(organization_id));

create policy expense_categories_delete
  on public.expense_categories for delete to authenticated
  using (
    not is_system
    and private.can_delete_bookkeeping(organization_id)
  );

create policy income_entries_select
  on public.income_entries for select to authenticated
  using (
    private.can_read_bookkeeping(organization_id)
    and private.can_view_property(organization_id, property_id)
  );

create policy income_entries_insert
  on public.income_entries for insert to authenticated
  with check (
    private.can_write_bookkeeping(organization_id)
    and private.can_view_property(organization_id, property_id)
  );

create policy income_entries_update
  on public.income_entries for update to authenticated
  using (
    private.can_write_bookkeeping(organization_id)
    and private.can_view_property(organization_id, property_id)
  )
  with check (
    private.can_write_bookkeeping(organization_id)
    and private.can_view_property(organization_id, property_id)
  );

create policy income_entries_delete
  on public.income_entries for delete to authenticated
  using (
    private.can_delete_bookkeeping(organization_id)
    and private.can_view_property(organization_id, property_id)
  );

create policy expense_entries_select
  on public.expense_entries for select to authenticated
  using (
    private.can_read_bookkeeping(organization_id)
    and private.can_view_property(organization_id, property_id)
  );

create policy expense_entries_insert
  on public.expense_entries for insert to authenticated
  with check (
    private.can_write_bookkeeping(organization_id)
    and private.can_view_property(organization_id, property_id)
  );

create policy expense_entries_update
  on public.expense_entries for update to authenticated
  using (
    private.can_write_bookkeeping(organization_id)
    and private.can_view_property(organization_id, property_id)
  )
  with check (
    private.can_write_bookkeeping(organization_id)
    and private.can_view_property(organization_id, property_id)
  );

create policy expense_entries_delete
  on public.expense_entries for delete to authenticated
  using (
    private.can_delete_bookkeeping(organization_id)
    and private.can_view_property(organization_id, property_id)
  );

create policy documents_select_scoped
  on public.documents for select to authenticated
  using (private.can_read_document(organization_id, id));

create policy documents_insert_scoped
  on public.documents for insert to authenticated
  with check (
    (
      private.has_org_role(
        organization_id,
        array['owner', 'admin', 'property_manager', 'accounting']::public.app_role[]
      )
      or (
        private.current_member_role(organization_id) = 'employee'
        and property_id is not null
        and private.can_operate_property(organization_id, property_id)
      )
      or (
        private.current_member_role(organization_id) = 'tenant'
        and tenant_visible
        and lease_id is not null
        and private.is_tenant_for_lease(organization_id, lease_id)
      )
    )
    and created_by = (select auth.uid())
  );

create policy documents_update_scoped
  on public.documents for update to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager', 'accounting']::public.app_role[]
    )
    or (
      created_by = (select auth.uid())
      and private.can_read_document(organization_id, id)
    )
  )
  with check (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager', 'accounting']::public.app_role[]
    )
    or (
      created_by = (select auth.uid())
      and (
        (
          private.current_member_role(organization_id) = 'employee'
          and property_id is not null
          and private.can_operate_property(organization_id, property_id)
        )
        or (
          private.current_member_role(organization_id) = 'tenant'
          and tenant_visible
          and lease_id is not null
          and private.is_tenant_for_lease(organization_id, lease_id)
        )
      )
    )
  );

create policy documents_delete_scoped
  on public.documents for delete to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
    or (
      created_by = (select auth.uid())
      and private.current_member_role(organization_id) in ('employee', 'tenant')
    )
  );

create policy document_links_select_scoped
  on public.document_links for select to authenticated
  using (private.can_read_document(organization_id, document_id));

create policy document_links_insert_scoped
  on public.document_links for insert to authenticated
  with check (
    private.can_read_document(organization_id, document_id)
    and (
      private.has_org_role(
        organization_id,
        array['owner', 'admin', 'property_manager', 'accounting']::public.app_role[]
      )
      or (
        private.current_member_role(organization_id) = 'employee'
        and (
          (property_id is not null and private.can_operate_property(organization_id, property_id))
          or (task_id is not null and private.can_access_task(organization_id, task_id))
          or (
            maintenance_request_id is not null
            and private.can_access_maintenance_request(organization_id, maintenance_request_id)
          )
          or (
            conversation_id is not null
            and private.can_access_conversation(organization_id, conversation_id)
          )
        )
      )
      or (
        private.current_member_role(organization_id) = 'tenant'
        and tenant_visible
        and (
          (conversation_id is not null and private.can_access_conversation(organization_id, conversation_id))
          or (
            maintenance_request_id is not null
            and private.can_access_maintenance_request(organization_id, maintenance_request_id)
          )
          or (lease_id is not null and private.is_tenant_for_lease(organization_id, lease_id))
        )
      )
    )
  );

create policy document_links_update_scoped
  on public.document_links for update to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager', 'accounting']::public.app_role[]
    )
  )
  with check (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager', 'accounting']::public.app_role[]
    )
    and private.can_read_document(organization_id, document_id)
  );

create policy document_links_delete_scoped
  on public.document_links for delete to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
    or created_by = (select auth.uid())
  );

create policy document_extractions_select
  on public.document_extractions for select to authenticated
  using (
    private.can_read_document(organization_id, document_id)
    and private.current_member_role(organization_id) <> 'tenant'
  );

create policy document_extractions_insert
  on public.document_extractions for insert to authenticated
  with check (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager', 'accounting']::public.app_role[]
    )
    and private.can_read_document(organization_id, document_id)
  );

create policy document_extractions_update
  on public.document_extractions for update to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager', 'accounting']::public.app_role[]
    )
  )
  with check (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager', 'accounting']::public.app_role[]
    )
    and private.can_read_document(organization_id, document_id)
  );

create policy document_extractions_delete
  on public.document_extractions for delete to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin']::public.app_role[]
    )
  );

create policy tax_profiles_select
  on public.tax_profiles for select to authenticated
  using (
    private.can_access_tax_data(organization_id)
    and (
      user_id = (select auth.uid())
      or private.current_member_role(organization_id) in ('owner', 'admin', 'accounting')
    )
  );

create policy tax_profiles_insert
  on public.tax_profiles for insert to authenticated
  with check (
    private.can_access_tax_data(organization_id)
    and (
      user_id = (select auth.uid())
      or private.current_member_role(organization_id) in ('owner', 'admin')
    )
  );

create policy tax_profiles_update
  on public.tax_profiles for update to authenticated
  using (
    private.can_access_tax_data(organization_id)
    and (
      user_id = (select auth.uid())
      or private.current_member_role(organization_id) in ('owner', 'admin', 'accounting')
    )
  )
  with check (
    private.can_access_tax_data(organization_id)
    and (
      user_id = (select auth.uid())
      or private.current_member_role(organization_id) in ('owner', 'admin', 'accounting')
    )
  );

create policy tax_profiles_delete
  on public.tax_profiles for delete to authenticated
  using (
    user_id = (select auth.uid())
    or private.has_org_role(
      organization_id,
      array['owner', 'admin']::public.app_role[]
    )
  );

create policy tax_years_select
  on public.tax_years for select to authenticated
  using (private.can_access_tax_data(organization_id));

create policy tax_years_insert
  on public.tax_years for insert to authenticated
  with check (private.can_access_tax_data(organization_id));

create policy tax_years_update
  on public.tax_years for update to authenticated
  using (private.can_access_tax_data(organization_id))
  with check (private.can_access_tax_data(organization_id));

create policy tax_years_delete
  on public.tax_years for delete to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin']::public.app_role[]
    )
  );

create policy tax_assumptions_select
  on public.tax_assumptions for select to authenticated
  using (private.can_access_tax_data(organization_id));

create policy tax_assumptions_insert
  on public.tax_assumptions for insert to authenticated
  with check (private.can_access_tax_data(organization_id));

create policy tax_assumptions_update
  on public.tax_assumptions for update to authenticated
  using (private.can_access_tax_data(organization_id))
  with check (private.can_access_tax_data(organization_id));

create policy tax_assumptions_delete
  on public.tax_assumptions for delete to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin']::public.app_role[]
    )
  );

create policy depreciation_assets_select
  on public.depreciation_assets for select to authenticated
  using (private.can_access_tax_data(organization_id));

create policy depreciation_assets_insert
  on public.depreciation_assets for insert to authenticated
  with check (
    private.can_access_tax_data(organization_id)
    and private.can_view_property(organization_id, property_id)
  );

create policy depreciation_assets_update
  on public.depreciation_assets for update to authenticated
  using (private.can_access_tax_data(organization_id))
  with check (
    private.can_access_tax_data(organization_id)
    and private.can_view_property(organization_id, property_id)
  );

create policy depreciation_assets_delete
  on public.depreciation_assets for delete to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin']::public.app_role[]
    )
  );

create policy tax_snapshots_select
  on public.tax_calculation_snapshots for select to authenticated
  using (private.can_access_tax_data(organization_id));

create policy tax_snapshots_insert
  on public.tax_calculation_snapshots for insert to authenticated
  with check (private.can_access_tax_data(organization_id));

create policy loans_select
  on public.loans for select to authenticated
  using (
    private.can_access_tax_data(organization_id)
    and private.can_view_property(organization_id, property_id)
  );

create policy loans_insert
  on public.loans for insert to authenticated
  with check (
    private.can_access_tax_data(organization_id)
    and private.can_view_property(organization_id, property_id)
  );

create policy loans_update
  on public.loans for update to authenticated
  using (
    private.can_access_tax_data(organization_id)
    and private.can_view_property(organization_id, property_id)
  )
  with check (
    private.can_access_tax_data(organization_id)
    and private.can_view_property(organization_id, property_id)
  );

create policy loans_delete
  on public.loans for delete to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin']::public.app_role[]
    )
  );

create policy loan_payments_select
  on public.loan_payments for select to authenticated
  using (private.can_access_tax_data(organization_id));

create policy loan_payments_insert
  on public.loan_payments for insert to authenticated
  with check (private.can_access_tax_data(organization_id));

create policy loan_payments_update
  on public.loan_payments for update to authenticated
  using (private.can_access_tax_data(organization_id))
  with check (private.can_access_tax_data(organization_id));

create policy loan_payments_delete
  on public.loan_payments for delete to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin']::public.app_role[]
    )
  );

create policy valuations_select
  on public.valuations for select to authenticated
  using (private.can_view_property(organization_id, property_id));

create policy valuations_insert
  on public.valuations for insert to authenticated
  with check (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
    and private.can_view_property(organization_id, property_id)
  );

create policy valuations_update
  on public.valuations for update to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
  )
  with check (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
    and private.can_view_property(organization_id, property_id)
  );

create policy valuations_delete
  on public.valuations for delete to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin']::public.app_role[]
    )
  );

create policy market_rent_comparisons_select
  on public.market_rent_comparisons for select to authenticated
  using (private.can_view_property(organization_id, property_id));

create policy market_rent_comparisons_insert
  on public.market_rent_comparisons for insert to authenticated
  with check (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
    and private.can_view_property(organization_id, property_id)
  );

create policy market_rent_comparisons_update
  on public.market_rent_comparisons for update to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
  )
  with check (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
    and private.can_view_property(organization_id, property_id)
  );

create policy market_rent_comparisons_delete
  on public.market_rent_comparisons for delete to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin']::public.app_role[]
    )
  );

create policy renovation_projects_select
  on public.renovation_projects for select to authenticated
  using (private.can_view_property(organization_id, property_id));

create policy renovation_projects_insert
  on public.renovation_projects for insert to authenticated
  with check (private.can_operate_property(organization_id, property_id));

create policy renovation_projects_update
  on public.renovation_projects for update to authenticated
  using (private.can_operate_property(organization_id, property_id))
  with check (private.can_operate_property(organization_id, property_id));

create policy renovation_projects_delete
  on public.renovation_projects for delete to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
  );

create policy renovation_items_select
  on public.renovation_items for select to authenticated
  using (
    exists (
      select 1
      from public.renovation_projects as rp
      where rp.id = renovation_project_id
        and private.can_view_property(organization_id, rp.property_id)
    )
  );

create policy renovation_items_insert
  on public.renovation_items for insert to authenticated
  with check (
    exists (
      select 1
      from public.renovation_projects as rp
      where rp.id = renovation_project_id
        and private.can_operate_property(organization_id, rp.property_id)
    )
  );

create policy renovation_items_update
  on public.renovation_items for update to authenticated
  using (
    exists (
      select 1
      from public.renovation_projects as rp
      where rp.id = renovation_project_id
        and private.can_operate_property(organization_id, rp.property_id)
    )
  )
  with check (
    exists (
      select 1
      from public.renovation_projects as rp
      where rp.id = renovation_project_id
        and private.can_operate_property(organization_id, rp.property_id)
    )
  );

create policy renovation_items_delete
  on public.renovation_items for delete to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
  );

create policy maintenance_reserves_select
  on public.maintenance_reserves for select to authenticated
  using (
    private.can_read_bookkeeping(organization_id)
    and private.can_view_property(organization_id, property_id)
  );

create policy maintenance_reserves_insert
  on public.maintenance_reserves for insert to authenticated
  with check (
    private.can_write_bookkeeping(organization_id)
    and private.can_view_property(organization_id, property_id)
  );

create policy maintenance_reserves_update
  on public.maintenance_reserves for update to authenticated
  using (
    private.can_write_bookkeeping(organization_id)
    and private.can_view_property(organization_id, property_id)
  )
  with check (
    private.can_write_bookkeeping(organization_id)
    and private.can_view_property(organization_id, property_id)
  );

create policy maintenance_reserves_delete
  on public.maintenance_reserves for delete to authenticated
  using (private.can_delete_bookkeeping(organization_id));

create policy optimization_insights_select
  on public.optimization_insights for select to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager', 'accounting']::public.app_role[]
    )
    and (property_id is null or private.can_view_property(organization_id, property_id))
  );

create policy optimization_insights_insert
  on public.optimization_insights for insert to authenticated
  with check (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
  );

create policy optimization_insights_update
  on public.optimization_insights for update to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
  )
  with check (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
  );

create policy optimization_insights_delete
  on public.optimization_insights for delete to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin']::public.app_role[]
    )
  );

create policy conversations_select
  on public.conversations for select to authenticated
  using (private.can_access_conversation(organization_id, id));

create policy conversations_insert
  on public.conversations for insert to authenticated
  with check (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
    or (
      private.current_member_role(organization_id) = 'employee'
      and property_id is not null
      and private.can_operate_property(organization_id, property_id)
    )
    or (
      private.current_member_role(organization_id) = 'tenant'
      and not is_internal
      and lease_id is not null
      and private.is_tenant_for_lease(organization_id, lease_id)
    )
  );

create policy conversations_update_staff
  on public.conversations for update to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
    or (
      private.current_member_role(organization_id) = 'employee'
      and property_id is not null
      and private.can_operate_property(organization_id, property_id)
    )
  )
  with check (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
    or (
      private.current_member_role(organization_id) = 'employee'
      and property_id is not null
      and private.can_operate_property(organization_id, property_id)
    )
  );

create policy conversations_delete_management
  on public.conversations for delete to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
  );

create policy conversation_participants_select
  on public.conversation_participants for select to authenticated
  using (private.can_access_conversation(organization_id, conversation_id));

create policy conversation_participants_insert_staff
  on public.conversation_participants for insert to authenticated
  with check (
    private.can_access_conversation(organization_id, conversation_id)
    and private.current_member_role(organization_id) <> 'tenant'
  );

create policy conversation_participants_update_staff
  on public.conversation_participants for update to authenticated
  using (
    private.can_access_conversation(organization_id, conversation_id)
    and private.current_member_role(organization_id) <> 'tenant'
  )
  with check (
    private.can_access_conversation(organization_id, conversation_id)
    and private.current_member_role(organization_id) <> 'tenant'
  );

create policy conversation_participants_delete_staff
  on public.conversation_participants for delete to authenticated
  using (
    private.can_access_conversation(organization_id, conversation_id)
    and private.current_member_role(organization_id) <> 'tenant'
  );

create policy messages_select
  on public.messages for select to authenticated
  using (
    private.can_access_conversation(organization_id, conversation_id)
    and (
      not is_internal_note
      or private.current_member_role(organization_id) <> 'tenant'
    )
  );

create policy messages_insert
  on public.messages for insert to authenticated
  with check (
    private.can_access_conversation(organization_id, conversation_id)
    and (
      (
        author_user_id = (select auth.uid())
        and author_tenant_id is null
        and private.current_member_role(organization_id) <> 'tenant'
      )
      or (
        author_user_id is null
        and author_tenant_id is not null
        and private.is_tenant_for_tenant(organization_id, author_tenant_id)
        and not is_internal_note
      )
    )
  );

create policy messages_update_author
  on public.messages for update to authenticated
  using (
    private.can_access_conversation(organization_id, conversation_id)
    and (
      author_user_id = (select auth.uid())
      or (
        author_tenant_id is not null
        and private.is_tenant_for_tenant(organization_id, author_tenant_id)
      )
    )
  )
  with check (
    private.can_access_conversation(organization_id, conversation_id)
    and (
      (
        author_user_id = (select auth.uid())
        and private.current_member_role(organization_id) <> 'tenant'
      )
      or (
        author_tenant_id is not null
        and private.is_tenant_for_tenant(organization_id, author_tenant_id)
        and not is_internal_note
      )
    )
  );

create policy messages_delete_management
  on public.messages for delete to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
    or author_user_id = (select auth.uid())
  );

create policy maintenance_requests_select
  on public.maintenance_requests for select to authenticated
  using (private.can_access_maintenance_request(organization_id, id));

create policy maintenance_requests_insert
  on public.maintenance_requests for insert to authenticated
  with check (
    private.can_operate_property(organization_id, property_id)
    or (
      private.current_member_role(organization_id) = 'tenant'
      and private.tenant_request_scope_is_valid(
        organization_id,
        property_id,
        unit_id,
        lease_id,
        tenant_id
      )
    )
  );

create policy maintenance_requests_update_staff
  on public.maintenance_requests for update to authenticated
  using (private.can_operate_property(organization_id, property_id))
  with check (private.can_operate_property(organization_id, property_id));

create policy maintenance_requests_delete_management
  on public.maintenance_requests for delete to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
  );

create policy tasks_select
  on public.tasks for select to authenticated
  using (private.can_access_task(organization_id, id));

create policy tasks_insert
  on public.tasks for insert to authenticated
  with check (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
    or (
      private.current_member_role(organization_id) = 'employee'
      and property_id is not null
      and private.can_operate_property(organization_id, property_id)
    )
  );

create policy tasks_update
  on public.tasks for update to authenticated
  using (private.can_access_task(organization_id, id))
  with check (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
    or (
      private.current_member_role(organization_id) = 'employee'
      and property_id is not null
      and private.can_operate_property(organization_id, property_id)
    )
  );

create policy tasks_delete_management
  on public.tasks for delete to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
  );

create policy comments_select
  on public.comments for select to authenticated
  using (
    (
      task_id is not null
      and private.can_access_task(organization_id, task_id)
      and private.current_member_role(organization_id) <> 'tenant'
    )
    or (
      maintenance_request_id is not null
      and private.can_access_maintenance_request(organization_id, maintenance_request_id)
      and (
        not is_internal
        or private.current_member_role(organization_id) <> 'tenant'
      )
    )
  );

create policy comments_insert
  on public.comments for insert to authenticated
  with check (
    (
      author_user_id = (select auth.uid())
      and private.current_member_role(organization_id) <> 'tenant'
      and (
        (task_id is not null and private.can_access_task(organization_id, task_id))
        or (
          maintenance_request_id is not null
          and private.can_access_maintenance_request(organization_id, maintenance_request_id)
        )
      )
    )
    or (
      author_tenant_id is not null
      and private.is_tenant_for_tenant(organization_id, author_tenant_id)
      and maintenance_request_id is not null
      and private.can_access_maintenance_request(organization_id, maintenance_request_id)
      and not is_internal
    )
  );

create policy comments_update_author
  on public.comments for update to authenticated
  using (
    author_user_id = (select auth.uid())
    or (
      author_tenant_id is not null
      and private.is_tenant_for_tenant(organization_id, author_tenant_id)
    )
  )
  with check (
    (
      author_user_id = (select auth.uid())
      and private.current_member_role(organization_id) <> 'tenant'
      and (
        (task_id is not null and private.can_access_task(organization_id, task_id))
        or (
          maintenance_request_id is not null
          and private.can_access_maintenance_request(organization_id, maintenance_request_id)
        )
      )
    )
    or (
      author_tenant_id is not null
      and private.is_tenant_for_tenant(organization_id, author_tenant_id)
      and maintenance_request_id is not null
      and private.can_access_maintenance_request(organization_id, maintenance_request_id)
      and not is_internal
    )
  );

create policy comments_delete
  on public.comments for delete to authenticated
  using (
    private.has_org_role(
      organization_id,
      array['owner', 'admin', 'property_manager']::public.app_role[]
    )
    or author_user_id = (select auth.uid())
  );

create policy notifications_select_self
  on public.notifications for select to authenticated
  using (
    user_id = (select auth.uid())
    and private.is_org_member(organization_id)
  );

create policy notifications_update_self
  on public.notifications for update to authenticated
  using (
    user_id = (select auth.uid())
    and private.is_org_member(organization_id)
  )
  with check (
    user_id = (select auth.uid())
    and private.is_org_member(organization_id)
  );

create policy notifications_delete_self
  on public.notifications for delete to authenticated
  using (
    user_id = (select auth.uid())
    and private.is_org_member(organization_id)
  );

create policy integration_connections_select
  on public.integration_connections for select to authenticated
  using (private.can_manage_organization(organization_id));

create policy integration_connections_insert
  on public.integration_connections for insert to authenticated
  with check (private.can_manage_organization(organization_id));

create policy integration_connections_update
  on public.integration_connections for update to authenticated
  using (private.can_manage_organization(organization_id))
  with check (private.can_manage_organization(organization_id));

create policy integration_connections_delete_owner
  on public.integration_connections for delete to authenticated
  using (private.has_org_role(organization_id, array['owner']::public.app_role[]));

create policy integration_sync_logs_select
  on public.integration_sync_logs for select to authenticated
  using (private.can_manage_organization(organization_id));

create policy audit_logs_select
  on public.audit_logs for select to authenticated
  using (
    organization_id is not null
    and private.has_org_role(
      organization_id,
      array['owner', 'admin', 'accounting']::public.app_role[]
    )
  );

create or replace function private.can_write_document_object(
  p_path text,
  p_delete boolean default false
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.documents as d
    where d.organization_id = private.safe_path_uuid(p_path, 1)
      and d.id = private.safe_path_uuid(p_path, 2)
      and (
        private.has_org_role(
          d.organization_id,
          case
            when p_delete
              then array['owner', 'admin', 'property_manager']::public.app_role[]
            else array['owner', 'admin', 'property_manager', 'accounting']::public.app_role[]
          end
        )
        or (
          d.created_by = (select auth.uid())
          and (
            (
              private.current_member_role(d.organization_id) = 'employee'
              and d.property_id is not null
              and private.can_operate_property(d.organization_id, d.property_id)
            )
            or (
              private.current_member_role(d.organization_id) = 'tenant'
              and d.tenant_visible
              and d.lease_id is not null
              and private.is_tenant_for_lease(d.organization_id, d.lease_id)
            )
          )
        )
      )
  )
$$;

create or replace function private.can_access_message_object(p_path text)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.messages as m
    where m.organization_id = private.safe_path_uuid(p_path, 1)
      and m.conversation_id = private.safe_path_uuid(p_path, 2)
      and m.id = private.safe_path_uuid(p_path, 3)
      and private.can_access_conversation(m.organization_id, m.conversation_id)
      and (
        not m.is_internal_note
        or private.current_member_role(m.organization_id) <> 'tenant'
      )
  )
$$;

-- Explicit Data API privileges (independent of RLS).
revoke all privileges on all tables in schema public from anon, authenticated;
revoke all privileges on all sequences in schema public from anon, authenticated;

grant select on all tables in schema public to authenticated;

grant update (full_name, display_name, phone, avatar_url, locale, timezone, onboarding_completed_at)
  on public.profiles to authenticated;

grant update, delete on public.organizations to authenticated;
grant insert, update, delete on
  public.organization_members,
  public.invitations,
  public.properties,
  public.property_assignments,
  public.units,
  public.tenants,
  public.tenant_users,
  public.leases,
  public.lease_tenants,
  public.rent_schedules,
  public.rent_claims,
  public.rent_payments,
  public.bank_accounts,
  public.bank_connections,
  public.bank_transactions,
  public.transaction_matches,
  public.income_entries,
  public.expense_entries,
  public.expense_categories,
  public.documents,
  public.document_links,
  public.document_extractions,
  public.tax_profiles,
  public.tax_years,
  public.tax_assumptions,
  public.depreciation_assets,
  public.loans,
  public.loan_payments,
  public.valuations,
  public.market_rent_comparisons,
  public.renovation_projects,
  public.renovation_items,
  public.maintenance_reserves,
  public.optimization_insights,
  public.conversations,
  public.conversation_participants,
  public.messages,
  public.maintenance_requests,
  public.tasks,
  public.comments
to authenticated;

grant insert on public.tax_calculation_snapshots to authenticated;
grant update (read_at, dismissed_at) on public.notifications to authenticated;
grant delete on public.notifications to authenticated;

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function private.current_member_role(uuid) to authenticated, service_role;
grant execute on function private.is_org_member(uuid) to authenticated, service_role;
grant execute on function private.has_org_role(uuid, public.app_role[]) to authenticated, service_role;
grant execute on function private.can_manage_organization(uuid) to authenticated, service_role;
grant execute on function private.can_manage_members(uuid, public.app_role) to authenticated, service_role;
grant execute on function private.is_tenant_for_tenant(uuid, uuid) to authenticated, service_role;
grant execute on function private.is_tenant_for_lease(uuid, uuid) to authenticated, service_role;
grant execute on function private.can_view_property(uuid, uuid) to authenticated, service_role;
grant execute on function private.can_operate_property(uuid, uuid) to authenticated, service_role;
grant execute on function private.can_view_unit(uuid, uuid) to authenticated, service_role;
grant execute on function private.can_view_lease(uuid, uuid) to authenticated, service_role;
grant execute on function private.can_manage_leases(uuid) to authenticated, service_role;
grant execute on function private.can_read_bookkeeping(uuid) to authenticated, service_role;
grant execute on function private.can_write_bookkeeping(uuid) to authenticated, service_role;
grant execute on function private.can_delete_bookkeeping(uuid) to authenticated, service_role;
grant execute on function private.can_access_bank_data(uuid) to authenticated, service_role;
grant execute on function private.can_access_tax_data(uuid) to authenticated, service_role;
grant execute on function private.can_view_tenant(uuid, uuid) to authenticated, service_role;
grant execute on function private.can_view_profile(uuid) to authenticated, service_role;
grant execute on function private.can_access_conversation(uuid, uuid) to authenticated, service_role;
grant execute on function private.can_access_maintenance_request(uuid, uuid) to authenticated, service_role;
grant execute on function private.can_access_task(uuid, uuid) to authenticated, service_role;
grant execute on function private.can_read_document(uuid, uuid) to authenticated, service_role;
grant execute on function private.tenant_request_scope_is_valid(uuid, uuid, uuid, uuid, uuid)
  to authenticated, service_role;
grant execute on function private.safe_path_uuid(text, integer) to authenticated, service_role;
grant execute on function private.can_read_document_object(text) to authenticated, service_role;
grant execute on function private.can_write_document_object(text, boolean)
  to authenticated, service_role;
grant execute on function private.can_access_property_object(text, boolean)
  to authenticated, service_role;
grant execute on function private.can_access_message_object(text)
  to authenticated, service_role;

revoke all on type
  public.app_role,
  public.membership_status,
  public.invitation_status,
  public.organization_kind,
  public.record_status,
  public.priority_level,
  public.payment_status,
  public.match_status,
  public.document_review_status,
  public.task_status,
  public.sync_status
from public, anon;

grant usage on type
  public.app_role,
  public.membership_status,
  public.invitation_status,
  public.organization_kind,
  public.record_status,
  public.priority_level,
  public.payment_status,
  public.match_status,
  public.document_review_status,
  public.task_status,
  public.sync_status
to authenticated, service_role;

-- Private Storage buckets. Object keys use:
-- documents:          <organization_id>/<document_id>/<filename>
-- property-images:    <organization_id>/<property_id>/<filename>
-- message-attachments:<organization_id>/<conversation_id>/<message_id>/<filename>
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'documents',
    'documents',
    false,
    52428800,
    array[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'text/csv',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ]
  ),
  (
    'property-images',
    'property-images',
    false,
    15728640,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic']
  ),
  (
    'message-attachments',
    'message-attachments',
    false,
    26214400,
    array[
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'text/plain'
    ]
  )
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy estate_brain_documents_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'documents'
    and private.can_read_document_object(name)
  );

create policy estate_brain_documents_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'documents'
    and private.can_write_document_object(name, false)
  );

create policy estate_brain_documents_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'documents'
    and private.can_write_document_object(name, false)
  )
  with check (
    bucket_id = 'documents'
    and private.can_write_document_object(name, false)
  );

create policy estate_brain_documents_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'documents'
    and private.can_write_document_object(name, true)
  );

create policy estate_brain_property_images_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'property-images'
    and private.can_access_property_object(name, false)
  );

create policy estate_brain_property_images_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'property-images'
    and private.can_access_property_object(name, true)
  );

create policy estate_brain_property_images_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'property-images'
    and private.can_access_property_object(name, true)
  )
  with check (
    bucket_id = 'property-images'
    and private.can_access_property_object(name, true)
  );

create policy estate_brain_property_images_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'property-images'
    and private.can_access_property_object(name, true)
  );

create policy estate_brain_message_attachments_select
  on storage.objects for select to authenticated
  using (
    bucket_id = 'message-attachments'
    and private.can_access_message_object(name)
  );

create policy estate_brain_message_attachments_insert
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'message-attachments'
    and private.can_access_message_object(name)
  );

create policy estate_brain_message_attachments_update
  on storage.objects for update to authenticated
  using (
    bucket_id = 'message-attachments'
    and private.can_access_message_object(name)
    and owner_id = (select auth.uid())::text
  )
  with check (
    bucket_id = 'message-attachments'
    and private.can_access_message_object(name)
    and owner_id = (select auth.uid())::text
  );

create policy estate_brain_message_attachments_delete
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'message-attachments'
    and private.can_access_message_object(name)
    and (
      owner_id = (select auth.uid())::text
      or private.has_org_role(
        private.safe_path_uuid(name, 1),
        array['owner', 'admin', 'property_manager']::public.app_role[]
      )
    )
  );

-- Atomic application RPCs. Public wrappers are explicitly granted only to
-- authenticated clients; every function performs its own authorization.
create or replace function public.create_organization_with_owner(
  p_name text,
  p_organization_type text,
  p_address jsonb,
  p_currency text default 'EUR',
  p_tax_year integer default extract(year from current_date)::integer
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
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if coalesce((select auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'A permanent account is required' using errcode = '42501';
  end if;
  if char_length(trim(coalesce(p_name, ''))) not between 2 and 160 then
    raise exception 'Organization name must contain between 2 and 160 characters'
      using errcode = '22023';
  end if;
  if p_organization_type not in ('private_person', 'company') then
    raise exception 'Invalid organization type' using errcode = '22023';
  end if;
  if p_currency !~ '^[A-Z]{3}$' then
    raise exception 'Currency must be an ISO 4217 code' using errcode = '22023';
  end if;
  if p_tax_year not between 1900 and 2200 then
    raise exception 'Invalid tax year' using errcode = '22023';
  end if;
  if p_address is not null and jsonb_typeof(p_address) <> 'object' then
    raise exception 'Address must be a JSON object' using errcode = '22023';
  end if;

  v_kind := p_organization_type::public.organization_kind;

  insert into public.organizations (
    name,
    kind,
    owner_user_id,
    street,
    house_number,
    postal_code,
    city,
    country_code,
    default_currency,
    created_by
  )
  values (
    trim(p_name),
    v_kind,
    v_user_id,
    nullif(trim(coalesce(p_address ->> 'street', '')), ''),
    nullif(trim(coalesce(p_address ->> 'house_number', '')), ''),
    nullif(trim(coalesce(p_address ->> 'postal_code', '')), ''),
    nullif(trim(coalesce(p_address ->> 'city', '')), ''),
    coalesce(nullif(upper(trim(coalesce(p_address ->> 'country_code', ''))), ''), 'DE'),
    p_currency,
    v_user_id
  )
  returning id into v_organization_id;

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    status,
    joined_at,
    created_by
  )
  values (
    v_organization_id,
    v_user_id,
    'owner',
    'active',
    now(),
    v_user_id
  );

  insert into public.tax_years (
    organization_id,
    year,
    created_by
  )
  values (
    v_organization_id,
    p_tax_year,
    v_user_id
  );

  return v_organization_id;
end
$$;

create or replace function public.accept_invitation(raw_token text)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_user_email text;
  v_invitation public.invitations%rowtype;
  v_token_hash bytea;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if char_length(coalesce(raw_token, '')) < 32 then
    raise exception 'Invalid invitation token' using errcode = '22023';
  end if;

  select lower(u.email)
    into v_user_email
    from auth.users as u
   where u.id = v_user_id;

  if v_user_email is null then
    raise exception 'A verified email address is required' using errcode = '42501';
  end if;

  v_token_hash := extensions.digest(convert_to(raw_token, 'UTF8'), 'sha256');

  select i.*
    into v_invitation
    from public.invitations as i
   where i.token_hash = v_token_hash
   for update;

  if not found
     or v_invitation.status <> 'pending'
     or v_invitation.expires_at <= now()
     or lower(v_invitation.email) <> v_user_email then
    raise exception 'Invitation is invalid, expired, or belongs to another account'
      using errcode = '42501';
  end if;

  insert into public.organization_members (
    organization_id,
    user_id,
    role,
    status,
    is_property_restricted,
    invited_by,
    joined_at,
    created_by
  )
  values (
    v_invitation.organization_id,
    v_user_id,
    v_invitation.role,
    'active',
    v_invitation.property_restricted,
    v_invitation.invited_by,
    now(),
    v_user_id
  )
  on conflict (organization_id, user_id) do update
    set role = excluded.role,
        status = 'active',
        is_property_restricted = excluded.is_property_restricted,
        invited_by = excluded.invited_by,
        joined_at = coalesce(public.organization_members.joined_at, now());

  if v_invitation.role = 'tenant' then
    insert into public.tenant_users (
      organization_id,
      tenant_id,
      user_id,
      is_primary,
      verified_at,
      created_by
    )
    values (
      v_invitation.organization_id,
      v_invitation.tenant_id,
      v_user_id,
      true,
      now(),
      v_user_id
    )
    on conflict (organization_id, user_id) do update
      set tenant_id = excluded.tenant_id,
          verified_at = coalesce(public.tenant_users.verified_at, now());
  end if;

  update public.invitations
     set status = 'accepted',
         accepted_by = v_user_id,
         accepted_at = now()
   where id = v_invitation.id;

  return v_invitation.organization_id;
end
$$;

create or replace function public.generate_monthly_rent_claims(
  p_organization_id uuid,
  p_period date
)
returns integer
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_period date := date_trunc('month', p_period)::date;
  v_inserted integer;
begin
  if (select auth.uid()) is null
     or not private.has_org_role(
       p_organization_id,
       array['owner', 'admin', 'property_manager', 'accounting']::public.app_role[]
     ) then
    raise exception 'Insufficient permission to generate rent claims'
      using errcode = '42501';
  end if;

  with applicable_schedules as (
    select distinct on (rs.lease_id)
      rs.id,
      rs.organization_id,
      rs.lease_id,
      rs.due_day,
      rs.cold_rent_cents,
      rs.ancillary_prepayment_cents,
      rs.parking_rent_cents,
      rs.other_rent_cents
    from public.rent_schedules as rs
    join public.leases as l
      on l.id = rs.lease_id
     and l.organization_id = rs.organization_id
    where rs.organization_id = p_organization_id
      and rs.valid_from <= (v_period + interval '1 month - 1 day')::date
      and (rs.valid_until is null or rs.valid_until >= v_period)
      and l.starts_on <= (v_period + interval '1 month - 1 day')::date
      and (l.ends_on is null or l.ends_on >= v_period)
      and l.status in ('active', 'notice_given')
    order by rs.lease_id, rs.valid_from desc, rs.created_at desc
  )
  insert into public.rent_claims (
    organization_id,
    lease_id,
    rent_schedule_id,
    claim_month,
    due_date,
    cold_rent_cents,
    ancillary_cents,
    parking_cents,
    other_cents,
    created_by
  )
  select
    s.organization_id,
    s.lease_id,
    s.id,
    v_period,
    least(
      v_period + (s.due_day - 1),
      (v_period + interval '1 month - 1 day')::date
    ),
    s.cold_rent_cents,
    s.ancillary_prepayment_cents,
    s.parking_rent_cents,
    s.other_rent_cents,
    (select auth.uid())
  from applicable_schedules as s
  on conflict (lease_id, claim_month) do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end
$$;

create or replace function public.confirm_transaction_match(p_match_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_match public.transaction_matches%rowtype;
  v_transaction public.bank_transactions%rowtype;
begin
  select tm.*
    into v_match
    from public.transaction_matches as tm
   where tm.id = p_match_id
   for update;

  if not found then
    raise exception 'Transaction match not found' using errcode = 'P0002';
  end if;
  if (select auth.uid()) is null
     or not private.has_org_role(
       v_match.organization_id,
       array['owner', 'admin', 'property_manager', 'accounting']::public.app_role[]
     ) then
    raise exception 'Insufficient permission to confirm this match'
      using errcode = '42501';
  end if;
  if v_match.status = 'confirmed' then
    return v_match.id;
  end if;
  if v_match.status <> 'suggested' then
    raise exception 'Only suggested matches can be confirmed' using errcode = '22023';
  end if;

  select bt.*
    into v_transaction
    from public.bank_transactions as bt
   where bt.id = v_match.bank_transaction_id
     and bt.organization_id = v_match.organization_id
   for update;

  if not found or v_transaction.is_ignored then
    raise exception 'Bank transaction is missing or excluded' using errcode = '22023';
  end if;

  perform set_config('estate_brain.confirm_transaction_match', 'on', true);

  update public.transaction_matches
     set status = 'confirmed',
         confirmed_by = (select auth.uid()),
         confirmed_at = now(),
         rejected_by = null,
         rejected_at = null
   where id = v_match.id;

  update public.bank_transactions
     set match_status = 'confirmed'
   where id = v_transaction.id;

  if v_match.rent_claim_id is not null then
    if v_transaction.amount_cents <= 0 then
      raise exception 'Rent payments require an incoming bank transaction'
        using errcode = '22023';
    end if;
    insert into public.rent_payments (
      organization_id,
      rent_claim_id,
      bank_transaction_id,
      paid_on,
      amount_cents,
      allocation_status,
      created_by
    )
    values (
      v_match.organization_id,
      v_match.rent_claim_id,
      v_transaction.id,
      v_transaction.booked_on,
      v_transaction.amount_cents,
      'confirmed',
      (select auth.uid())
    )
    on conflict (rent_claim_id, bank_transaction_id) do nothing;
  elsif v_match.income_entry_id is not null then
    if v_transaction.amount_cents <= 0 then
      raise exception 'Income entries require an incoming bank transaction'
        using errcode = '22023';
    end if;
    update public.income_entries
       set bank_transaction_id = v_transaction.id,
           payment_status = 'paid'
     where id = v_match.income_entry_id
       and organization_id = v_match.organization_id;
  elsif v_match.expense_entry_id is not null then
    if v_transaction.amount_cents >= 0 then
      raise exception 'Expense entries require an outgoing bank transaction'
        using errcode = '22023';
    end if;
    update public.expense_entries
       set bank_transaction_id = v_transaction.id,
           payment_status = 'paid'
     where id = v_match.expense_entry_id
       and organization_id = v_match.organization_id;
  end if;

  return v_match.id;
end
$$;

create or replace function public.seed_demo_organization(p_organization_id uuid)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_property_one uuid;
  v_property_two uuid;
  v_unit_one uuid;
  v_unit_two uuid;
  v_unit_three uuid;
  v_tenant_one uuid;
  v_tenant_two uuid;
  v_lease_one uuid;
  v_lease_two uuid;
  v_category_repairs uuid;
begin
  if v_user_id is null
     or not private.has_org_role(
       p_organization_id,
       array['owner']::public.app_role[]
     ) then
    raise exception 'Only the organization owner can seed demo data'
      using errcode = '42501';
  end if;

  perform 1
  from public.organizations as o
  where o.id = p_organization_id
  for update;

  if not found then
    raise exception 'Organization not found' using errcode = 'P0002';
  end if;

  if exists (
    select 1
    from public.organizations as o
    where o.id = p_organization_id
      and o.demo_seeded_at is not null
  ) then
    return p_organization_id;
  end if;

  insert into public.expense_categories (
    organization_id, code, name, is_tax_relevant_default, created_by
  )
  values
    (p_organization_id, 'repairs', 'Reparaturen und Instandhaltung', true, v_user_id),
    (p_organization_id, 'insurance', 'Versicherungen', true, v_user_id),
    (p_organization_id, 'property-tax', 'Grundsteuer', true, v_user_id),
    (p_organization_id, 'loan-interest', 'Darlehenszinsen', true, v_user_id)
  on conflict (organization_id, code) do nothing;

  select ec.id
    into v_category_repairs
    from public.expense_categories as ec
   where ec.organization_id = p_organization_id
     and ec.code = 'repairs';

  insert into public.properties (
    organization_id, name, property_type, street, house_number, postal_code,
    city, construction_year, purchase_date, purchase_price_cents,
    acquisition_costs_cents, land_value_cents, building_value_cents,
    total_area_sqm, rentable_area_sqm, current_market_value_cents,
    expected_monthly_rent_cents, unit_count, created_by
  )
  values (
    p_organization_id, 'Musterstraße 12', 'apartment_building', 'Musterstraße',
    '12', '30159', 'Hannover', 1968, current_date - interval '8 years',
    42000000, 4200000, 10500000, 31500000, 260, 240, 53500000, 252000, 2, v_user_id
  )
  returning id into v_property_one;

  insert into public.properties (
    organization_id, name, property_type, street, house_number, postal_code,
    city, construction_year, purchase_date, purchase_price_cents,
    acquisition_costs_cents, land_value_cents, building_value_cents,
    total_area_sqm, rentable_area_sqm, current_market_value_cents,
    expected_monthly_rent_cents, unit_count, created_by
  )
  values (
    p_organization_id, 'Lindenallee 7', 'multi_family', 'Lindenallee',
    '7', '38100', 'Braunschweig', 1994, current_date - interval '4 years',
    31500000, 3150000, 7800000, 23700000, 185, 172, 36500000, 189000, 1, v_user_id
  )
  returning id into v_property_two;

  insert into public.units (
    organization_id, property_id, unit_number, floor, area_sqm, rooms,
    target_cold_rent_cents, ancillary_prepayment_cents, parking_rent_cents,
    deposit_target_cents, status, created_by
  )
  values (
    p_organization_id, v_property_one, 'EG links', 'EG', 92, 3,
    98000, 24000, 5000, 294000, 'rented', v_user_id
  )
  returning id into v_unit_one;

  insert into public.units (
    organization_id, property_id, unit_number, floor, area_sqm, rooms,
    target_cold_rent_cents, ancillary_prepayment_cents, parking_rent_cents,
    deposit_target_cents, status, created_by
  )
  values (
    p_organization_id, v_property_one, '1. OG rechts', '1. OG', 78, 3,
    87500, 21000, 4000, 262500, 'rented', v_user_id
  )
  returning id into v_unit_two;

  insert into public.units (
    organization_id, property_id, unit_number, floor, area_sqm, rooms,
    target_cold_rent_cents, ancillary_prepayment_cents, parking_rent_cents,
    deposit_target_cents, status, vacancy_since, created_by
  )
  values (
    p_organization_id, v_property_two, 'DG', 'DG', 72, 2.5,
    81000, 19000, 0, 243000, 'vacant', current_date - 21, v_user_id
  )
  returning id into v_unit_three;

  insert into public.tenants (
    organization_id, first_name, last_name, email, created_by
  )
  values (p_organization_id, 'Lea', 'Beispiel', 'lea.beispiel@example.invalid', v_user_id)
  returning id into v_tenant_one;

  insert into public.tenants (
    organization_id, first_name, last_name, email, created_by
  )
  values (p_organization_id, 'Jonas', 'Muster', 'jonas.muster@example.invalid', v_user_id)
  returning id into v_tenant_two;

  insert into public.leases (
    organization_id, unit_id, starts_on, due_day, cold_rent_cents,
    ancillary_prepayment_cents, parking_rent_cents, deposit_cents,
    deposit_paid_cents, deposit_status, status, created_by
  )
  values (
    p_organization_id, v_unit_one, date_trunc('year', current_date)::date - interval '2 years',
    3, 98000, 24000, 5000, 294000, 294000, 'paid', 'active', v_user_id
  )
  returning id into v_lease_one;

  insert into public.leases (
    organization_id, unit_id, starts_on, due_day, cold_rent_cents,
    ancillary_prepayment_cents, parking_rent_cents, deposit_cents,
    deposit_paid_cents, deposit_status, status, created_by
  )
  values (
    p_organization_id, v_unit_two, date_trunc('year', current_date)::date - interval '1 year',
    3, 87500, 21000, 4000, 262500, 262500, 'paid', 'active', v_user_id
  )
  returning id into v_lease_two;

  insert into public.lease_tenants (
    organization_id, lease_id, tenant_id, is_primary, occupancy_starts_on, created_by
  )
  values
    (p_organization_id, v_lease_one, v_tenant_one, true, date_trunc('year', current_date)::date - interval '2 years', v_user_id),
    (p_organization_id, v_lease_two, v_tenant_two, true, date_trunc('year', current_date)::date - interval '1 year', v_user_id);

  insert into public.rent_schedules (
    organization_id, lease_id, valid_from, due_day, cold_rent_cents,
    ancillary_prepayment_cents, parking_rent_cents, created_by
  )
  values
    (p_organization_id, v_lease_one, date_trunc('year', current_date)::date - interval '2 years', 3, 98000, 24000, 5000, v_user_id),
    (p_organization_id, v_lease_two, date_trunc('year', current_date)::date - interval '1 year', 3, 87500, 21000, 4000, v_user_id);

  insert into public.income_entries (
    organization_id, property_id, unit_id, lease_id, entry_date, amount_cents,
    category, description, payment_status, tax_relevant, tax_year, created_by
  )
  values
    (p_organization_id, v_property_one, v_unit_one, v_lease_one, current_date - 35, 127000, 'rent', 'Kaltmiete und Vorauszahlung', 'paid', true, extract(year from current_date - 35)::integer, v_user_id),
    (p_organization_id, v_property_one, v_unit_two, v_lease_two, current_date - 34, 112500, 'rent', 'Kaltmiete und Vorauszahlung', 'paid', true, extract(year from current_date - 34)::integer, v_user_id);

  insert into public.expense_entries (
    organization_id, property_id, category_id, entry_date, service_date,
    amount_cents, description, payment_status, document_status,
    is_cash_effective, is_tax_relevant, is_deductible, tax_year, created_by
  )
  values
    (p_organization_id, v_property_one, v_category_repairs, current_date - 18, current_date - 20, 48500, 'Reparatur Heizungsventil', 'paid', 'complete', true, true, true, extract(year from current_date)::integer, v_user_id),
    (p_organization_id, v_property_two, v_category_repairs, current_date - 9, current_date - 12, 126000, 'Malerarbeiten Treppenhaus', 'open', 'missing', true, true, true, extract(year from current_date)::integer, v_user_id);

  insert into public.loans (
    organization_id, property_id, lender_name, loan_number,
    original_principal_cents, current_balance_cents, nominal_interest_rate,
    initial_repayment_rate, monthly_payment_cents, disbursed_on,
    fixed_rate_until, maturity_date, created_by
  )
  values
    (p_organization_id, v_property_one, 'Demo Bank', 'DEMO-1001', 32000000, 26400000, 0.0195, 0.025, 118000, current_date - interval '8 years', current_date + interval '2 years', current_date + interval '17 years', v_user_id),
    (p_organization_id, v_property_two, 'Demo Bank', 'DEMO-1002', 24500000, 21800000, 0.028, 0.02, 98000, current_date - interval '4 years', current_date + interval '6 years', current_date + interval '21 years', v_user_id);

  insert into public.valuations (
    organization_id, property_id, valued_on, market_value_cents,
    source_type, source_name, confidence, assumptions, created_by
  )
  values
    (p_organization_id, v_property_one, current_date, 53500000, 'manual', 'Demo-Annahme', 0.65, '{"demo":true}'::jsonb, v_user_id),
    (p_organization_id, v_property_two, current_date, 36500000, 'manual', 'Demo-Annahme', 0.60, '{"demo":true}'::jsonb, v_user_id);

  insert into public.renovation_projects (
    organization_id, property_id, name, description, priority,
    planned_start_date, estimated_cost_cents, contingency_rate, status, created_by
  )
  values (
    p_organization_id, v_property_two, 'Fenster prüfen',
    'Unverbindliche Demo-Schätzung; technische Begutachtung erforderlich.',
    'medium', current_date + interval '8 months', 1800000, 0.15, 'open', v_user_id
  );

  insert into public.tasks (
    organization_id, property_id, title, description, priority, due_at,
    responsible_member_id, created_by
  )
  select
    p_organization_id,
    v_property_two,
    'Angebote für Fenster einholen',
    'Mindestens zwei Fachangebote vergleichen.',
    'medium',
    now() + interval '30 days',
    om.id,
    v_user_id
  from public.organization_members as om
  where om.organization_id = p_organization_id
    and om.user_id = v_user_id;

  perform public.generate_monthly_rent_claims(p_organization_id, current_date);
  perform public.generate_monthly_rent_claims(
    p_organization_id,
    (current_date - interval '1 month')::date
  );

  update public.organizations
     set demo_seeded_at = now()
   where id = p_organization_id
     and demo_seeded_at is null;

  return p_organization_id;
end
$$;

revoke all on function public.create_organization_with_owner(text, text, jsonb, text, integer)
  from public, anon;
revoke all on function public.accept_invitation(text) from public, anon;
revoke all on function public.generate_monthly_rent_claims(uuid, date) from public, anon;
revoke all on function public.confirm_transaction_match(uuid) from public, anon;
revoke all on function public.seed_demo_organization(uuid) from public, anon;

grant execute on function public.create_organization_with_owner(text, text, jsonb, text, integer)
  to authenticated, service_role;
grant execute on function public.accept_invitation(text) to authenticated, service_role;
grant execute on function public.generate_monthly_rent_claims(uuid, date)
  to authenticated, service_role;
grant execute on function public.confirm_transaction_match(uuid)
  to authenticated, service_role;
grant execute on function public.seed_demo_organization(uuid)
  to authenticated, service_role;

alter table public.invitations
  add constraint invitations_sha256_length check (octet_length(token_hash) = 32);

create or replace function private.tenant_request_scope_is_valid(
  p_organization_id uuid,
  p_property_id uuid,
  p_unit_id uuid,
  p_lease_id uuid,
  p_tenant_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1
    from public.leases as l
    join public.units as u on u.id = l.unit_id
    join public.lease_tenants as lt on lt.lease_id = l.id
    join public.tenant_users as tu
      on tu.organization_id = lt.organization_id
     and tu.tenant_id = lt.tenant_id
    where l.organization_id = p_organization_id
      and l.id = p_lease_id
      and u.property_id = p_property_id
      and (p_unit_id is null or p_unit_id = u.id)
      and lt.tenant_id = p_tenant_id
      and tu.user_id = (select auth.uid())
  )
$$;

create or replace function private.enforce_created_by()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := (select auth.uid());
begin
  if tg_op = 'INSERT' then
    if v_user_id is not null and new.created_by is null then
      new.created_by := v_user_id;
    elsif v_user_id is not null and new.created_by <> v_user_id then
      raise exception 'created_by must match the authenticated user'
        using errcode = '42501';
    end if;
  elsif new.created_by is distinct from old.created_by then
    raise exception 'created_by is immutable' using errcode = '42501';
  end if;
  return new;
end
$$;

create or replace function private.enforce_immutable_identity()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if new.id is distinct from old.id then
    raise exception 'Primary identifiers are immutable' using errcode = '42501';
  end if;
  if to_jsonb(new) ? 'organization_id'
     and (to_jsonb(new) ->> 'organization_id') is distinct from (to_jsonb(old) ->> 'organization_id') then
    raise exception 'organization_id is immutable' using errcode = '42501';
  end if;
  return new;
end
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'profiles', 'organizations', 'organization_members', 'invitations',
    'properties', 'property_assignments', 'units', 'tenants', 'tenant_users',
    'leases', 'lease_tenants', 'rent_schedules', 'rent_claims', 'rent_payments',
    'bank_accounts', 'bank_connections', 'bank_transactions',
    'transaction_matches', 'income_entries', 'expense_entries',
    'expense_categories', 'documents', 'document_links',
    'document_extractions', 'tax_profiles', 'tax_years', 'tax_assumptions',
    'depreciation_assets', 'tax_calculation_snapshots', 'loans',
    'loan_payments', 'valuations', 'market_rent_comparisons',
    'renovation_projects', 'renovation_items', 'maintenance_reserves',
    'optimization_insights', 'conversations', 'conversation_participants',
    'messages', 'maintenance_requests', 'tasks', 'comments', 'notifications',
    'integration_connections', 'integration_sync_logs'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I
       for each row execute function private.enforce_immutable_identity()',
      v_table || '_immutable_identity',
      v_table
    );
  end loop;
end
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'organizations', 'organization_members', 'invitations', 'properties',
    'property_assignments', 'units', 'tenants', 'tenant_users', 'leases',
    'lease_tenants', 'rent_schedules', 'rent_claims', 'rent_payments',
    'bank_accounts', 'bank_connections', 'bank_transactions',
    'transaction_matches', 'income_entries', 'expense_entries',
    'expense_categories', 'documents', 'document_links',
    'document_extractions', 'tax_profiles', 'tax_years', 'tax_assumptions',
    'depreciation_assets', 'tax_calculation_snapshots', 'loans',
    'loan_payments', 'valuations', 'market_rent_comparisons',
    'renovation_projects', 'renovation_items', 'maintenance_reserves',
    'optimization_insights', 'conversations', 'conversation_participants',
    'messages', 'maintenance_requests', 'tasks', 'comments', 'notifications',
    'integration_connections', 'integration_sync_logs'
  ]
  loop
    execute format(
      'create trigger %I before insert or update of created_by on public.%I
       for each row execute function private.enforce_created_by()',
      v_table || '_created_by',
      v_table
    );
  end loop;
end
$$;

create or replace function private.enforce_user_membership()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid;
begin
  v_user_id := nullif(to_jsonb(new) ->> tg_argv[0], '')::uuid;
  if v_user_id is null then
    return new;
  end if;

  if not exists (
    select 1
    from public.organization_members as om
    where om.organization_id = new.organization_id
      and om.user_id = v_user_id
      and om.status = 'active'
  ) then
    raise check_violation using message = format(
      '%s must reference an active member of the same organization',
      tg_argv[0]
    );
  end if;

  return new;
end
$$;

create trigger conversation_participants_user_membership
  before insert or update of user_id, organization_id on public.conversation_participants
  for each row execute function private.enforce_user_membership('user_id');

create trigger notifications_user_membership
  before insert or update of user_id, organization_id on public.notifications
  for each row execute function private.enforce_user_membership('user_id');

alter table public.documents
  add constraint documents_path_contains_document_id check (
    storage_bucket <> 'documents'
    or private.safe_path_uuid(storage_path, 2) = id
  );

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'profiles', 'organizations', 'organization_members', 'invitations',
    'properties', 'property_assignments', 'units', 'tenants', 'tenant_users',
    'leases', 'lease_tenants', 'rent_schedules', 'rent_claims', 'rent_payments',
    'bank_accounts', 'bank_connections', 'bank_transactions', 'transaction_matches',
    'income_entries', 'expense_entries', 'expense_categories', 'documents',
    'document_links', 'document_extractions', 'tax_profiles', 'tax_years',
    'tax_assumptions', 'depreciation_assets', 'tax_calculation_snapshots',
    'loans', 'loan_payments', 'valuations', 'market_rent_comparisons',
    'renovation_projects', 'renovation_items', 'maintenance_reserves',
    'optimization_insights', 'conversations', 'conversation_participants',
    'messages', 'maintenance_requests', 'tasks', 'comments', 'notifications',
    'integration_connections', 'integration_sync_logs'
  ]
  loop
    execute format(
      'create trigger %I before update on public.%I
       for each row execute function private.set_updated_at()',
      v_table || '_set_updated_at',
      v_table
    );
  end loop;
end
$$;

create or replace function private.refresh_rent_claim_totals()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_claim_id uuid;
  v_total bigint;
begin
  for v_claim_id in
    select distinct claim_id
    from (
      values
        (case when tg_op <> 'DELETE' then new.rent_claim_id else null end),
        (case when tg_op <> 'INSERT' then old.rent_claim_id else null end)
    ) as affected(claim_id)
    where claim_id is not null
  loop
    select coalesce(sum(rp.amount_cents), 0)::bigint
      into v_total
      from public.rent_payments as rp
     where rp.rent_claim_id = v_claim_id
       and rp.allocation_status = 'confirmed';

    update public.rent_claims as rc
       set paid_cents = v_total,
           status = case
             when v_total = 0 then 'open'::public.payment_status
             when v_total < rc.amount_cents then 'partial'::public.payment_status
             when v_total = rc.amount_cents then 'paid'::public.payment_status
             else 'overpaid'::public.payment_status
           end
     where rc.id = v_claim_id;
  end loop;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end
$$;

create trigger rent_payments_refresh_claim
  after insert or update or delete on public.rent_payments
  for each row execute function private.refresh_rent_claim_totals();

create or replace function private.guard_transaction_match_confirmation()
returns trigger
language plpgsql
security invoker
set search_path = pg_catalog
as $$
begin
  if new.status = 'confirmed'
     and (tg_op = 'INSERT' or old.status is distinct from 'confirmed')
     and coalesce(current_setting('estate_brain.confirm_transaction_match', true), '') <> 'on' then
    raise exception 'Confirm transaction matches through confirm_transaction_match()'
      using errcode = '42501';
  end if;
  return new;
end
$$;

create trigger transaction_matches_confirm_via_rpc
  before insert or update of status on public.transaction_matches
  for each row execute function private.guard_transaction_match_confirmation();

create or replace function private.capture_audit_log()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_old jsonb;
  v_new jsonb;
  v_organization_id uuid;
  v_entity_id uuid;
  v_headers jsonb := '{}'::jsonb;
begin
  if tg_op <> 'INSERT' then
    v_old := to_jsonb(old) - array[
      'token_hash', 'iban_hash', 'counterparty_iban_hash', 'raw_data',
      'secret_reference', 'configuration'
    ];
  end if;
  if tg_op <> 'DELETE' then
    v_new := to_jsonb(new) - array[
      'token_hash', 'iban_hash', 'counterparty_iban_hash', 'raw_data',
      'secret_reference', 'configuration'
    ];
  end if;

  v_organization_id := coalesce(
    nullif(v_new ->> 'organization_id', '')::uuid,
    nullif(v_old ->> 'organization_id', '')::uuid,
    case when tg_table_name = 'organizations'
      then coalesce(nullif(v_new ->> 'id', '')::uuid, nullif(v_old ->> 'id', '')::uuid)
    end
  );
  v_entity_id := coalesce(
    nullif(v_new ->> 'id', '')::uuid,
    nullif(v_old ->> 'id', '')::uuid
  );

  if v_organization_id is not null
     and not exists (select 1 from public.organizations as o where o.id = v_organization_id) then
    v_organization_id := null;
  end if;

  begin
    v_headers := coalesce(
      nullif(current_setting('request.headers', true), '')::jsonb,
      '{}'::jsonb
    );
  exception when others then
    v_headers := '{}'::jsonb;
  end;

  insert into public.audit_logs (
    organization_id,
    actor_user_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    old_data,
    new_data,
    request_id,
    user_agent
  )
  values (
    v_organization_id,
    (select auth.uid()),
    case when v_organization_id is null then null
      else private.current_member_role(v_organization_id)
    end,
    lower(tg_op),
    tg_table_name,
    v_entity_id,
    v_old,
    v_new,
    coalesce(v_headers ->> 'x-request-id', v_headers ->> 'x-client-info'),
    v_headers ->> 'user-agent'
  );

  return case when tg_op = 'DELETE' then old else new end;
end
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'organizations', 'organization_members', 'invitations', 'properties',
    'bank_connections', 'bank_accounts', 'transaction_matches',
    'income_entries', 'expense_entries', 'documents', 'tax_assumptions',
    'tax_years', 'loans', 'integration_connections'
  ]
  loop
    execute format(
      'create trigger %I after insert or update or delete on public.%I
       for each row execute function private.capture_audit_log()',
      v_table || '_audit',
      v_table
    );
  end loop;
end
$$;

commit;
