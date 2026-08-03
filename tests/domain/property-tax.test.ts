import { describe, expect, it } from "vitest";

import {
  calculateAcquisitionAllocation,
  calculateGermanIncomeTax2026Cents,
  calculateGermanRentalTaxEstimate2026,
  propertySupportsMultipleUnits,
  propertyTypeLabel,
  recommendedBuildingDepreciationRate,
  recommendedResidentialBuildingDepreciationRate,
} from "../../src/lib/domain";

describe("Immobilien-Stammdaten", () => {
  it("verwendet die klassischen deutschen Objektabkürzungen", () => {
    expect(propertyTypeLabel("condominium")).toBe(
      "ETW · Eigentumswohnung",
    );
    expect(propertyTypeLabel("apartment_building")).toBe(
      "MFH · Mehrfamilienhaus",
    );
    expect(propertyTypeLabel("semi_detached")).toBe(
      "DHH · Doppelhaushälfte",
    );
    expect(propertyTypeLabel("terraced_house")).toBe("RH · Reihenhaus");
  });

  it("erlaubt mehrere Einheiten nur beim Mehrfamilienhaus", () => {
    expect(propertySupportsMultipleUnits("apartment_building")).toBe(true);
    expect(propertySupportsMultipleUnits("condominium")).toBe(false);
    expect(propertySupportsMultipleUnits("commercial")).toBe(false);
  });

  it("leitet Grundstück, Grunderwerbsteuer und Gebäudeanteil transparent ab", () => {
    expect(
      calculateAcquisitionAllocation({
        purchasePriceCents: 50_000_000,
        landAreaSquareMeters: 400,
        standardLandValueCentsPerSquareMeter: 40_000,
        landOwnershipShare: 1,
        realEstateTransferTaxRate: 0.06,
        brokerFeeCents: 1_785_000,
        notaryAndLandRegistryFeeCents: 1_000_000,
      }),
    ).toEqual({
      landValueCents: 16_000_000,
      buildingPurchasePriceCents: 34_000_000,
      realEstateTransferTaxCents: 3_000_000,
      acquisitionCostsCents: 5_785_000,
      totalAcquisitionCostCents: 55_785_000,
      buildingValueCents: 39_785_000,
    });
  });
});

describe("deutscher Einkommensteuertarif 2026", () => {
  it("wendet Grundfreibetrag und Tarifzonen auf volle Euro an", () => {
    expect(
      calculateGermanIncomeTax2026Cents({
        taxableIncomeCents: 1_234_800,
        assessmentType: "individual",
      }),
    ).toBe(0);
    expect(
      calculateGermanIncomeTax2026Cents({
        taxableIncomeCents: 7_000_000,
        assessmentType: "individual",
      }),
    ).toBe(1_826_400);
  });

  it("wendet bei Zusammenveranlagung den Splittingtarif an", () => {
    const individual = calculateGermanIncomeTax2026Cents({
      taxableIncomeCents: 8_000_000,
      assessmentType: "individual",
    });
    const joint = calculateGermanIncomeTax2026Cents({
      taxableIncomeCents: 8_000_000,
      assessmentType: "joint",
    });

    expect(joint).toBeLessThan(individual);
    expect(joint).toBe(
      2 *
        calculateGermanIncomeTax2026Cents({
          taxableIncomeCents: 4_000_000,
          assessmentType: "individual",
        }),
    );
  });

  it("trifft die Tarif-Referenzwerte für 50.000 und 60.000 Euro zvE", () => {
    const individual50 = calculateGermanIncomeTax2026Cents({
      taxableIncomeCents: 5_000_000,
      assessmentType: "individual",
    });
    const individual60 = calculateGermanIncomeTax2026Cents({
      taxableIncomeCents: 6_000_000,
      assessmentType: "individual",
    });
    const joint50 = calculateGermanIncomeTax2026Cents({
      taxableIncomeCents: 5_000_000,
      assessmentType: "joint",
    });
    const joint60 = calculateGermanIncomeTax2026Cents({
      taxableIncomeCents: 6_000_000,
      assessmentType: "joint",
    });

    expect(individual50).toBe(1_054_800);
    expect(individual60 - individual50).toBe(368_500);
    expect(joint50).toBe(570_000);
    expect(joint60 - joint50).toBe(273_400);
  });

  it("berechnet Effektiv- und Grenzsteuersatz aus weiteren Einkünften und Vermietung", () => {
    const estimate = calculateGermanRentalTaxEstimate2026({
      otherTaxableIncomeCents: 6_000_000,
      taxableRentalResultCents: 1_200_000,
      assessmentType: "individual",
    });

    expect(estimate.incomeTaxAfterRentalCents).toBeGreaterThan(
      estimate.incomeTaxBeforeRentalCents,
    );
    expect(estimate.estimatedRentalTaxEffectCents).toBeGreaterThan(0);
    expect(estimate.effectiveTaxRate).toBeGreaterThan(0);
    expect(estimate.marginalTaxRate).toBeGreaterThan(
      estimate.effectiveTaxRate,
    );
  });

  it("liefert den typisierten linearen AfA-Ausgangspunkt nach Baujahr", () => {
    expect(recommendedResidentialBuildingDepreciationRate(1924)).toBe(0.025);
    expect(recommendedResidentialBuildingDepreciationRate(1990)).toBe(0.02);
    expect(recommendedResidentialBuildingDepreciationRate(2026)).toBe(0.03);
  });

  it("verwendet für Gewerbe den nicht wohnwirtschaftlichen Ausgangspunkt", () => {
    expect(recommendedBuildingDepreciationRate("commercial", 1990)).toBe(0.03);
    expect(recommendedBuildingDepreciationRate("commercial", 1980)).toBe(
      0.025,
    );
  });
});
