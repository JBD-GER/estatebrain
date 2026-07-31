import { describe, expect, it } from "vitest";

import { DEMO_DATA } from "../../src/lib/demo";

describe("fiktives Demo-Datenset", () => {
  it("enthält die geforderten Portfolio-Bereiche", () => {
    expect(DEMO_DATA.mode).toBe("demo");
    expect(DEMO_DATA.label).toContain("Demo");
    expect(DEMO_DATA.properties).toHaveLength(2);
    expect(DEMO_DATA.units.length).toBeGreaterThanOrEqual(5);
    expect(DEMO_DATA.leases.length).toBeGreaterThanOrEqual(4);
    expect(DEMO_DATA.rentCharges.length).toBeGreaterThanOrEqual(5);
    expect(DEMO_DATA.payments.length).toBeGreaterThanOrEqual(5);
    expect(DEMO_DATA.expenses.length).toBeGreaterThanOrEqual(5);
    expect(DEMO_DATA.loans.length).toBeGreaterThanOrEqual(2);
    expect(DEMO_DATA.renovations.length).toBeGreaterThanOrEqual(1);
    expect(DEMO_DATA.tasks.length).toBeGreaterThanOrEqual(2);
    expect(DEMO_DATA.messages.length).toBeGreaterThanOrEqual(2);
  });

  it("markiert ausnahmslos jede Entität als Demo und nutzt keine echten E-Mail-Domains", () => {
    const entityCollections = [
      DEMO_DATA.properties,
      DEMO_DATA.units,
      DEMO_DATA.tenants,
      DEMO_DATA.leases,
      DEMO_DATA.rentCharges,
      DEMO_DATA.payments,
      DEMO_DATA.expenses,
      DEMO_DATA.invoices,
      DEMO_DATA.loans,
      DEMO_DATA.renovations,
      DEMO_DATA.tasks,
      DEMO_DATA.messages,
      DEMO_DATA.marketValuations,
    ];
    expect(DEMO_DATA.organization.isDemo).toBe(true);
    expect(DEMO_DATA.taxAssumption.isDemo).toBe(true);
    expect(entityCollections.flat().every((entity) => entity.isDemo)).toBe(
      true,
    );
    expect(
      DEMO_DATA.tenants.every((tenant) =>
        tenant.email.endsWith("@example.invalid"),
      ),
    ).toBe(true);
  });

  it("enthält Vollzahlung, Teilzahlung, offenen Mietfall und mehrere Belegstatus", () => {
    expect(DEMO_DATA.rentCharges.some((charge) => charge.status === "paid")).toBe(
      true,
    );
    expect(DEMO_DATA.rentCharges.some((charge) => charge.status === "open")).toBe(
      true,
    );
    expect(
      DEMO_DATA.rentCharges.some((charge) => charge.status === "partial"),
    ).toBe(true);
    expect(new Set(DEMO_DATA.invoices.map((invoice) => invoice.receiptStatus)).size)
      .toBeGreaterThanOrEqual(3);
    expect(
      DEMO_DATA.invoices.some(
        (invoice) => invoice.receiptStatus === "unclear_assignment",
      ),
    ).toBe(true);
  });
});
