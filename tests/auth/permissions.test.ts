import { describe, expect, it } from "vitest";
import {
  canAccessModule,
  canCreateModuleRecord,
  hasPermission,
} from "@/lib/auth/permissions";
import { getModuleDefinition } from "@/lib/modules";

describe("organization role contract", () => {
  it("keeps property managers in bookkeeping without exposing sensitive finance", () => {
    expect(hasPermission("property_manager", "bookkeeping.read")).toBe(true);
    expect(hasPermission("property_manager", "bookkeeping.write")).toBe(true);

    expect(hasPermission("property_manager", "bank.read")).toBe(false);
    expect(hasPermission("property_manager", "bank.reconcile")).toBe(false);
    expect(hasPermission("property_manager", "financing.read")).toBe(false);
    expect(hasPermission("property_manager", "financing.write")).toBe(false);
    expect(hasPermission("property_manager", "tax.read")).toBe(false);
  });

  it("matches sensitive database reads to owner, admin and accounting", () => {
    for (const role of ["owner", "admin", "accounting"] as const) {
      expect(hasPermission(role, "bank.read")).toBe(true);
      expect(hasPermission(role, "financing.read")).toBe(true);
      expect(hasPermission(role, "tax.read")).toBe(true);
    }

    expect(hasPermission("employee", "bank.read")).toBe(false);
    expect(hasPermission("tenant", "bank.read")).toBe(false);
  });

  it("aligns organization management with the database owner/admin policy", () => {
    expect(hasPermission("owner", "organization.manage")).toBe(true);
    expect(hasPermission("admin", "organization.manage")).toBe(true);
    expect(hasPermission("property_manager", "organization.manage")).toBe(
      false,
    );
  });
});

describe("module navigation and creation contract", () => {
  it("hides inaccessible modules while preserving legitimate PM modules", () => {
    expect(canAccessModule("property_manager", "einnahmen")).toBe(true);
    expect(canAccessModule("property_manager", "ausgaben")).toBe(true);
    expect(canAccessModule("property_manager", "bank")).toBe(false);
    expect(canAccessModule("property_manager", "finanzierungen")).toBe(false);
    expect(canAccessModule("property_manager", "steuern")).toBe(false);
    expect(canAccessModule("property_manager", "team")).toBe(false);
    expect(canAccessModule("property_manager", "integrationen")).toBe(false);
  });

  it("shows accounting only the collaboration modules its role can access", () => {
    expect(canAccessModule("accounting", "bank")).toBe(true);
    expect(canAccessModule("accounting", "finanzierungen")).toBe(true);
    expect(canAccessModule("accounting", "steuern")).toBe(true);
    expect(canAccessModule("accounting", "berichte")).toBe(true);
    expect(canAccessModule("accounting", "kommunikation")).toBe(false);
    expect(canAccessModule("accounting", "aufgaben")).toBe(false);
  });

  it("gates generic create actions with the table-specific write permission", () => {
    expect(canCreateModuleRecord("property_manager", "einnahmen")).toBe(true);
    expect(canCreateModuleRecord("property_manager", "ausgaben")).toBe(true);
    expect(
      canCreateModuleRecord("property_manager", "finanzierungen"),
    ).toBe(false);
    expect(canCreateModuleRecord("accounting", "finanzierungen")).toBe(true);
    expect(canCreateModuleRecord("employee", "immobilien")).toBe(false);
    expect(canCreateModuleRecord("employee", "belege")).toBe(true);
  });

  it("uses the working Potenziale route slug and denies unknown modules", () => {
    expect(getModuleDefinition("potenziale")?.slug).toBe("potenziale");
    expect(canAccessModule("owner", "potenziale")).toBe(true);
    expect(getModuleDefinition("potentiale")).toBeNull();
    expect(canAccessModule("owner", "potentiale")).toBe(false);
    expect(canAccessModule("owner", "unknown-module")).toBe(false);
  });
});
