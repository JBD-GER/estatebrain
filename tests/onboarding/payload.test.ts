import { describe, expect, it } from "vitest";
import { prepareOnboardingPersistence } from "@/lib/onboarding/payload";
import type { OnboardingInput } from "@/lib/validation/onboarding";

const input: OnboardingInput = {
  organization: {
    name: "Portfolio",
    organizationType: "private",
    street: "Musterweg 1",
    postalCode: "10115",
    city: "Berlin",
    currency: "EUR",
    taxYear: 2026,
  },
  property: {
    propertyMode: "existing",
    name: "ETW",
    street: "Musterstraße 1",
    postalCode: "10115",
    city: "Berlin",
    propertyType: "condominium",
    constructionYear: 1995,
    purchaseDate: "2020-01-01",
    purchasePrice: 300_000,
    landArea: 100,
    standardLandValue: 500,
    landOwnershipSharePercent: 50,
    realEstateTransferTaxRate: 6,
    brokerFee: 10_000,
    notaryFee: 5_000,
    landRegistryFee: 2_000,
    otherAcquisitionCosts: 1_000,
    totalArea: 75,
    depreciationMode: "calculated",
    existingAnnualDepreciation: null,
  },
  units: [
    {
      unitNumber: "Mietfläche",
      floor: "2. OG",
      area: 75,
      rooms: 3,
      contractColdRent: 1_000,
      targetColdRent: 1_200,
      serviceCharge: 250,
      ancillaryChargeType: "advance",
      parkingRent: 50,
      leaseStart: "2020-01-01",
      status: "occupied",
    },
  ],
  financing: {
    enabled: true,
    loanType: "annuity",
    lenderName: "Musterbank",
    originalPrincipal: 250_000,
    currentBalance: 200_000,
    nominalInterestRate: 3,
    initialRepaymentRate: 2,
    monthlyPayment: 1_000,
    disbursedOn: "2020-01-01",
    fixedRateUntil: "2030-01-01",
  },
  tax: {
    calculationMode: "automatic",
    manualEffectiveTaxRate: null,
    otherTaxableIncome: 50_000,
    filingStatus: "single",
    rentalIncomeComplete: true,
    churchTax: false,
    solidaritySurcharge: false,
  },
  importMode: "none",
  confirmation: true,
};

describe("onboarding persistence payload", () => {
  it("keeps contract and target rent separate in the v2 payload", () => {
    const prepared = prepareOnboardingPersistence(input);
    expect(prepared.finalPayload.units[0]?.contractColdRent).toBe(1_000);
    expect(prepared.finalPayload.units[0]?.targetColdRent).toBe(1_200);
    expect(prepared.legacyPayload.units[0]?.baseRent).toBe(1_000);
    expect(prepared.finalPayload.derived.annualContractRentCents).toBe(
      1_200_000,
    );
    expect(prepared.finalPayload.derived.annualTargetRentCents).toBe(
      1_440_000,
    );
    expect(prepared.finalPayload.derived.annualParkingRentCents).toBe(60_000);
    expect(prepared.finalPayload.derived.annualAncillaryIncomeCents).toBe(
      300_000,
    );
  });

  it("includes every purchase cost in the building allocation", () => {
    const { acquisition } = prepareOnboardingPersistence(input).finalPayload
      .derived;
    expect(acquisition.realEstateTransferTaxCents).toBe(1_800_000);
    expect(acquisition.acquisitionCostsCents).toBe(3_600_000);
    expect(acquisition.landValueCents).toBe(2_500_000);
    expect(acquisition.buildingValueCents).toBe(31_100_000);
  });

  it("never turns a scenario into a live legacy lease", () => {
    const prepared = prepareOnboardingPersistence({
      ...input,
      property: { ...input.property, propertyMode: "scenario" },
    });
    expect(prepared.legacyPayload.units[0]?.status).toBe("vacant");
    expect(prepared.finalPayload.derived.taxableRentalResultCents).toBe(0);
  });
});
