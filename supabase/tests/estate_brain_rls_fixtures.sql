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

do $valuation_projection_fixture$
begin
  perform public.create_valuation(
    '20000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    date '2025-12-31',
    10000000,
    'manual',
    'Fixture valuation 2025'
  );

  perform public.create_valuation(
    '20000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    date '2026-06-30',
    12000000,
    'appraisal',
    'Fixture valuation 2026'
  );

  -- A historical value belongs in the timeline but must not replace the
  -- current KPI projection.
  perform public.create_valuation(
    '20000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    date '2024-12-31',
    9000000,
    'manual',
    'Backdated fixture valuation'
  );

  if (
    select count(*)
      from public.valuations
     where property_id = '40000000-0000-0000-0000-000000000001'
  ) <> 3
     or (
       select current_market_value_cents
         from public.properties
        where id = '40000000-0000-0000-0000-000000000001'
     ) <> 12000000 then
    raise exception 'Valuation history and property KPI projection diverged';
  end if;

  insert into public.valuations (
    id,
    organization_id,
    property_id,
    valued_on,
    market_value_cents,
    source_type,
    source_name,
    created_by
  )
  values (
    '8d000000-0000-0000-0000-000000000001',
    '20000000-0000-0000-0000-000000000001',
    '40000000-0000-0000-0000-000000000001',
    date '2026-12-31',
    13000000,
    'manual',
    'Direct projection fixture',
    '10000000-0000-0000-0000-000000000001'
  );

  update public.valuations
     set market_value_cents = 14000000
   where id = '8d000000-0000-0000-0000-000000000001';

  if (
    select current_market_value_cents
      from public.properties
     where id = '40000000-0000-0000-0000-000000000001'
  ) <> 14000000 then
    raise exception 'Direct valuation mutation did not refresh projection';
  end if;

  begin
    update public.properties
       set current_market_value_cents = 1
     where id = '40000000-0000-0000-0000-000000000001';
    raise exception 'Property market-value projection was directly forged';
  exception
    when check_violation then null;
  end;

  delete from public.valuations
   where id = '8d000000-0000-0000-0000-000000000001';

  if (
    select current_market_value_cents
      from public.properties
     where id = '40000000-0000-0000-0000-000000000001'
  ) <> 12000000 then
    raise exception 'Valuation deletion did not restore latest projection';
  end if;

  begin
    perform public.create_valuation(
      '20000000-0000-0000-0000-000000000002',
      '40000000-0000-0000-0000-000000000002',
      date '2026-06-30',
      99900000,
      'manual',
      'Forbidden cross-organization valuation'
    );
    raise exception 'Cross-organization valuation was accepted';
  exception
    when no_data_found then null;
  end;
end
$valuation_projection_fixture$;

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

do $tenant_portal_atomicity_fixture$
declare
  v_conversation_id uuid;
  v_request_id uuid;
begin
  begin
    insert into public.conversations (
      organization_id,
      property_id,
      unit_id,
      lease_id,
      subject,
      is_internal,
      created_by
    )
    values (
      '20000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000001',
      '50000000-0000-0000-0000-000000000001',
      '70000000-0000-0000-0000-000000000001',
      'Unzulässige direkte Unterhaltung',
      false,
      '10000000-0000-0000-0000-000000000003'
    );
    raise exception 'Tenant directly created a conversation';
  exception
    when insufficient_privilege then null;
  end;

  v_conversation_id := public.create_tenant_portal_conversation(
    '20000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000001',
    'Atomare Unterhaltung',
    'general',
    'Erste atomare Nachricht'
  );

  if (
    select count(*)
      from public.conversation_participants
     where conversation_id = v_conversation_id
  ) <> 1
     or (
       select count(*)
         from public.messages
        where conversation_id = v_conversation_id
     ) <> 1 then
    raise exception 'Tenant conversation RPC did not create its linked rows';
  end if;

  begin
    insert into public.messages (
      organization_id,
      conversation_id,
      author_tenant_id,
      body,
      is_internal_note,
      created_by
    )
    values (
      '20000000-0000-0000-0000-000000000001',
      v_conversation_id,
      '60000000-0000-0000-0000-000000000001',
      'Unzulässige direkte Antwort',
      false,
      '10000000-0000-0000-0000-000000000003'
    );
    raise exception 'Tenant directly inserted a message';
  exception
    when insufficient_privilege then null;
  end;

  perform public.reply_tenant_portal_conversation(
    '20000000-0000-0000-0000-000000000001',
    v_conversation_id,
    'Atomare Antwort'
  );

  if (
    select count(*)
      from public.messages
     where conversation_id = v_conversation_id
  ) <> 2
     or (
       select status
         from public.conversations
        where id = v_conversation_id
     ) <> 'waiting_team' then
    raise exception 'Tenant reply RPC did not update atomically';
  end if;

  begin
    insert into public.maintenance_requests (
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
      '20000000-0000-0000-0000-000000000001',
      '40000000-0000-0000-0000-000000000001',
      '50000000-0000-0000-0000-000000000001',
      '70000000-0000-0000-0000-000000000001',
      '60000000-0000-0000-0000-000000000001',
      'Unzulässiges direktes Anliegen',
      'Dieses Anliegen darf nicht ohne Aufgabe entstehen.',
      '10000000-0000-0000-0000-000000000003'
    );
    raise exception 'Tenant directly created a maintenance request';
  exception
    when insufficient_privilege then null;
  end;

  v_request_id := public.create_tenant_portal_maintenance_request(
    '20000000-0000-0000-0000-000000000001',
    '70000000-0000-0000-0000-000000000001',
    'Atomares Anliegen',
    'Dieses Anliegen erzeugt seine Aufgabe gemeinsam.',
    'repair'
  );

  perform set_config(
    'estate_brain.tenant_portal_request_id',
    v_request_id::text,
    true
  );
end
$tenant_portal_atomicity_fixture$;

reset role;

do $tenant_portal_task_fixture$
begin
  if (
    select count(*)
      from public.tasks
     where maintenance_request_id =
       current_setting('estate_brain.tenant_portal_request_id')::uuid
  ) <> 1 then
    raise exception 'Tenant maintenance RPC omitted its linked staff task';
  end if;
end
$tenant_portal_task_fixture$;

update public.lease_tenants
   set occupancy_ends_on = current_date - 1
 where lease_id = '70000000-0000-0000-0000-000000000001'
   and tenant_id = '60000000-0000-0000-0000-000000000001';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);

do $tenant_portal_history_fixture$
begin
  if (
    select count(*)
      from public.get_tenant_portal_context(
        '20000000-0000-0000-0000-000000000001'
      )
  ) <> 1 then
    raise exception 'Tenant portal hides completed occupancy history';
  end if;
end
$tenant_portal_history_fixture$;

reset role;

update public.lease_tenants
   set occupancy_ends_on = null
 where lease_id = '70000000-0000-0000-0000-000000000001'
   and tenant_id = '60000000-0000-0000-0000-000000000001';

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

-- Organization deletion is a prepared, owner-only, atomic workflow. The
-- browser-facing role cannot hard-delete an organization or forge request
-- rows, while repeated request/cancel calls stay idempotent.
set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

do $organization_deletion_owner_fixture$
declare
  v_request_id uuid;
  v_repeated_request_id uuid;
  v_second_request_id uuid;
begin
  begin
    delete from public.organizations
     where id = '20000000-0000-0000-0000-000000000001';
    raise exception 'Owner hard-deleted an organization through the Data API';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.request_organization_deletion(
      '20000000-0000-0000-0000-000000000001',
      'Wrong organization name'
    );
    raise exception 'Organization deletion accepted an incorrect name';
  exception
    when insufficient_privilege then null;
  end;

  begin
    perform public.request_organization_deletion(
      '20000000-0000-0000-0000-000000000002',
      'Fixture Organisation B'
    );
    raise exception 'Owner requested deletion of another organization';
  exception
    when insufficient_privilege then null;
  end;

  v_request_id := public.request_organization_deletion(
    '20000000-0000-0000-0000-000000000001',
    'Fixture Organisation A'
  );
  v_repeated_request_id := public.request_organization_deletion(
    '20000000-0000-0000-0000-000000000001',
    'Fixture Organisation A'
  );

  if v_repeated_request_id <> v_request_id
     or (
       select count(*)
       from public.organization_deletion_requests
       where organization_id =
         '20000000-0000-0000-0000-000000000001'
         and status = 'requested'
     ) <> 1
     or (
       select count(*)
       from public.tasks
       where organization_id =
         '20000000-0000-0000-0000-000000000001'
         and category =
           'privacy_organization_deletion:' || v_request_id::text
     ) <> 1 then
    raise exception 'Organization deletion request was not idempotent';
  end if;

  begin
    insert into public.organization_deletion_requests (
      organization_id,
      requested_by,
      created_by
    )
    values (
      '20000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000001'
    );
    raise exception 'Owner forged a direct organization deletion request';
  exception
    when insufficient_privilege then null;
  end;

  if not public.cancel_organization_deletion(
    '20000000-0000-0000-0000-000000000001',
    v_request_id
  )
     or not public.cancel_organization_deletion(
       '20000000-0000-0000-0000-000000000001',
       v_request_id
     ) then
    raise exception 'Organization deletion cancellation was not idempotent';
  end if;

  if not exists (
    select 1
    from public.organization_deletion_requests
    where id = v_request_id
      and status = 'cancelled'
      and cancelled_by =
        '10000000-0000-0000-0000-000000000001'
      and cancelled_at is not null
  )
  or not exists (
    select 1
    from public.tasks
    where organization_id =
      '20000000-0000-0000-0000-000000000001'
      and category =
        'privacy_organization_deletion:' || v_request_id::text
      and status = 'cancelled'
  ) then
    raise exception 'Cancellation did not atomically update request and task';
  end if;

  v_second_request_id := public.request_organization_deletion(
    '20000000-0000-0000-0000-000000000001',
    'Fixture Organisation A'
  );

  if v_second_request_id = v_request_id
     or not exists (
       select 1
       from public.organization_deletion_requests
       where id = v_second_request_id
         and status = 'requested'
     )
     or not exists (
       select 1
       from public.tasks
       where organization_id =
         '20000000-0000-0000-0000-000000000001'
         and category =
           'privacy_organization_deletion:' || v_second_request_id::text
         and status = 'open'
     )
     or not exists (
       select 1
       from public.audit_logs
       where organization_id =
         '20000000-0000-0000-0000-000000000001'
         and entity_type = 'organization_deletion_requests'
         and entity_id in (v_request_id, v_second_request_id)
  ) then
    raise exception 'A new audited request was not created after cancellation';
  end if;

  if public.cancel_organization_deletion(
       '20000000-0000-0000-0000-000000000001',
       v_request_id
     ) then
    raise exception 'A stale cancellation hid a newer active request';
  end if;
end
$organization_deletion_owner_fixture$;

reset role;

delete from public.tasks as task_row
using public.organization_deletion_requests as request_row
where request_row.organization_id =
      '20000000-0000-0000-0000-000000000001'
  and request_row.status = 'requested'
  and task_row.organization_id = request_row.organization_id
  and task_row.category =
      'privacy_organization_deletion:' || request_row.id::text;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

do $organization_deletion_task_repair_fixture$
declare
  v_request_id uuid;
  v_returned_request_id uuid;
  v_task_count integer;
begin
  select id
    into v_request_id
    from public.organization_deletion_requests
   where organization_id =
       '20000000-0000-0000-0000-000000000001'
     and status = 'requested';

  v_returned_request_id := public.request_organization_deletion(
    '20000000-0000-0000-0000-000000000001',
    'Fixture Organisation A'
  );
  select count(*)
    into v_task_count
    from public.tasks
   where organization_id =
     '20000000-0000-0000-0000-000000000001'
     and category =
       'privacy_organization_deletion:' || v_request_id::text
     and status = 'open';

  if v_returned_request_id is distinct from v_request_id
     or v_task_count <> 1 then
    raise exception
      'Repeated request did not repair its missing task (expected %, returned %, tasks %)',
      v_request_id,
      v_returned_request_id,
      v_task_count;
  end if;
end
$organization_deletion_task_repair_fixture$;

reset role;

update public.organization_members
   set role = 'admin'
 where organization_id =
       '20000000-0000-0000-0000-000000000001'
   and user_id = '10000000-0000-0000-0000-000000000004';

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);

do $organization_deletion_admin_fixture$
declare
  v_changed integer;
begin
  if (select count(*) from public.organization_deletion_requests) <> 0 then
    raise exception 'Administrator can read owner-only deletion requests';
  end if;

  begin
    perform public.request_organization_deletion(
      '20000000-0000-0000-0000-000000000001',
      'Fixture Organisation A'
    );
    raise exception 'Administrator requested an organization deletion';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.organization_deletion_requests (
      organization_id,
      requested_by,
      created_by
    )
    values (
      '20000000-0000-0000-0000-000000000001',
      '10000000-0000-0000-0000-000000000004',
      '10000000-0000-0000-0000-000000000004'
    );
    raise exception 'Administrator forged a deletion request';
  exception
    when insufficient_privilege then null;
  end;

  update public.tasks
     set status = 'done',
         completed_at = now()
   where category like 'privacy_organization_deletion:%';
  get diagnostics v_changed = row_count;
  if v_changed <> 0 then
    raise exception 'Administrator changed a reserved deletion-review task';
  end if;

  delete from public.tasks
   where category like 'privacy_organization_deletion:%';
  get diagnostics v_changed = row_count;
  if v_changed <> 0 then
    raise exception 'Administrator deleted a reserved deletion-review task';
  end if;

  begin
    insert into public.tasks (
      organization_id,
      title,
      category,
      priority,
      status,
      created_by
    )
    values (
      '20000000-0000-0000-0000-000000000001',
      'Forged deletion task',
      'privacy_organization_deletion:00000000-0000-0000-0000-000000000000',
      'urgent',
      'open',
      '10000000-0000-0000-0000-000000000004'
    );
    raise exception 'Administrator inserted a reserved deletion-review task';
  exception
    when insufficient_privilege then null;
  end;

  if (
    select count(*)
    from public.tasks
    where category like 'privacy_organization_deletion:%'
      and status = 'open'
  ) <> 1 then
    raise exception 'Reserved deletion-review task integrity changed';
  end if;
end
$organization_deletion_admin_fixture$;

reset role;

-- Audit evidence remains immutable to callers, while declared FK redaction
-- must still allow an organization and its owner account to be deleted.
insert into public.audit_logs (
  id,
  organization_id,
  actor_user_id,
  actor_role,
  action,
  entity_type,
  entity_id
)
values (
  '90000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  '10000000-0000-0000-0000-000000000002',
  'owner',
  'release_fixture',
  'organizations',
  '20000000-0000-0000-0000-000000000002'
);

do $audit_append_only_fixture$
begin
  begin
    update public.audit_logs
       set organization_id = null
     where id = '90000000-0000-0000-0000-000000000001';
    raise exception 'Direct audit organization redaction was accepted';
  exception
    when sqlstate '55000' then null;
  end;

  begin
    update public.audit_logs
       set actor_user_id = null
     where id = '90000000-0000-0000-0000-000000000001';
    raise exception 'Direct audit actor redaction was accepted';
  exception
    when sqlstate '55000' then null;
  end;

  begin
    update public.audit_logs
       set organization_id = '20000000-0000-0000-0000-000000000001'
     where id = '90000000-0000-0000-0000-000000000001';
    raise exception 'Direct audit organization replacement was accepted';
  exception
    when sqlstate '55000' then null;
  end;

  begin
    update public.audit_logs
       set action = 'forged'
     where id = '90000000-0000-0000-0000-000000000001';
    raise exception 'Direct audit UPDATE was accepted';
  exception
    when sqlstate '55000' then null;
  end;

  begin
    delete from public.audit_logs
     where id = '90000000-0000-0000-0000-000000000001';
    raise exception 'Direct audit DELETE was accepted';
  exception
    when sqlstate '55000' then null;
  end;
end
$audit_append_only_fixture$;

do $audit_fk_redaction_fixture$
begin
  delete from public.organizations
   where id = '20000000-0000-0000-0000-000000000002';

  if exists (
    select 1
    from public.audit_logs
    where id = '90000000-0000-0000-0000-000000000001'
      and organization_id is not null
  ) then
    raise exception 'Organization FK was not redacted from the audit trail';
  end if;

  delete from auth.users
   where id = '10000000-0000-0000-0000-000000000002';

  if exists (
    select 1
    from public.audit_logs
    where id = '90000000-0000-0000-0000-000000000001'
      and actor_user_id is not null
  ) then
    raise exception 'Actor FK was not redacted from the audit trail';
  end if;
end
$audit_fk_redaction_fixture$;

-- A removed non-owner must be anonymized on surviving business records.
-- Direct attribution changes and direct snapshot mutation remain forbidden.
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);

insert into public.tasks (
  id,
  organization_id,
  property_id,
  title,
  created_by,
  updated_at
)
values (
  '91000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  'Attribution retention fixture',
  '10000000-0000-0000-0000-000000000004',
  timestamptz '2001-01-01 00:00:00+00'
);

insert into public.tax_years (
  id,
  organization_id,
  year,
  status,
  locked_at,
  locked_by,
  created_by,
  updated_at
)
values (
  '92000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  2098,
  'locked',
  now(),
  '10000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000004',
  timestamptz '2001-01-01 00:00:00+00'
);

insert into public.tax_calculation_snapshots (
  id,
  organization_id,
  tax_year_id,
  property_id,
  calculated_for_user_id,
  period_start,
  period_end,
  calculation_input,
  calculation_version,
  disclaimer,
  created_by,
  updated_at
)
values (
  '93000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000004',
  date '2098-01-01',
  date '2098-12-31',
  '{}'::jsonb,
  'fixture-v1',
  'Nur ein Regressionstest.',
  '10000000-0000-0000-0000-000000000004',
  timestamptz '2001-01-01 00:00:00+00'
);

insert into public.conversations (
  id,
  organization_id,
  property_id,
  subject,
  created_by,
  updated_at
)
values (
  '94000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  'Attribution fixture',
  '10000000-0000-0000-0000-000000000004',
  timestamptz '2001-01-01 00:00:00+00'
);

insert into public.messages (
  id,
  organization_id,
  conversation_id,
  author_user_id,
  body,
  created_by,
  updated_at
)
values (
  '95000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '94000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000004',
  'Retained staff message',
  '10000000-0000-0000-0000-000000000004',
  timestamptz '2001-01-01 00:00:00+00'
);

insert into public.comments (
  id,
  organization_id,
  task_id,
  author_user_id,
  body,
  created_by,
  updated_at
)
values (
  '96000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '91000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000004',
  'Retained staff comment',
  '10000000-0000-0000-0000-000000000004',
  timestamptz '2001-01-01 00:00:00+00'
);

insert into public.invitations (
  id,
  organization_id,
  email,
  role,
  token_hash,
  status,
  expires_at,
  invited_by,
  accepted_by,
  accepted_at,
  created_by,
  updated_at
)
values (
  '99000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'retained-invite@estatebrain.test',
  'employee',
  extensions.digest(
    convert_to('retained-invitation-fixture', 'UTF8'),
    'sha256'
  ),
  'accepted',
  now() + interval '7 days',
  '10000000-0000-0000-0000-000000000004',
  '10000000-0000-0000-0000-000000000004',
  now(),
  '10000000-0000-0000-0000-000000000004',
  timestamptz '2001-01-01 00:00:00+00'
);

insert into public.optimization_insights (
  id,
  organization_id,
  property_id,
  insight_type,
  title,
  explanation,
  status,
  dismissed_by,
  dismissed_at,
  created_by,
  updated_at
)
values (
  '9a000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  'fixture',
  'Retained insight',
  'The actor may be anonymized without changing the decision.',
  'dismissed',
  '10000000-0000-0000-0000-000000000004',
  now(),
  '10000000-0000-0000-0000-000000000004',
  timestamptz '2001-01-01 00:00:00+00'
);

insert into public.tax_years (
  id,
  organization_id,
  year,
  created_by
)
values (
  '92000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000001',
  2097,
  '10000000-0000-0000-0000-000000000004'
);

do $identity_mutation_fixture$
begin
  begin
    update public.tasks
       set created_by = null
     where id = '91000000-0000-0000-0000-000000000001';
    raise exception 'Direct created_by redaction was accepted';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.tax_calculation_snapshots
       set calculated_for_user_id = null
     where id = '93000000-0000-0000-0000-000000000001';
    raise exception 'Direct snapshot identity mutation was accepted';
  exception
    when sqlstate '55000' then null;
  end;

  begin
    delete from public.tax_calculation_snapshots
     where id = '93000000-0000-0000-0000-000000000001';
    raise exception 'Direct snapshot deletion was accepted';
  exception
    when sqlstate '55000' then null;
  end;

  begin
    update public.messages
       set author_user_id = null
     where id = '95000000-0000-0000-0000-000000000001';
    raise exception 'Direct message author redaction was accepted';
  exception
    when insufficient_privilege then null;
  end;

  begin
    insert into public.messages (
      organization_id,
      conversation_id,
      body,
      created_by
    )
    values (
      '20000000-0000-0000-0000-000000000001',
      '94000000-0000-0000-0000-000000000001',
      'Missing author',
      '10000000-0000-0000-0000-000000000004'
    );
    raise exception 'Authorless message insert was accepted';
  exception
    when check_violation then null;
  end;

  begin
    update public.invitations
       set accepted_by = null
     where id = '99000000-0000-0000-0000-000000000001';
    raise exception 'Direct accepted_by redaction was accepted';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.invitations
       set invited_by = null
     where id = '99000000-0000-0000-0000-000000000001';
    raise exception 'Direct invited_by redaction was accepted';
  exception
    when insufficient_privilege then null;
  end;

  begin
    update public.tax_years
       set status = 'locked',
           locked_at = now(),
           locked_by = '10000000-0000-0000-0000-000000000003'
     where id = '92000000-0000-0000-0000-000000000003';
    raise exception 'Action actor spoofing was accepted';
  exception
    when check_violation then null;
  end;
end
$identity_mutation_fixture$;

select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

delete from auth.users
 where id = '10000000-0000-0000-0000-000000000004';

do $identity_redaction_fixture$
begin
  if (
    select created_by
    from public.tasks
    where id = '91000000-0000-0000-0000-000000000001'
  ) is not null then
    raise exception 'Task attribution was not redacted';
  end if;

  if exists (
    select 1
    from public.tax_calculation_snapshots
    where id = '93000000-0000-0000-0000-000000000001'
      and (
        calculated_for_user_id is not null
        or created_by is not null
      )
  ) then
    raise exception 'Snapshot attribution was not redacted';
  end if;

  if not exists (
    select 1
    from public.messages
    where id = '95000000-0000-0000-0000-000000000001'
      and author_user_id is null
      and created_by is null
      and body = 'Retained staff message'
      and updated_at = timestamptz '2001-01-01 00:00:00+00'
  ) then
    raise exception 'Staff message attribution was not safely redacted';
  end if;

  if not exists (
    select 1
    from public.comments
    where id = '96000000-0000-0000-0000-000000000001'
      and author_user_id is null
      and created_by is null
      and body = 'Retained staff comment'
      and updated_at = timestamptz '2001-01-01 00:00:00+00'
  ) then
    raise exception 'Staff comment attribution was not safely redacted';
  end if;

  if not exists (
    select 1
    from public.invitations
    where id = '99000000-0000-0000-0000-000000000001'
      and invited_by is null
      and accepted_by is null
      and created_by is null
      and status = 'accepted'
      and accepted_at is not null
      and updated_at = timestamptz '2001-01-01 00:00:00+00'
  ) then
    raise exception 'Invitation attribution was not safely redacted';
  end if;

  if not exists (
    select 1
    from public.tax_years
    where id = '92000000-0000-0000-0000-000000000001'
      and status = 'locked'
      and locked_at is not null
      and locked_by is null
      and created_by is null
      and updated_at = timestamptz '2001-01-01 00:00:00+00'
  ) then
    raise exception 'Tax-year action attribution was not safely redacted';
  end if;

  if not exists (
    select 1
    from public.optimization_insights
    where id = '9a000000-0000-0000-0000-000000000001'
      and status = 'dismissed'
      and dismissed_at is not null
      and dismissed_by is null
      and created_by is null
      and updated_at = timestamptz '2001-01-01 00:00:00+00'
  ) then
    raise exception 'Insight action attribution was not safely redacted';
  end if;

  if not exists (
    select 1
    from public.tasks
    where id = '91000000-0000-0000-0000-000000000001'
      and updated_at = timestamptz '2001-01-01 00:00:00+00'
  ) then
    raise exception 'Pure identity redaction changed business timestamps';
  end if;
end
$identity_redaction_fixture$;

insert into public.tax_years (
  id,
  organization_id,
  year,
  created_by
)
values (
  '92000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000001',
  2099,
  '10000000-0000-0000-0000-000000000001'
);

insert into public.tax_calculation_snapshots (
  id,
  organization_id,
  tax_year_id,
  property_id,
  calculated_for_user_id,
  period_start,
  period_end,
  calculation_input,
  calculation_version,
  disclaimer,
  created_by
)
values (
  '93000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000001',
  '92000000-0000-0000-0000-000000000002',
  '40000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  date '2099-01-01',
  date '2099-12-31',
  '{}'::jsonb,
  'fixture-v1',
  'Nur ein Regressionstest.',
  '10000000-0000-0000-0000-000000000001'
);

delete from public.tax_years
 where id = '92000000-0000-0000-0000-000000000002';

do $snapshot_cascade_fixture$
begin
  if exists (
    select 1
    from public.tax_calculation_snapshots
    where id = '93000000-0000-0000-0000-000000000002'
  ) then
    raise exception 'Snapshot parent cascade was blocked';
  end if;
end
$snapshot_cascade_fixture$;

insert into public.documents (
  id,
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
  '98000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  '70000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001/98000000-0000-0000-0000-000000000001/contract.pdf',
  'contract.pdf',
  'application/pdf',
  100,
  true,
  '10000000-0000-0000-0000-000000000001'
);

do $document_direct_redaction_fixture$
begin
  begin
    update public.documents
       set lease_id = null
     where id = '98000000-0000-0000-0000-000000000001';
    raise exception 'Direct document lease redaction was accepted';
  exception
    when check_violation then null;
  end;
end
$document_direct_redaction_fixture$;

delete from public.leases
 where id = '70000000-0000-0000-0000-000000000001';

do $document_parent_redaction_fixture$
begin
  if not exists (
    select 1
    from public.documents
    where id = '98000000-0000-0000-0000-000000000001'
      and lease_id is null
      and not tenant_visible
      and property_id = '40000000-0000-0000-0000-000000000001'
      and unit_id = '50000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'Lease deletion left document metadata inconsistent';
  end if;
end
$document_parent_redaction_fixture$;

insert into public.tenants (
  id,
  organization_id,
  first_name,
  last_name,
  created_by
)
values (
  '97000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  'Disposable',
  'Author',
  '10000000-0000-0000-0000-000000000001'
);

insert into public.messages (
  id,
  organization_id,
  conversation_id,
  author_tenant_id,
  body,
  created_by,
  updated_at
)
values (
  '95000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000001',
  '94000000-0000-0000-0000-000000000001',
  '97000000-0000-0000-0000-000000000001',
  'Retained tenant message',
  '10000000-0000-0000-0000-000000000001',
  timestamptz '2002-01-01 00:00:00+00'
);

delete from public.tenants
 where id = '97000000-0000-0000-0000-000000000001';

do $tenant_author_redaction_fixture$
begin
  if not exists (
    select 1
    from public.messages
    where id = '95000000-0000-0000-0000-000000000002'
      and author_tenant_id is null
      and author_user_id is null
      and body = 'Retained tenant message'
      and updated_at = timestamptz '2002-01-01 00:00:00+00'
  ) then
    raise exception 'Tenant author attribution was not safely redacted';
  end if;
end
$tenant_author_redaction_fixture$;

-- A cancelled historical claim must protect direct payment edits without
-- blocking the explicit organization-wide cascade workflow.
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
  '5f000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  'Cascade-Zahlung',
  40,
  1,
  'rented',
  '10000000-0000-0000-0000-000000000001'
);

insert into public.leases (
  id,
  organization_id,
  unit_id,
  starts_on,
  cold_rent_cents,
  status,
  created_by
)
values (
  '7f000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '5f000000-0000-0000-0000-000000000001',
  date '2025-01-01',
  50000,
  'ended',
  '10000000-0000-0000-0000-000000000001'
);

insert into public.rent_claims (
  id,
  organization_id,
  lease_id,
  claim_month,
  due_date,
  cold_rent_cents,
  created_by
)
values (
  '8f000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '7f000000-0000-0000-0000-000000000001',
  date '2025-01-01',
  date '2025-01-03',
  50000,
  '10000000-0000-0000-0000-000000000001'
);

insert into public.rent_payments (
  id,
  organization_id,
  rent_claim_id,
  paid_on,
  amount_cents,
  allocation_status,
  created_by
)
values (
  '8e000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  '8f000000-0000-0000-0000-000000000001',
  date '2025-01-03',
  50000,
  'confirmed',
  '10000000-0000-0000-0000-000000000001'
);

update public.rent_claims
   set status = 'cancelled'
 where id = '8f000000-0000-0000-0000-000000000001';

do $cancelled_claim_payment_fixture$
begin
  begin
    delete from public.rent_payments
     where id = '8e000000-0000-0000-0000-000000000001';
    raise exception 'Cancelled-claim payment was directly deleted';
  exception
    when check_violation then null;
  end;
end
$cancelled_claim_payment_fixture$;

-- Keep a second tenant author linked until the organization itself is
-- deleted. This exercises nested organization -> tenant -> SET NULL actions
-- before the organization-scoped message/comment rows are cascaded.
insert into public.tenants (
  id,
  organization_id,
  first_name,
  last_name,
  created_by
)
values (
  '97000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000001',
  'Nested',
  'Author',
  '10000000-0000-0000-0000-000000000001'
);

insert into public.messages (
  id,
  organization_id,
  conversation_id,
  author_tenant_id,
  body,
  created_by
)
values (
  '95000000-0000-0000-0000-000000000003',
  '20000000-0000-0000-0000-000000000001',
  '94000000-0000-0000-0000-000000000001',
  '97000000-0000-0000-0000-000000000002',
  'Nested tenant cascade message',
  '10000000-0000-0000-0000-000000000001'
);

insert into public.comments (
  id,
  organization_id,
  task_id,
  author_tenant_id,
  body,
  created_by
)
values (
  '96000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000001',
  '91000000-0000-0000-0000-000000000001',
  '97000000-0000-0000-0000-000000000002',
  'Nested tenant cascade comment',
  '10000000-0000-0000-0000-000000000001'
);

delete from public.organizations
 where id = '20000000-0000-0000-0000-000000000001';

do $organization_cascade_fixture$
begin
  if exists (
    select 1
    from public.tax_calculation_snapshots
    where id = '93000000-0000-0000-0000-000000000001'
  )
  or exists (
    select 1
    from public.documents
    where id = '98000000-0000-0000-0000-000000000001'
  )
  or exists (
    select 1
    from public.tasks
    where id = '91000000-0000-0000-0000-000000000001'
  )
  or exists (
    select 1
    from public.organization_deletion_requests
    where organization_id =
      '20000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'Organization cascade left scoped business rows';
  end if;
end
$organization_cascade_fixture$;

delete from auth.users
 where id = '10000000-0000-0000-0000-000000000001';

do $former_owner_delete_fixture$
begin
  if exists (
    select 1
    from auth.users
    where id = '10000000-0000-0000-0000-000000000001'
  ) then
    raise exception 'Former organization owner could not be deleted';
  end if;
end
$former_owner_delete_fixture$;

rollback;
