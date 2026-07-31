export type TenantLeaseWindow = {
  lease_status: string;
  lease_starts_on: string;
  lease_ends_on: string | null;
  occupancy_starts_on?: string | null;
  occupancy_ends_on?: string | null;
};

export function isCurrentTenantLease(
  lease: TenantLeaseWindow,
  today: string,
) {
  return (
    ["active", "notice_given"].includes(lease.lease_status) &&
    lease.lease_starts_on <= today &&
    (!lease.lease_ends_on || lease.lease_ends_on >= today) &&
    (!lease.occupancy_starts_on || lease.occupancy_starts_on <= today) &&
    (!lease.occupancy_ends_on || lease.occupancy_ends_on >= today)
  );
}
