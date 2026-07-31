import { describe, expect, it } from "vitest";
import {
  canAccessSensitiveReportData,
  reportScopeSearchParams,
  resolveReportScope,
} from "@/lib/reports/scope";

const propertyA = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Haus A",
};
const propertyB = {
  id: "22222222-2222-4222-8222-222222222222",
  name: "Haus B",
};
const unitA = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  property_id: propertyA.id,
  unit_number: "A-01",
};

describe("annual report scope", () => {
  it("derives the property scope from a standalone unit filter", () => {
    const result = resolveReportScope({
      propertyParam: null,
      unitParam: unitA.id,
      properties: [propertyA, propertyB],
      units: [unitA],
    });

    expect(result.error).toBeNull();
    expect(result.scope).toMatchObject({
      propertyId: propertyA.id,
      unitId: unitA.id,
      label: "Haus A · A-01",
    });
  });

  it("rejects a unit/property mismatch", () => {
    const result = resolveReportScope({
      propertyParam: propertyB.id,
      unitParam: unitA.id,
      properties: [propertyA, propertyB],
      units: [unitA],
    });

    expect(result.scope).toBeNull();
    expect(result.error).toContain("gehören nicht zusammen");
  });

  it("keeps view and export query parameters aligned", () => {
    const result = resolveReportScope({
      propertyParam: propertyA.id,
      unitParam: unitA.id,
      properties: [propertyA],
      units: [unitA],
    });
    if (!result.scope) throw new Error("scope expected");

    expect(reportScopeSearchParams(2026, result.scope).toString()).toBe(
      `year=2026&property=${propertyA.id}&unit=${unitA.id}`,
    );
  });

  it("gates bank and tax data to RLS-compatible roles", () => {
    expect(canAccessSensitiveReportData("owner")).toBe(true);
    expect(canAccessSensitiveReportData("admin")).toBe(true);
    expect(canAccessSensitiveReportData("accounting")).toBe(true);
    expect(canAccessSensitiveReportData("property_manager")).toBe(false);
  });
});
