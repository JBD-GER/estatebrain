import { describe, expect, it } from "vitest";

import {
  calculateDepreciation,
  calculateEstimatedTaxEffect,
  calculateTaxCashflow,
  calculateTaxableResultCents,
} from "../../src/lib/domain";

describe("AfA und steuerliches Ergebnis", () => {
  it("berechnet die AfA im Erstjahr monatsgenau und komponentenweise", () => {
    const result = calculateDepreciation({
      taxYear: 2026,
      buildingBasisCents: 30_000_000,
      placedInServiceDate: "2026-07-15",
      annualRate: 0.02,
      additionalComponents: [
        {
          label: "Einbauküche (Demo-Annahme)",
          basisCents: 1_200_000,
          placedInServiceDate: "2026-10-01",
          annualRate: 0.1,
        },
      ],
      manualAdjustmentCents: 10_000,
    });

    expect(result.monthsForBuilding).toBe(6);
    expect(result.breakdown[0]).toMatchObject({
      fullYearDepreciationCents: 600_000,
      taxYearDepreciationCents: 300_000,
    });
    expect(result.breakdown[1]).toMatchObject({
      monthsInTaxYear: 3,
      taxYearDepreciationCents: 30_000,
    });
    expect(result.depreciationCents).toBe(340_000);
  });

  it("setzt die AfA vor Nutzungsbeginn auf null und erlaubt Korrekturen nicht unter null", () => {
    expect(
      calculateDepreciation({
        taxYear: 2025,
        buildingBasisCents: 30_000_000,
        placedInServiceDate: "2026-01-01",
        annualRate: 0.02,
      }).depreciationCents,
    ).toBe(0);
    expect(
      calculateDepreciation({
        taxYear: 2026,
        buildingBasisCents: 1_000_000,
        placedInServiceDate: "2026-01-01",
        annualRate: 0.02,
        manualAdjustmentCents: -50_000,
      }).depreciationCents,
    ).toBe(0);
  });

  it("zieht Zinsen und AfA, aber keine Tilgung vom steuerlichen Ergebnis ab", () => {
    expect(
      calculateTaxableResultCents({
        taxableRentalIncomeCents: 2_400_000,
        deductibleOperatingExpensesCents: 500_000,
        loanInterestCents: 700_000,
        depreciationCents: 600_000,
        otherDeductibleExpensesCents: 100_000,
      }),
    ).toBe(500_000);
  });
});

describe("Steuer-Cashflow-Brücke", () => {
  it("trennt Liquidität, steuerliches Ergebnis, Belastung und Nachsteuer-Cashflow", () => {
    const result = calculateTaxCashflow({
      rentalIncomeCents: 2_400_000,
      cashOperatingExpensesCents: 600_000,
      deductibleOperatingExpensesCents: 500_000,
      interestPaidCents: 700_000,
      principalPaidCents: 400_000,
      depreciationCents: 600_000,
      otherDeductibleExpensesCents: 100_000,
      taxRate: 0.3,
    });

    expect(result.operatingSurplusCents).toBe(1_800_000);
    expect(result.cashflowBeforeTaxCents).toBe(700_000);
    expect(result.taxableResultCents).toBe(500_000);
    expect(result.estimatedTax.estimatedTaxCents).toBe(150_000);
    expect(result.estimatedTax.cashflowImpactCents).toBe(-150_000);
    expect(result.cashflowAfterEstimatedTaxCents).toBe(550_000);
    expect(result.taxExplanation).toContain("Tilgung ist ausgeschlossen");
  });

  it("modelliert bei erlaubter Verlustverrechnung eine Entlastung", () => {
    const effect = calculateEstimatedTaxEffect({
      taxableResultCents: -1_000_000,
      taxRate: 0.25,
      lossOffsetAllowed: true,
    });
    expect(effect.estimatedTaxCents).toBe(-250_000);
    expect(effect.cashflowImpactCents).toBe(250_000);
  });

  it("rät ohne Steuerannahme keinen Nullsteuersatz", () => {
    const result = calculateTaxCashflow({
      rentalIncomeCents: 1_000_000,
      cashOperatingExpensesCents: 200_000,
      deductibleOperatingExpensesCents: 200_000,
      interestPaidCents: 100_000,
      principalPaidCents: 100_000,
      depreciationCents: 300_000,
      taxRate: null,
    });
    expect(result.estimatedTax.status).toBe("missing_tax_rate");
    expect(result.estimatedTax.estimatedTaxCents).toBeNull();
    expect(result.cashflowAfterEstimatedTaxCents).toBeNull();
  });
});
