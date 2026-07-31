-- Cross-organization and role-scope regression tests.
-- All fixtures are created inside this transaction and rolled back.

begin;

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000001',
    'authenticated',
    'authenticated',
    'owner-a@estatebrain.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000002',
    'authenticated',
    'authenticated',
    'owner-b@estatebrain.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000003',
    'authenticated',
    'authenticated',
    'tenant@estatebrain.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  ),
  (
    '00000000-0000-0000-0000-000000000000',
    '10000000-0000-0000-0000-000000000004',
    'authenticated',
    'authenticated',
    'employee@estatebrain.test',
    '',
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    now(),
    now()
  );

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

insert into public.organizations (
  id,
  name,
  kind,
  owner_user_id,
  created_by
)
values
  (
    '20000000-0000-0000-0000-000000000001',
    'Fixture Organisation A',
    'private_person',
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '20000000-0000-0000-0000-000000000002',
    'Fixture Organisation B',
    'private_person',
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000001'
  );

insert into public.organization_members (
  id,
  organization_id,
  user_id,
  role,
  status,
  is_property_restricted,
  joined_at,
  created_by
)
values
  (
    '30000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    'owner',
    'active',
    false,
    now(),
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '30000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    'owner',
    'active',
    false,
    now(),
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '30000000-0000-0000-0000-000000000003',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000003',
    'tenant',
    'active',
    false,
    now(),
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '30000000-0000-0000-0000-000000000004',
    '20000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000004',
    'employee',
    'active',
    true,
    now(),
    '10000000-0000-0000-0000-000000000001'
  );

insert into public.properties (
  id,
  organization_id,
  name,
  street,
  postal_code,
  city,
  created_by
)
values
  (
    '40000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    'Fixture Objekt A',
    'Teststraße 1',
    '10115',
    'Berlin',
    '10000000-0000-0000-0000-000000000001'
  ),
  (
    '40000000-0000-0000-0000-000000000002',
    '20000000-0000-0000-0000-000000000002',
    'Fixture Objekt B',
    'Fremdweg 2',
    '20095',
    'Hamburg',
    '10000000-0000-0000-0000-000000000001'
  );

insert into public.units (
  id,
  organization_id,
  property_id,
  unit_number,
  area_sqm,
  rooms,
  status,
  created_by
)
values (
  '50000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  'A-1',
  60,
  2,
  'rented',
  '10000000-0000-0000-0000-000000000001'
);

insert into public.tenants (
  id,
  organization_id,
  first_name,
  last_name,
  email,
  created_by
)
values (
  '60000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'Tina',
  'Tenant',
  'tenant@estatebrain.test',
  '10000000-0000-0000-0000-000000000001'
);

insert into public.tenant_users (
  organization_id,
  tenant_id,
  user_id,
  is_primary,
  verified_at,
  created_by
)
values (
  '20000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000003',
  true,
  now(),
  '10000000-0000-0000-0000-000000000001'
);

insert into public.leases (
  id,
  organization_id,
  unit_id,
  starts_on,
  cold_rent_cents,
  ancillary_prepayment_cents,
  status,
  created_by
)
values (
  '70000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  current_date - 30,
  80000,
  20000,
  'active',
  '10000000-0000-0000-0000-000000000001'
);

insert into public.lease_tenants (
  organization_id,
  lease_id,
  tenant_id,
  is_primary,
  occupancy_starts_on,
  created_by
)
values (
  '20000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001',
  true,
  current_date - 30,
  '10000000-0000-0000-0000-000000000001'
);

insert into public.maintenance_requests (
  id,
  organization_id,
  property_id,
  unit_id,
  lease_id,
  tenant_id,
  title,
  description,
  created_by
)
values (
  '80000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001',
  'Fixture Anliegen',
  'Nur für den eigenen Mieter sichtbar.',
  '10000000-0000-0000-0000-000000000001'
);

insert into public.tenant_internal_notes (
  organization_id,
  tenant_id,
  notes,
  created_by
)
values (
  '20000000-0000-0000-0000-000000000001',
  '60000000-0000-0000-0000-000000000001',
  'Vertrauliche Fixture-Notiz',
  '10000000-0000-0000-0000-000000000001'
);

insert into public.maintenance_request_internal_notes (
  organization_id,
  maintenance_request_id,
  notes,
  created_by
)
values (
  '20000000-0000-0000-0000-000000000001',
  '80000000-0000-0000-0000-000000000001',
  'Interne Fixture-Diagnose',
  '10000000-0000-0000-0000-000000000001'
);

-- Structural tenant boundary: direct SQL and service integrations must not be
-- able to forge cross-organization relationships or move an existing row.
insert into public.tenants (
  id,
  organization_id,
  first_name,
  last_name,
  created_by
)
values (
  '60000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000001',
  'Scope',
  'Fixture',
  '10000000-0000-0000-0000-000000000001'
);

do $organization_scope_fixture$
begin
  begin
    insert into public.property_assignments (
      organization_id,
      property_id,
      member_id,
      created_by
    )
    values (
      '20000000-0000-0000-0000-000000000002',
      '40000000-0000-0000-0000-000000000002',
      '30000000-0000-0000-0000-000000000004',
      '10000000-0000-0000-0000-000000000001'
    );
    raise exception 'Cross-organization member assignment was accepted';
  exception
    when foreign_key_violation then null;
  end;

  begin
    insert into public.tenant_internal_notes (
      organization_id,
      tenant_id,
      notes,
      created_by
    )
    values (
      '20000000-0000-0000-0000-000000000002',
      '60000000-0000-0000-0000-000000000002',
      'Darf keine Mandantengrenze überschreiten',
      '10000000-0000-0000-0000-000000000001'
    );
    raise exception 'Cross-organization tenant note was accepted';
  exception
    when foreign_key_violation then null;
  end;

  begin
    update public.properties
       set organization_id = '20000000-0000-0000-0000-000000000002'
     where id = '40000000-0000-0000-0000-000000000001';
    raise exception 'Existing property moved to another organization';
  exception
    when check_violation then null;
  end;

  if (
    select organization_id
    from public.properties
    where id = '40000000-0000-0000-0000-000000000001'
  ) <> '20000000-0000-0000-0000-000000000001'::uuid then
    raise exception 'Property scope changed despite the immutable invariant';
  end if;
end
$organization_scope_fixture$;

-- Owner A must not read organization B.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

do $test$
begin
  if (
    select count(*)
    from public.properties
    where organization_id = '20000000-0000-0000-0000-000000000002'
  ) <> 0 then
    raise exception 'Owner A can read organization B';
  end if;
end
$test$;

reset role;

-- Tenant can read their own portal scope, not properties or internal notes.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

do $test$
begin
  if (
    select count(*)
    from public.get_tenant_portal_context(
      '20000000-0000-0000-0000-000000000001'
    )
  ) <> 1 then
    raise exception 'Tenant portal projection is missing';
  end if;
  if (select count(*) from public.properties) <> 0 then
    raise exception 'Tenant can query property rows directly';
  end if;
  if (
    select count(*)
    from public.maintenance_requests
    where id = '80000000-0000-0000-0000-000000000001'
  ) <> 1 then
    raise exception 'Tenant cannot read their own maintenance request';
  end if;
  if (select count(*) from public.tenant_internal_notes) <> 0
     or (
       select count(*)
       from public.maintenance_request_internal_notes
     ) <> 0 then
    raise exception 'Tenant can read internal notes';
  end if;

  begin
    update public.tenants
       set status = 'inactive'
     where id = '60000000-0000-0000-0000-000000000001';
    raise exception 'Tenant changed a protected control field';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.documents (
      organization_id,
      property_id,
      unit_id,
      lease_id,
      storage_path,
      original_file_name,
      mime_type,
      size_bytes,
      tenant_visible,
      created_by
    )
    values (
      '20000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000001',
      '50000000-0000-0000-0000-000000000001',
      '70000000-0000-0000-0000-000000000001',
      '20000000-0000-0000-0000-000000000001/90000000-0000-0000-0000-000000000001/test.pdf',
      'test.pdf',
      'application/pdf',
      100,
      true,
      '10000000-0000-0000-0000-000000000003'
    );
    raise exception 'Tenant bypassed document write permission';
  exception
    when insufficient_privilege then null;
  end;
end
$test$;

reset role;

-- A restricted employee sees no property until explicitly assigned.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);

do $test$
begin
  if (select count(*) from public.properties) <> 0 then
    raise exception 'Restricted employee sees an unassigned property';
  end if;
end
$test$;

reset role;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

insert into public.property_assignments (
  organization_id,
  property_id,
  member_id,
  created_by
)
values (
  '20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '30000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000001'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);

do $test$
begin
  if (
    select count(*)
    from public.properties
    where id = '40000000-0000-0000-0000-000000000001'
  ) <> 1 then
    raise exception 'Assigned employee cannot read their property';
  end if;
  if (
    select count(*)
    from public.properties
    where id = '40000000-0000-0000-0000-000000000002'
  ) <> 0 then
    raise exception 'Employee can cross organization boundary';
  end if;
end
$test$;

reset role;
rollback;
