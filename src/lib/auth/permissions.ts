export const organizationRoles = [
  "owner",
  "admin",
  "property_manager",
  "accounting",
  "employee",
  "tenant",
] as const;

export type OrganizationRole = (typeof organizationRoles)[number];

export type Permission =
  | "organization.manage"
  | "team.manage"
  | "tax.read"
  | "tax.manage"
  | "integrations.manage"
  | "portfolio.read"
  | "portfolio.write"
  | "bookkeeping.read"
  | "bookkeeping.write"
  | "bank.read"
  | "bank.reconcile"
  | "financing.read"
  | "financing.write"
  | "documents.read"
  | "documents.write"
  | "reports.export"
  | "tasks.write"
  | "messages.write"
  | "tenant.portal";

const permissionsByRole: Record<OrganizationRole, readonly Permission[]> = {
  owner: [
    "organization.manage",
    "team.manage",
    "tax.read",
    "tax.manage",
    "integrations.manage",
    "portfolio.read",
    "portfolio.write",
    "bookkeeping.read",
    "bookkeeping.write",
    "bank.read",
    "bank.reconcile",
    "financing.read",
    "financing.write",
    "documents.read",
    "documents.write",
    "reports.export",
    "tasks.write",
    "messages.write",
  ],
  admin: [
    "organization.manage",
    "team.manage",
    "tax.read",
    "tax.manage",
    "integrations.manage",
    "portfolio.read",
    "portfolio.write",
    "bookkeeping.read",
    "bookkeeping.write",
    "bank.read",
    "bank.reconcile",
    "financing.read",
    "financing.write",
    "documents.read",
    "documents.write",
    "reports.export",
    "tasks.write",
    "messages.write",
  ],
  property_manager: [
    "portfolio.read",
    "portfolio.write",
    "bookkeeping.read",
    "bookkeeping.write",
    "documents.read",
    "documents.write",
    "reports.export",
    "tasks.write",
    "messages.write",
  ],
  accounting: [
    "portfolio.read",
    "tax.read",
    "bookkeeping.read",
    "bookkeeping.write",
    "bank.read",
    "bank.reconcile",
    "financing.read",
    "financing.write",
    "documents.read",
    "documents.write",
    "reports.export",
  ],
  employee: [
    "portfolio.read",
    "documents.read",
    "documents.write",
    "tasks.write",
    "messages.write",
  ],
  tenant: ["documents.read", "messages.write", "tenant.portal"],
};

export function hasPermission(
  role: OrganizationRole,
  permission: Permission,
) {
  return permissionsByRole[role].includes(permission);
}

/**
 * Deleting an organization affects every member and all retained records.
 * Preparation of that operation is therefore reserved for the active owner,
 * matching the database's owner-only request workflow.
 */
export function canRequestOrganizationDeletion(role: OrganizationRole) {
  return role === "owner";
}

const moduleReadPermissions = {
  portfolio: "portfolio.read",
  immobilien: "portfolio.read",
  einheiten: "portfolio.read",
  mietverhaeltnisse: "portfolio.read",
  cashflow: "bookkeeping.read",
  einnahmen: "bookkeeping.read",
  ausgaben: "bookkeeping.read",
  belege: "documents.read",
  bank: "bank.read",
  finanzierungen: "financing.read",
  steuern: "tax.read",
  sanierungen: "portfolio.read",
  markt: "portfolio.read",
  potenziale: "bookkeeping.read",
  kommunikation: "messages.write",
  aufgaben: "tasks.write",
  berichte: "reports.export",
  team: "team.manage",
  integrationen: "integrations.manage",
  "daten-pruefen": "documents.read",
  einstellungen: "portfolio.read",
} as const satisfies Record<string, Permission>;

const moduleCreatePermissions = {
  immobilien: "portfolio.write",
  einheiten: "portfolio.write",
  einnahmen: "bookkeeping.write",
  ausgaben: "bookkeeping.write",
  belege: "documents.write",
  finanzierungen: "financing.write",
  sanierungen: "portfolio.write",
  markt: "portfolio.write",
  kommunikation: "messages.write",
  aufgaben: "tasks.write",
} as const satisfies Record<string, Permission>;

function modulePermission(
  contract: Record<string, Permission>,
  slug: string,
) {
  return Object.hasOwn(contract, slug) ? contract[slug] : null;
}

/**
 * UI route contract mirroring the role sets used by the database policies.
 * Unknown modules are denied by default.
 */
export function canAccessModule(role: OrganizationRole, slug: string) {
  const permission = modulePermission(moduleReadPermissions, slug);
  return permission ? hasPermission(role, permission) : false;
}

/**
 * Creation contract for the generic module workspace. Server Actions repeat
 * this check before every mutation; this helper only controls available UI.
 */
export function canCreateModuleRecord(
  role: OrganizationRole,
  slug: string,
) {
  const permission = modulePermission(moduleCreatePermissions, slug);
  return permission ? hasPermission(role, permission) : false;
}
