-- Atomic, manually confirmed document review and expense preparation.
--
-- Upload and review assignments must always form a coherent hierarchy:
-- property -> unit -> lease. Tenant visibility additionally requires a lease.

update public.documents
   set tenant_visible = false
 where tenant_visible
   and lease_id is null;

alter table public.documents
  add constraint documents_tenant_visibility_requires_lease
  check (not tenant_visible or lease_id is not null);

create or replace function private.enforce_document_assignment_scope()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
begin
  if new.unit_id is not null and new.property_id is null then
    raise check_violation
      using message = 'A document unit assignment requires a property';
  end if;

  if new.unit_id is not null
     and not exists (
       select 1
       from public.units as u
       where u.id = new.unit_id
         and u.organization_id = new.organization_id
         and u.property_id = new.property_id
     ) then
    raise check_violation
      using message = 'The selected unit does not belong to the selected property';
  end if;

  if new.lease_id is not null and new.unit_id is null then
    raise check_violation
      using message = 'A document lease assignment requires a unit';
  end if;

  if new.lease_id is not null
     and not exists (
       select 1
       from public.leases as l
       where l.id = new.lease_id
         and l.organization_id = new.organization_id
         and l.unit_id = new.unit_id
     ) then
    raise check_violation
      using message = 'The selected lease does not belong to the selected unit';
  end if;

  if new.tenant_visible and new.lease_id is null then
    raise check_violation
      using message = 'Tenant-visible documents require a lease assignment';
  end if;

  return new;
end
$$;

create trigger documents_enforce_assignment_scope
  before insert or update of organization_id, property_id, unit_id, lease_id, tenant_visible
  on public.documents
  for each row execute function private.enforce_document_assignment_scope();

revoke all on function private.enforce_document_assignment_scope()
  from public, anon;
grant execute on function private.enforce_document_assignment_scope()
  to authenticated, service_role;

create or replace function public.review_document_expense(
  p_organization_id uuid,
  p_document_id uuid,
  p_payload jsonb
)
returns uuid
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_user_id uuid := (select auth.uid());
  v_document public.documents%rowtype;
  v_property_id uuid;
  v_unit_id uuid;
  v_lease_id uuid;
  v_category_id uuid;
  v_extraction_id uuid;
  v_expense_id uuid;
  v_invoice_date date;
  v_service_date date;
  v_entry_date date;
  v_gross_amount_cents bigint;
  v_net_amount_cents bigint;
  v_tax_amount_cents bigint;
  v_currency text;
  v_vendor_name text;
  v_invoice_number text;
  v_recognized_address text;
  v_description text;
  v_notes text;
  v_document_type text;
  v_title text;
  v_payment_status public.payment_status;
  v_tenant_visible boolean;
  v_is_cash_effective boolean;
  v_is_tax_relevant boolean;
  v_is_interest boolean;
  v_is_principal boolean;
  v_is_capitalizable boolean;
  v_is_deductible boolean;
  v_is_recoverable boolean;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if p_organization_id is null
     or p_document_id is null
     or jsonb_typeof(p_payload) <> 'object' then
    raise exception 'Invalid review payload' using errcode = '22023';
  end if;

  if not private.can_write_bookkeeping(p_organization_id) then
    raise exception 'Document review permission required' using errcode = '42501';
  end if;

  select d.*
    into v_document
    from public.documents as d
   where d.id = p_document_id
     and d.organization_id = p_organization_id
     and d.archived_at is null
   for update;

  if not found then
    raise exception 'Document not found' using errcode = 'P0002';
  end if;

  v_property_id := nullif(p_payload ->> 'propertyId', '')::uuid;
  v_unit_id := nullif(p_payload ->> 'unitId', '')::uuid;
  v_lease_id := nullif(p_payload ->> 'leaseId', '')::uuid;
  v_category_id := nullif(p_payload ->> 'categoryId', '')::uuid;
  v_invoice_date := nullif(p_payload ->> 'invoiceDate', '')::date;
  v_service_date := nullif(p_payload ->> 'serviceDate', '')::date;
  v_entry_date := nullif(p_payload ->> 'entryDate', '')::date;
  v_gross_amount_cents :=
    nullif(p_payload ->> 'grossAmountCents', '')::bigint;
  v_net_amount_cents :=
    nullif(p_payload ->> 'netAmountCents', '')::bigint;
  v_tax_amount_cents :=
    nullif(p_payload ->> 'taxAmountCents', '')::bigint;
  v_currency := upper(nullif(trim(p_payload ->> 'currency'), ''));
  v_vendor_name := nullif(trim(p_payload ->> 'vendorName'), '');
  v_invoice_number := nullif(trim(p_payload ->> 'invoiceNumber'), '');
  v_recognized_address :=
    nullif(trim(p_payload ->> 'recognizedAddress'), '');
  v_description := nullif(trim(p_payload ->> 'description'), '');
  v_notes := nullif(trim(p_payload ->> 'notes'), '');
  v_document_type := nullif(trim(p_payload ->> 'documentType'), '');
  v_title := nullif(trim(p_payload ->> 'title'), '');
  v_payment_status := (p_payload ->> 'paymentStatus')::public.payment_status;
  v_tenant_visible :=
    coalesce((p_payload ->> 'tenantVisible')::boolean, false);
  v_is_cash_effective :=
    coalesce((p_payload ->> 'isCashEffective')::boolean, false);
  v_is_tax_relevant :=
    coalesce((p_payload ->> 'isTaxRelevant')::boolean, false);
  v_is_interest := coalesce((p_payload ->> 'isInterest')::boolean, false);
  v_is_principal := coalesce((p_payload ->> 'isPrincipal')::boolean, false);
  v_is_capitalizable :=
    coalesce((p_payload ->> 'isCapitalizable')::boolean, false);
  v_is_deductible :=
    coalesce((p_payload ->> 'isDeductible')::boolean, false);
  v_is_recoverable :=
    coalesce((p_payload ->> 'isRecoverable')::boolean, false);

  if v_property_id is null
     or v_category_id is null
     or v_entry_date is null
     or v_gross_amount_cents is null
     or v_gross_amount_cents <= 0
     or v_currency is null
     or v_currency !~ '^[A-Z]{3}$'
     or v_vendor_name is null
     or char_length(v_vendor_name) > 160
     or v_description is null
     or char_length(v_description) > 500
     or v_document_type is null
     or v_document_type not in (
       'invoice',
       'receipt',
       'contract',
       'lease',
       'bank_statement',
       'tax',
       'insurance',
       'handover',
       'correspondence',
       'other'
     )
     or (v_title is not null and char_length(v_title) > 160)
     or (v_invoice_number is not null and char_length(v_invoice_number) > 100)
     or (
       v_recognized_address is not null
       and char_length(v_recognized_address) > 500
     )
     or (v_notes is not null and char_length(v_notes) > 2000)
     or v_payment_status is null
     or (v_net_amount_cents is null) <> (v_tax_amount_cents is null)
     or (
       v_net_amount_cents is not null
       and (
         v_net_amount_cents < 0
         or v_tax_amount_cents < 0
         or v_net_amount_cents + v_tax_amount_cents <> v_gross_amount_cents
       )
     )
     or (v_is_interest and v_is_principal)
     or (v_unit_id is not null and v_property_id is null)
     or (v_lease_id is not null and v_unit_id is null)
     or (v_tenant_visible and v_lease_id is null) then
    raise exception 'Invalid document review values' using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.properties as p
    where p.id = v_property_id
      and p.organization_id = p_organization_id
      and p.archived_at is null
      and private.can_view_property(p_organization_id, p.id)
  ) then
    raise exception 'Property assignment is not available' using errcode = '42501';
  end if;

  if v_unit_id is not null
     and not exists (
       select 1
       from public.units as u
       where u.id = v_unit_id
         and u.organization_id = p_organization_id
         and u.property_id = v_property_id
         and u.archived_at is null
     ) then
    raise exception 'Unit assignment does not match property'
      using errcode = '22023';
  end if;

  if v_lease_id is not null
     and not exists (
       select 1
       from public.leases as l
       where l.id = v_lease_id
         and l.organization_id = p_organization_id
         and l.unit_id = v_unit_id
         and l.archived_at is null
     ) then
    raise exception 'Lease assignment does not match unit'
      using errcode = '22023';
  end if;

  if not exists (
    select 1
    from public.expense_categories as ec
    where ec.id = v_category_id
      and ec.organization_id = p_organization_id
      and ec.archived_at is null
  ) then
    raise exception 'Expense category is not available' using errcode = '22023';
  end if;

  select de.id
    into v_extraction_id
    from public.document_extractions as de
   where de.organization_id = p_organization_id
     and de.document_id = p_document_id
     and de.provider = 'manual'
   order by de.created_at desc
   limit 1
   for update;

  if v_extraction_id is null then
    insert into public.document_extractions (
      organization_id,
      document_id,
      provider,
      provider_version,
      status,
      extracted_vendor_name,
      extracted_invoice_number,
      extracted_invoice_date,
      extracted_service_date,
      gross_amount_cents,
      net_amount_cents,
      tax_amount_cents,
      extracted_currency,
      extracted_address,
      extracted_fields,
      confidence,
      reviewed_by,
      reviewed_at,
      created_by
    )
    values (
      p_organization_id,
      p_document_id,
      'manual',
      'estate-brain/manual-v1',
      'succeeded',
      v_vendor_name,
      v_invoice_number,
      v_invoice_date,
      v_service_date,
      v_gross_amount_cents,
      v_net_amount_cents,
      v_tax_amount_cents,
      v_currency,
      case
        when v_recognized_address is null then null
        else jsonb_build_object('raw', v_recognized_address)
      end,
      jsonb_build_object(
        'confirmedManually', true,
        'propertyId', v_property_id,
        'unitId', v_unit_id,
        'leaseId', v_lease_id,
        'categoryId', v_category_id
      ),
      1,
      v_user_id,
      now(),
      v_user_id
    )
    returning id into v_extraction_id;
  else
    update public.document_extractions
       set provider_version = 'estate-brain/manual-v1',
           status = 'succeeded',
           extracted_vendor_name = v_vendor_name,
           extracted_invoice_number = v_invoice_number,
           extracted_invoice_date = v_invoice_date,
           extracted_service_date = v_service_date,
           gross_amount_cents = v_gross_amount_cents,
           net_amount_cents = v_net_amount_cents,
           tax_amount_cents = v_tax_amount_cents,
           extracted_currency = v_currency,
           extracted_address = case
             when v_recognized_address is null then null
             else jsonb_build_object('raw', v_recognized_address)
           end,
           extracted_fields =
             coalesce(extracted_fields, '{}'::jsonb)
             || jsonb_build_object(
               'confirmedManually', true,
               'propertyId', v_property_id,
               'unitId', v_unit_id,
               'leaseId', v_lease_id,
               'categoryId', v_category_id
             ),
           confidence = 1,
           error_code = null,
           error_message = null,
           reviewed_by = v_user_id,
           reviewed_at = now()
     where id = v_extraction_id;
  end if;

  select dl.expense_entry_id
    into v_expense_id
    from public.document_links as dl
    join public.expense_entries as ee
      on ee.id = dl.expense_entry_id
     and ee.organization_id = dl.organization_id
   where dl.organization_id = p_organization_id
     and dl.document_id = p_document_id
     and dl.link_type = 'expense_receipt'
     and dl.expense_entry_id is not null
     and ee.archived_at is null
   order by dl.created_at desc
   limit 1
   for update of ee;

  if v_expense_id is null then
    insert into public.expense_entries (
      organization_id,
      property_id,
      unit_id,
      category_id,
      entry_date,
      service_date,
      amount_cents,
      net_amount_cents,
      tax_amount_cents,
      currency,
      description,
      payment_status,
      document_status,
      is_cash_effective,
      is_tax_relevant,
      is_interest,
      is_principal,
      is_capitalizable,
      is_deductible,
      is_recoverable,
      tax_year,
      notes,
      created_by
    )
    values (
      p_organization_id,
      v_property_id,
      v_unit_id,
      v_category_id,
      v_entry_date,
      v_service_date,
      v_gross_amount_cents,
      v_net_amount_cents,
      v_tax_amount_cents,
      v_currency,
      v_description,
      v_payment_status,
      'complete',
      v_is_cash_effective,
      v_is_tax_relevant,
      v_is_interest,
      v_is_principal,
      v_is_capitalizable,
      v_is_deductible,
      v_is_recoverable,
      extract(year from v_entry_date)::integer,
      v_notes,
      v_user_id
    )
    returning id into v_expense_id;
  else
    update public.expense_entries
       set property_id = v_property_id,
           unit_id = v_unit_id,
           category_id = v_category_id,
           entry_date = v_entry_date,
           service_date = v_service_date,
           amount_cents = v_gross_amount_cents,
           net_amount_cents = v_net_amount_cents,
           tax_amount_cents = v_tax_amount_cents,
           currency = v_currency,
           description = v_description,
           payment_status = v_payment_status,
           document_status = 'complete',
           is_cash_effective = v_is_cash_effective,
           is_tax_relevant = v_is_tax_relevant,
           is_interest = v_is_interest,
           is_principal = v_is_principal,
           is_capitalizable = v_is_capitalizable,
           is_deductible = v_is_deductible,
           is_recoverable = v_is_recoverable,
           tax_year = extract(year from v_entry_date)::integer,
           notes = v_notes
     where id = v_expense_id
       and organization_id = p_organization_id;
  end if;

  update public.documents
     set property_id = v_property_id,
         unit_id = v_unit_id,
         lease_id = v_lease_id,
         document_type = v_document_type,
         title = v_title,
         document_date = coalesce(v_invoice_date, v_entry_date),
         review_status = 'reviewed',
         payment_status = v_payment_status,
         tenant_visible = v_tenant_visible,
         ocr_status = 'succeeded'
   where id = p_document_id
     and organization_id = p_organization_id;

  delete from public.document_links
   where organization_id = p_organization_id
     and document_id = p_document_id
     and link_type in (
       'document_review_property',
       'document_review_unit',
       'document_review_lease',
       'expense_receipt'
     );

  insert into public.document_links (
    organization_id,
    document_id,
    property_id,
    link_type,
    tenant_visible,
    created_by
  )
  values (
    p_organization_id,
    p_document_id,
    v_property_id,
    'document_review_property',
    false,
    v_user_id
  );

  if v_unit_id is not null then
    insert into public.document_links (
      organization_id,
      document_id,
      unit_id,
      link_type,
      tenant_visible,
      created_by
    )
    values (
      p_organization_id,
      p_document_id,
      v_unit_id,
      'document_review_unit',
      false,
      v_user_id
    );
  end if;

  if v_lease_id is not null then
    insert into public.document_links (
      organization_id,
      document_id,
      lease_id,
      link_type,
      tenant_visible,
      created_by
    )
    values (
      p_organization_id,
      p_document_id,
      v_lease_id,
      'document_review_lease',
      v_tenant_visible,
      v_user_id
    );
  end if;

  insert into public.document_links (
    organization_id,
    document_id,
    expense_entry_id,
    link_type,
    tenant_visible,
    created_by
  )
  values (
    p_organization_id,
    p_document_id,
    v_expense_id,
    'expense_receipt',
    false,
    v_user_id
  );

  return v_expense_id;
end
$$;

revoke all on function public.review_document_expense(uuid, uuid, jsonb)
  from public, anon;
grant execute on function public.review_document_expense(uuid, uuid, jsonb)
  to authenticated, service_role;

comment on function public.review_document_expense(uuid, uuid, jsonb) is
  'Atomically confirms a manual extraction, prepares its expense, rebuilds workflow links, and records reviewed document status.';
