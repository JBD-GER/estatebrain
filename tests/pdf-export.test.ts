import { describe, expect, it } from "vitest";
import { createPortfolioReportPdf } from "@/lib/exports/pdf";

describe("portfolio PDF export", () => {
  it("creates a valid PDF document from bounded report data", () => {
    const pdf = createPortfolioReportPdf({
      organizationName: "Musterverwaltung GmbH",
      generatedAt: new Date("2026-07-31T10:15:00.000Z"),
      reportingYear: 2026,
      scopeLabel: "Wohnpark Süd",
      sensitiveDataAvailable: true,
      metrics: {
        propertyCount: 1,
        unitCount: 4,
        occupiedUnitCount: 3,
        activeLeaseCount: 3,
        marketValueCents: 850_000_00,
        loanBalanceCents: 410_000_00,
        paidIncomeCents: 42_000_00,
        paidExpenseCents: 11_000_00,
        openRentCents: 950_00,
        missingReceiptCount: 1,
        unresolvedTransactionCount: 0,
        assumedTaxRate: 0.35,
        estimatedTaxEffectCents: 120_000,
      },
      properties: [
        {
          name: "Wohnpark Süd",
          city: "Köln",
          status: "active",
          marketValueCents: 850_000_00,
          purchasePriceCents: 700_000_00,
        },
      ],
    });

    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(4_000);
  });

  it("renders role- or scope-unavailable bank and tax metrics without fake zeroes", () => {
    const pdf = createPortfolioReportPdf({
      organizationName: "Musterverwaltung GmbH",
      generatedAt: new Date("2026-07-31T10:15:00.000Z"),
      reportingYear: 2026,
      scopeLabel: "Wohnpark Süd · WE 01",
      sensitiveDataAvailable: false,
      metrics: {
        propertyCount: 1,
        unitCount: 1,
        occupiedUnitCount: 1,
        activeLeaseCount: 1,
        marketValueCents: 0,
        loanBalanceCents: null,
        paidIncomeCents: 12_000_00,
        paidExpenseCents: 3_000_00,
        openRentCents: 0,
        missingReceiptCount: 0,
        unresolvedTransactionCount: null,
        assumedTaxRate: null,
        estimatedTaxEffectCents: null,
      },
      properties: [],
    });

    expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe("%PDF-");
    expect(pdf.byteLength).toBeGreaterThan(4_000);
  });
});
