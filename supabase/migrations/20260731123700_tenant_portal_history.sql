-- Tenant write RPCs remain restricted to a currently active occupancy. The
-- read projection may also return the tenant's completed occupancies so their
-- own historical payments, documents, and conversations remain accessible.

drop function if exists public.get_tenant_portal_context(uuid);

create or replace function public.get_tenant_portal_context(
  p_organization_id uuid
)
returns table (
  tenant_id uuid,
  lease_id uuid,
  unit_id uuid,
  property_id uuid,
  property_name text,
  property_street text,
  property_house_number text,
  property_postal_code text,
  property_city text,
  unit_number text,
  lease_starts_on date,
  lease_ends_on date,
  occupancy_starts_on date,
  occupancy_ends_on date,
  lease_status text,
  cold_rent_cents bigint,
  ancillary_prepayment_cents bigint,
  parking_rent_cents bigint,
  other_rent_cents bigint
)
language sql
stable
security definer
set search_path = pg_catalog
as $$
  with clock as (
    select (now() at time zone 'Europe/Berlin')::date as today
  )
  select
    tu.tenant_id,
    l.id,
    u.id,
    p.id,
    p.name,
    p.street,
    p.house_number,
    p.postal_code,
    p.city,
    u.unit_number,
    l.starts_on,
    l.ends_on,
    lt.occupancy_starts_on,
    lt.occupancy_ends_on,
    l.status,
    l.cold_rent_cents,
    l.ancillary_prepayment_cents,
    l.parking_rent_cents,
    l.other_rent_cents
  from public.organization_members as om
  cross join clock
  join public.tenant_users as tu
    on tu.organization_id = om.organization_id
   and tu.user_id = om.user_id
  join public.lease_tenants as lt
    on lt.organization_id = tu.organization_id
   and lt.tenant_id = tu.tenant_id
  join public.leases as l
    on l.organization_id = lt.organization_id
   and l.id = lt.lease_id
  join public.units as u
    on u.organization_id = l.organization_id
   and u.id = l.unit_id
  join public.properties as p
    on p.organization_id = u.organization_id
   and p.id = u.property_id
  where om.user_id = (select auth.uid())
    and om.organization_id = p_organization_id
    and om.status = 'active'
    and om.role = 'tenant'
    and l.archived_at is null
    and (
      lt.occupancy_starts_on is null
      or lt.occupancy_starts_on <= clock.today
    )
  order by
    case
      when l.status in ('active', 'notice_given')
       and l.starts_on <= clock.today
       and (l.ends_on is null or l.ends_on >= clock.today)
       and (
         lt.occupancy_ends_on is null
         or lt.occupancy_ends_on >= clock.today
       )
      then 0
      else 1
    end,
    l.starts_on desc,
    l.created_at desc
$$;

revoke all on function public.get_tenant_portal_context(uuid)
  from public, anon;
grant execute on function public.get_tenant_portal_context(uuid)
  to authenticated, service_role;

comment on function public.get_tenant_portal_context(uuid) is
  'Returns current and historical tenant-owned lease context in the selected organization; mutation RPCs independently require an active occupancy.';
