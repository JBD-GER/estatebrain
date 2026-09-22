import { describe, expect, it } from "vitest";
import { calculateInvestmentTax } from "@/lib/domain/investment-tax";
import {
  mapInvestmentProperties,
  mapInvestmentPropertyToInput,
  type InvestmentPropertyRow,
} from "@/lib/tax/portfolio-input";

const row: InvestmentPropertyRow = {
  id: "846ad09b-af2f-4b4f-bd1d-2e740985f4a1",
  name: "Wohnung am Park",
  property_type: "condominium",
  property_mode: "existing",
  country_code: "DE",
  purchase_price_cents: 30_000_000,
  acquisition_costs_cents: 3_600_000,
  purchase_date: "2026-07-31",
  construction_year: 1995,
  land_value_cents: 2_500_000,
  land_area_sqm: 100,
  standard_land_value_cents_per_sqm: 50_000,
  land_ownership_share: 0.5,
  rentable_area_sqm: 75,
  total_area_sqm: 80,
};

describe("portfolio seeds for the tax dashboard", () => {
  it("takes original purchase data and proportional land costs without altering acquisition-month AfA", () => {
    const option = mapInvestmentPropertyToInput(row)!;
    expect(option.name).toBe(row.name);
    expect(option.input).toMatchObject({
      purchasePriceCents: 30_000_000,
      acquisitionCostsCents: 3_600_000,
      acquisitionDate: "2026-07-31",
      completionDate: "1995-01-01",
      landShareRate: 1 / 12,
      livingAreaSquareMeters: 75,
      propertyKind: "existing",
      degressiveEligibilityConfirmed: false,
      heritageEligibilityConfirmed: false,
      special7bEligibilityConfirmed: false,
      certifiedHeritageCostsCents: 0,
      capitalizedMeasuresCents: 0,
    });
    const calculated = calculateInvestmentTax(option.input);
    expect(calculated.basis.buildingBasisCents).toBe(30_800_000);
    expect(calculated.scenarios[0].annualRows[0].months).toBe(6);
    expect(option.assumptions.join(" ")).toContain("Datumsplatzhalter");
    expect(option.assumptions.join(" ")).toContain("42 %");
    expect(option.assumptions.join(" ")).toContain("Vermietung ist eine Modellannahme");
  });

  it("imports a scenario as an editable existing-building purchase, without claiming rental facts", () => {
    expect(mapInvestmentPropertyToInput({ ...row, property_mode: "scenario" })?.input.propertyKind).toBe("existing");
  });

  it.each([
    { purchase_date: null }, { purchase_date: "2026-02-30" },
    { purchase_price_cents: null }, { purchase_price_cents: 0 },
    { acquisition_costs_cents: NaN }, { construction_year: null },
    { construction_year: 2026 }, { construction_year: 2027 },
    { construction_year: 999 }, { construction_year: 1995.5 },
    { country_code: "AT" }, { property_type: "commercial" },
    { property_type: "mixed_use" }, { property_mode: "inherited" },
    { land_value_cents: 30_000_001 }, { land_value_cents: -1 },
  ])("skips incomplete, unsupported or date-ambiguous data %j", changes => {
    expect(mapInvestmentPropertyToInput({ ...row, ...changes })).toBeNull();
  });

  it("estimates missing land only from complete actual stored inputs and marks the assumption", () => {
    const option = mapInvestmentPropertyToInput({ ...row, land_value_cents: null })!;
    expect(option.input.landShareRate).toBe(1 / 12);
    expect(option.assumptions.join(" ")).toContain("Bodenrichtwert");
    expect(option.assumptions.join(" ")).toContain("geschätzt");
    expect(mapInvestmentPropertyToInput({ ...row, land_value_cents: null, land_area_sqm: null })).toBeNull();
    expect(mapInvestmentPropertyToInput({ ...row, land_value_cents: null, standard_land_value_cents_per_sqm: null })).toBeNull();
  });

  it("does not invent a zero land value or fix an invalid saved value with a fallback", () => {
    expect(mapInvestmentPropertyToInput({ ...row, land_value_cents: null, land_ownership_share: NaN })).toBeNull();
    expect(mapInvestmentPropertyToInput({ ...row, land_value_cents: -1 })).toBeNull();
    expect(mapInvestmentPropertyToInput({ ...row, land_value_cents: 0 })?.input.landShareRate).toBe(0);
  });

  it("leaves a missing floor area unspecified and counts skipped rows accurately", () => {
    const valid = { ...row, rentable_area_sqm: null, total_area_sqm: null };
    expect(mapInvestmentPropertyToInput(valid)?.input.livingAreaSquareMeters).toBeUndefined();
    const result = mapInvestmentProperties([valid, { ...row, construction_year: 2026 }, { ...row, country_code: "US" }]);
    expect(result.properties).toHaveLength(1);
    expect(result.skippedCount).toBe(2);
  });
});
