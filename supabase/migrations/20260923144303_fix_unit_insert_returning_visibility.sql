begin;

-- INSERT ... RETURNING also checks SELECT visibility. can_view_unit looks the
-- unit up through a STABLE function, whose statement snapshot cannot yet see
-- the inserted row. Check staff access using the row's existing parent instead;
-- keep the existing lease-based helper for tenant access.
alter policy units_select_scoped on public.units
  using (
    private.can_view_property(organization_id, property_id)
    or private.can_view_unit(organization_id, id)
  );

commit;
