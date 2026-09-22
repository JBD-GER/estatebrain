-- Saved tax comparisons are organization-scoped planning data.
-- Tax readers may collaborate on scenarios without changing personal tax profiles.
begin;

create table public.investment_scenarios (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  input jsonb not null,
  selected_method text not null default 'linear' check (
    selected_method in ('linear', 'degressive', 'linear_7b', 'degressive_7b', 'heritage', 'owner_occupied')
  ),
  schema_version integer not null default 1 check (schema_version = 1),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint investment_scenarios_input_object check (jsonb_typeof(input) = 'object'),
  constraint investment_scenarios_input_size check (octet_length(input::text) <= 16384),
  constraint investment_scenarios_input_fields check (
    input ?& array[
      'purchasePriceCents', 'acquisitionCostsCents', 'landShareRate',
      'capitalizedMeasuresCents', 'completionDate', 'acquisitionDate',
      'usage', 'propertyKind', 'marginalTaxRate', 'years'
    ]
  )
);

create index investment_scenarios_organization_updated_idx
  on public.investment_scenarios (organization_id, updated_at desc);
create index investment_scenarios_created_by_idx
  on public.investment_scenarios (created_by);

create trigger enforce_organization_scope
  before insert or update on public.investment_scenarios
  for each row execute function private.enforce_organization_scope();
create trigger investment_scenarios_set_updated_at
  before update on public.investment_scenarios
  for each row execute function private.set_updated_at();

alter table public.investment_scenarios enable row level security;

create policy investment_scenarios_select
  on public.investment_scenarios for select to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin', 'accounting']::public.app_role[]));

create policy investment_scenarios_insert
  on public.investment_scenarios for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and private.has_org_role(organization_id, array['owner', 'admin', 'accounting']::public.app_role[])
  );

create policy investment_scenarios_update
  on public.investment_scenarios for update to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin', 'accounting']::public.app_role[]))
  with check (private.has_org_role(organization_id, array['owner', 'admin', 'accounting']::public.app_role[]));

create policy investment_scenarios_delete
  on public.investment_scenarios for delete to authenticated
  using (private.has_org_role(organization_id, array['owner', 'admin', 'accounting']::public.app_role[]));

revoke all on table public.investment_scenarios from public, anon, authenticated;
grant select, delete on table public.investment_scenarios to authenticated;
grant insert (organization_id, name, input, selected_method, schema_version, created_by)
  on table public.investment_scenarios to authenticated;
grant update (name, input, selected_method, schema_version)
  on table public.investment_scenarios to authenticated;
grant all on table public.investment_scenarios to service_role;

comment on table public.investment_scenarios is
  'Versioned inputs for investment tax estimates. No tax assessment or filed return.';

commit;
