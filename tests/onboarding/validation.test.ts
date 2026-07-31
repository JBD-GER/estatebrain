import { describe, expect, it } from "vitest";
import {
  emptyOnboardingSchema,
  nextOnboardingUnitNumber,
  onboardingSchema,
} from "@/lib/validation/onboarding";

const organization = {
  name: "Gregor Portfolio",
  organizationType: "private",
  street: "",
  postalCode: "",
  city: "",
  currency: "EUR",
  taxYear: 2026,
};

const tax = {
  calculationsEnabled: false,
  marginalTaxRate: null,
  effectiveTaxRate: null,
  churchTax: false,
  solidaritySurcharge: false,
  taxableIncome: null,
  filingStatus: "single",
};

const property = {
  name: "Mehrfamilienhaus",
  street: "Musterstraße 1",
  postalCode: "10115",
  city: "Berlin",
  propertyType: "apartment_building",
  purchaseDate: "2020-01-01",
  purchasePrice: 500_000,
  acquisitionCosts: 50_000,
  landValue: 100_000,
  buildingValue: 400_000,
  totalArea: 120,
  currentFinancing: 300_000,
  marketValue: 600_000,
  expectedMonthlyRent: 1_500,
};

const unit = {
  unitNumber: "Wohnung 1",
  floor: "1. OG",
  area: 60,
  rooms: 2,
  baseRent: 750,
  serviceCharge: 180,
  parkingRent: 0,
  leaseStart: "2024-02-01",
  status: "occupied",
};

function fullOnboarding(overrides: Partial<typeof unit> = {}) {
  return {
    organization,
    tax,
    property,
    units: [{ ...unit, ...overrides }],
    importMode: "none",
  };
}

describe("empty onboarding", () => {
  it("allows a fresh organization without property or sample data", () => {
    expect(emptyOnboardingSchema.safeParse({ organization, tax }).success).toBe(
      true,
    );
  });

  it("keeps a full portfolio setup strict", () => {
    expect(
      onboardingSchema.safeParse({
        organization,
        tax,
        property: {},
        units: [],
        importMode: "none",
      }).success,
    ).toBe(false);
  });
});

describe("full onboarding unit leases", () => {
  it("requires a lease start for occupied units at the correct field", () => {
    const result = onboardingSchema.safeParse(
      fullOnboarding({ leaseStart: "" }),
    );

    expect(result.success).toBe(false);
    if (result.success) return;

    expect(result.error.issues).toContainEqual(
      expect.objectContaining({
        path: ["units", 0, "leaseStart"],
        message: "Bitte gib den Mietbeginn an.",
      }),
    );
  });

  it("accepts an occupied unit with a valid lease start", () => {
    expect(onboardingSchema.safeParse(fullOnboarding()).success).toBe(true);
  });

  it.each(["vacant", "renovation"] as const)(
    "ignores the hidden lease start for %s units",
    (status) => {
      expect(
        onboardingSchema.safeParse(
          fullOnboarding({ status, leaseStart: "" }),
        ).success,
      ).toBe(true);
      expect(
        onboardingSchema.safeParse(
          fullOnboarding({ status, leaseStart: "veralteter-entwurf" }),
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
    const result = onboardingSchema.safeParse({
      ...fullOnboarding(),
      units: [
        unit,
        { ...unit, unitNumber: " wohnung 1 " },
      ],
    });

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
