import { describe, expect, it } from "vitest";
import {
  nextOnboardingUnitNumber,
  onboardingSchema,
  type OnboardingInput,
} from "@/lib/validation/onboarding";

const organization: OnboardingInput["organization"] = {
  name: "Gregor Portfolio",
  organizationType: "private",
  street: "Musterweg 1",
  postalCode: "10115",
  city: "Berlin",
  currency: "EUR",
  taxYear: 2026,
};

const tax: OnboardingInput["tax"] = {
  calculationMode: "manual",
  manualEffectiveTaxRate: 28,
  otherTaxableIncome: null,
  filingStatus: "single",
  rentalIncomeComplete: false,
  churchTax: false,
  solidaritySurcharge: false,
};

const property: OnboardingInput["property"] = {
  propertyMode: "existing",
  name: "Mehrfamilienhaus",
  street: "Musterstraße 1",
  postalCode: "10115",
  city: "Berlin",
  propertyType: "apartment_building",
  constructionYear: 1990,
  purchaseDate: "2020-01-01",
  purchasePrice: 500_000,
  landArea: 300,
  standardLandValue: 500,
  landOwnershipSharePercent: 100,
  realEstateTransferTaxRate: 6,
  brokerFee: 12_000,
  notaryFee: 7_500,
  landRegistryFee: 2_500,
  otherAcquisitionCosts: 1_000,
  totalArea: 120,
  depreciationMode: "calculated",
  existingAnnualDepreciation: null,
};

const unit: OnboardingInput["units"][number] = {
  unitNumber: "Wohnung 1",
  floor: "1. OG",
  area: 60,
  rooms: 2,
  contractColdRent: 750,
  targetColdRent: 825,
  serviceCharge: 180,
  ancillaryChargeType: "advance",
  parkingRent: 0,
  leaseStart: "2024-02-01",
  status: "occupied",
};

const financing: OnboardingInput["financing"] = {
  enabled: false,
  loanType: "annuity",
  lenderName: "",
  originalPrincipal: 0,
  currentBalance: 0,
  nominalInterestRate: 0,
  initialRepaymentRate: 2,
  monthlyPayment: 0,
  disbursedOn: "",
  fixedRateUntil: "",
};

function fullOnboarding(
  unitOverrides: Partial<OnboardingInput["units"][number]> = {},
  rootOverrides: Partial<OnboardingInput> = {},
) {
  return {
    organization,
    tax,
    property,
    units: [{ ...unit, ...unitOverrides }],
    financing,
    importMode: "none",
    confirmation: true,
    ...rootOverrides,
  };
}

describe("onboarding completeness", () => {
  it("accepts a fully confirmed portfolio with separate rents", () => {
    expect(onboardingSchema.safeParse(fullOnboarding()).success).toBe(true);
  });

  it("does not allow the final summary to be skipped", () => {
    const result = onboardingSchema.safeParse(
      fullOnboarding({}, { confirmation: false }),
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({ path: ["confirmation"] }),
    );
  });

  it("permits multiple units only for an MFH", () => {
    const result = onboardingSchema.safeParse(
      fullOnboarding({}, {
        property: { ...property, propertyType: "condominium" },
        units: [unit, { ...unit, unitNumber: "Wohnung 2" }],
      }),
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({ path: ["units"] }),
    );
  });

  it("requires the existing AfA when it is copied from the tax return", () => {
    const result = onboardingSchema.safeParse(
      fullOnboarding({}, {
        property: {
          ...property,
          depreciationMode: "tax_return",
          existingAnnualDepreciation: null,
        },
      }),
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        path: ["property", "existingAnnualDepreciation"],
      }),
    );
  });

  it("rejects a land-value assumption above total acquisition cost", () => {
    const result = onboardingSchema.safeParse(
      fullOnboarding({}, {
        property: {
          ...property,
          landArea: 10_000,
          standardLandValue: 1_000,
        },
      }),
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        path: ["property", "standardLandValue"],
      }),
    );
  });
});

describe("automatic tax inputs", () => {
  const automaticTax = {
    ...tax,
    calculationMode: "automatic",
    otherTaxableIncome: 50_000,
  } as const;

  it("waits until all contractual rents are confirmed", () => {
    const result = onboardingSchema.safeParse(
      fullOnboarding({}, { tax: automaticTax }),
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({ path: ["tax", "rentalIncomeComplete"] }),
    );
  });

  it("accepts complete income plus the filing status", () => {
    expect(
      onboardingSchema.safeParse(
        fullOnboarding({}, {
          tax: { ...automaticTax, rentalIncomeComplete: true },
        }),
      ).success,
    ).toBe(true);
  });

  it("uses the automatic tariff only for its supported 2026 version", () => {
    const result = onboardingSchema.safeParse(
      fullOnboarding({}, {
        organization: { ...organization, taxYear: 2027 },
        tax: { ...automaticTax, rentalIncomeComplete: true },
      }),
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({ path: ["organization", "taxYear"] }),
    );
  });

  it("asks only for an effective rate in manual mode", () => {
    expect(
      onboardingSchema.safeParse(
        fullOnboarding({}, {
          tax: {
            ...tax,
            calculationMode: "manual",
            manualEffectiveTaxRate: 28.5,
          },
        }),
      ).success,
    ).toBe(true);
  });
});

describe("full onboarding unit leases", () => {
  it("requires contractual rent and a start date for occupied units", () => {
    const result = onboardingSchema.safeParse(
      fullOnboarding({ contractColdRent: 0, leaseStart: "" }),
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining([
        ["units", 0, "contractColdRent"],
        ["units", 0, "leaseStart"],
      ]),
    );
  });

  it.each(["vacant", "renovation"] as const)(
    "ignores the hidden lease start for %s units",
    (status) => {
      expect(
        onboardingSchema.safeParse(
          fullOnboarding({
            status,
            contractColdRent: 0,
            leaseStart: "veralteter-entwurf",
          }),
        ).success,
      ).toBe(true);
    },
  );

  it("rejects an impossible lease date", () => {
    const result = onboardingSchema.safeParse(
      fullOnboarding({ leaseStart: "2024-02-31" }),
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        path: ["units", 0, "leaseStart"],
        message: "Bitte gib ein gültiges Datum ein.",
      }),
    );
  });

  it("marks every duplicate unit number at its field", () => {
    const result = onboardingSchema.safeParse(
      fullOnboarding({}, {
        units: [unit, { ...unit, unitNumber: " wohnung 1 " }],
      }),
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.map((issue) => issue.path)).toEqual(
      expect.arrayContaining([
        ["units", 0, "unitNumber"],
        ["units", 1, "unitNumber"],
      ]),
    );
  });

  it("chooses the first free generated unit number after removals", () => {
    expect(
      nextOnboardingUnitNumber([
        { unitNumber: "Wohnung 1" },
        { unitNumber: "Wohnung 3" },
      ]),
    ).toBe("Wohnung 2");
  });
});
