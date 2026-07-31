-- Atomically create a tenant, lease, primary lease assignment and initial rent
-- schedule, then mark the selected unit as rented.
--
-- This function is intentionally the only write entry point used by the
-- combined tenant/lease form. It validates authentication, organization role
-- and the complete property -> unit relationship again inside the transaction.

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
  v_tenant_type text;
  v_first_name text;
  v_last_name text;
  v_company_name text;
  v_email text;
  v_phone text;
  v_street text;
  v_house_number text;
  v_postal_code text;
  v_city text;
  v_country_code text;
  v_lease_number text;
  v_starts_on date;
  v_ends_on date;
  v_notice_period_months smallint;
  v_due_day smallint;
  v_cold_rent_cents bigint;
  v_ancillary_prepayment_cents bigint;
  v_parking_rent_cents bigint;
  v_other_rent_cents bigint;
  v_deposit_cents bigint;
  v_unit public.units%rowtype;
  v_tenant_id uuid;
  v_lease_id uuid;
  v_rent_schedule_id uuid;
begin
  if v_user_id is null
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
    v_tenant_type := nullif(btrim(p_payload ->> 'tenant_type'), '');
    v_first_name := nullif(btrim(p_payload ->> 'first_name'), '');
    v_last_name := nullif(btrim(p_payload ->> 'last_name'), '');
    v_company_name := nullif(btrim(p_payload ->> 'company_name'), '');
    v_email := nullif(lower(btrim(p_payload ->> 'email')), '');
    v_phone := nullif(btrim(p_payload ->> 'phone'), '');
    v_street := nullif(btrim(p_payload ->> 'street'), '');
    v_house_number := nullif(btrim(p_payload ->> 'house_number'), '');
    v_postal_code := nullif(btrim(p_payload ->> 'postal_code'), '');
    v_city := nullif(btrim(p_payload ->> 'city'), '');
    v_country_code := upper(coalesce(nullif(btrim(p_payload ->> 'country_code'), ''), 'DE'));
    v_lease_number := nullif(btrim(p_payload ->> 'lease_number'), '');
    v_starts_on := (p_payload ->> 'starts_on')::date;
    v_ends_on := case
      when nullif(btrim(p_payload ->> 'ends_on'), '') is null then null
      else (p_payload ->> 'ends_on')::date
    end;
    v_notice_period_months := (p_payload ->> 'notice_period_months')::smallint;
    v_due_day := (p_payload ->> 'due_day')::smallint;
    v_cold_rent_cents := (p_payload ->> 'cold_rent_cents')::bigint;
    v_ancillary_prepayment_cents :=
      (p_payload ->> 'ancillary_prepayment_cents')::bigint;
    v_parking_rent_cents := (p_payload ->> 'parking_rent_cents')::bigint;
    v_other_rent_cents := (p_payload ->> 'other_rent_cents')::bigint;
    v_deposit_cents := (p_payload ->> 'deposit_cents')::bigint;
  exception
    when invalid_text_representation
      or invalid_datetime_format
      or datetime_field_overflow
      or numeric_value_out_of_range then
      raise exception 'Lease payload contains invalid values'
        using errcode = '22023';
  end;

  if v_property_id is null or v_unit_id is null then
    raise exception 'Property and unit are required'
      using errcode = '22023';
  end if;

  if v_tenant_type is null
     or v_tenant_type not in ('person', 'company') then
    raise exception 'Tenant type is invalid'
      using errcode = '22023';
  end if;

  if v_tenant_type = 'person'
     and (v_first_name is null or v_last_name is null) then
    raise exception 'First and last name are required for a person'
      using errcode = '22023';
  end if;

  if v_tenant_type = 'company' and v_company_name is null then
    raise exception 'Company name is required for a company'
      using errcode = '22023';
  end if;

  if coalesce(char_length(v_first_name), 0) > 100
     or coalesce(char_length(v_last_name), 0) > 100
     or coalesce(char_length(v_company_name), 0) > 200
     or coalesce(char_length(v_email), 0) > 254
     or coalesce(char_length(v_phone), 0) > 80
     or coalesce(char_length(v_street), 0) > 160
     or coalesce(char_length(v_house_number), 0) > 30
     or coalesce(char_length(v_postal_code), 0) > 20
     or coalesce(char_length(v_city), 0) > 100
     or coalesce(char_length(v_lease_number), 0) > 100 then
    raise exception 'Lease payload contains text that is too long'
      using errcode = '22023';
  end if;

  if v_email is not null
     and v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Tenant email address is invalid'
      using errcode = '22023';
  end if;

  if v_country_code !~ '^[A-Z]{2}$' then
    raise exception 'Country code is invalid'
      using errcode = '22023';
  end if;

  if v_starts_on is null
     or (v_ends_on is not null and v_ends_on < v_starts_on) then
    raise exception 'Lease dates are invalid'
      using errcode = '22023';
  end if;

  if v_notice_period_months is null
     or v_notice_period_months not between 0 and 120
     or v_due_day is null
     or v_due_day not between 1 and 31 then
    raise exception 'Notice period or due day is invalid'
      using errcode = '22023';
  end if;

  if v_cold_rent_cents is null
     or v_cold_rent_cents <= 0
     or v_ancillary_prepayment_cents is null
     or v_ancillary_prepayment_cents < 0
     or v_parking_rent_cents is null
     or v_parking_rent_cents < 0
     or v_other_rent_cents is null
     or v_other_rent_cents < 0
     or v_deposit_cents is null
     or v_deposit_cents < 0
     or greatest(
       v_cold_rent_cents,
       v_ancillary_prepayment_cents,
       v_parking_rent_cents,
       v_other_rent_cents,
       v_deposit_cents
     ) > 100000000000 then
    raise exception 'Lease amounts are invalid'
      using errcode = '22023';
  end if;

  select u.*
    into v_unit
    from public.units as u
    join public.properties as p
      on p.id = u.property_id
     and p.organization_id = u.organization_id
   where p.id = v_property_id
     and p.organization_id = p_organization_id
     and p.status = 'active'
     and p.archived_at is null
     and u.id = v_unit_id
     and u.organization_id = p_organization_id
     and u.archived_at is null
   for update of u;

  if not found then
    raise exception 'Property and unit selection was not found in this organization'
      using errcode = 'P0002';
  end if;

  if v_unit.status not in ('vacant', 'reserved')
     or exists (
       select 1
       from public.leases as l
       where l.organization_id = p_organization_id
         and l.unit_id = v_unit_id
         and l.status in ('active', 'notice_given')
         and l.archived_at is null
     ) then
    raise exception 'The selected unit is no longer available'
      using errcode = '23505';
  end if;

  insert into public.tenants (
    organization_id,
    tenant_type,
    first_name,
    last_name,
    company_name,
    email,
    phone,
    street,
    house_number,
    postal_code,
    city,
    country_code,
    status,
    created_by
  )
  values (
    p_organization_id,
    v_tenant_type,
    case when v_tenant_type = 'person' then v_first_name end,
    case when v_tenant_type = 'person' then v_last_name end,
    case when v_tenant_type = 'company' then v_company_name end,
    v_email,
    v_phone,
    v_street,
    v_house_number,
    v_postal_code,
    v_city,
    v_country_code,
    'active',
    v_user_id
  )
  returning id into v_tenant_id;

  insert into public.leases (
    organization_id,
    unit_id,
    lease_number,
    starts_on,
    ends_on,
    notice_period_months,
    due_day,
    cold_rent_cents,
    ancillary_prepayment_cents,
    parking_rent_cents,
    other_rent_cents,
    deposit_cents,
    deposit_paid_cents,
    deposit_status,
    status,
    created_by
  )
  values (
    p_organization_id,
    v_unit_id,
    v_lease_number,
    v_starts_on,
    v_ends_on,
    v_notice_period_months,
    v_due_day,
    v_cold_rent_cents,
    v_ancillary_prepayment_cents,
    v_parking_rent_cents,
    v_other_rent_cents,
    v_deposit_cents,
    0,
    (
      case when v_deposit_cents = 0 then 'paid' else 'open' end
    )::public.payment_status,
    'active',
    v_user_id
  )
  returning id into v_lease_id;

  insert into public.lease_tenants (
    organization_id,
    lease_id,
    tenant_id,
    is_primary,
    occupancy_starts_on,
    occupancy_ends_on,
    created_by
  )
  values (
    p_organization_id,
    v_lease_id,
    v_tenant_id,
    true,
    v_starts_on,
    v_ends_on,
    v_user_id
  );

  insert into public.rent_schedules (
    organization_id,
    lease_id,
    valid_from,
    valid_until,
    due_day,
    cold_rent_cents,
    ancillary_prepayment_cents,
    parking_rent_cents,
    other_rent_cents,
    reason,
    created_by
  )
  values (
    p_organization_id,
    v_lease_id,
    v_starts_on,
    v_ends_on,
    v_due_day,
    v_cold_rent_cents,
    v_ancillary_prepayment_cents,
    v_parking_rent_cents,
    v_other_rent_cents,
    'Vertragsbeginn',
    v_user_id
  )
  returning id into v_rent_schedule_id;

  update public.units
     set status = 'rented',
         vacancy_since = null
   where id = v_unit_id
     and organization_id = p_organization_id;

  return jsonb_build_object(
    'tenant_id', v_tenant_id,
    'lease_id', v_lease_id,
    'rent_schedule_id', v_rent_schedule_id,
    'unit_id', v_unit_id
  );
end
$$;

revoke all
  on function public.create_tenant_lease(uuid, jsonb)
  from public, anon;

grant execute
  on function public.create_tenant_lease(uuid, jsonb)
  to authenticated;

comment on function public.create_tenant_lease(uuid, jsonb) is
  'Atomically creates a tenant and active lease after authenticated organization and property-unit validation.';
