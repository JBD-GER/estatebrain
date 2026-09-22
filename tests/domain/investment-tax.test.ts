import { describe, expect, it } from "vitest";

import {
  calculateInvestmentTax,
  DEFAULT_INVESTMENT_TAX_INPUT,
  type InvestmentTaxInput,
  type InvestmentTaxScenarioId,
  validateInvestmentTaxInput,
} from "../../src/lib/domain/investment-tax";

function input(overrides: Partial<InvestmentTaxInput> = {}): InvestmentTaxInput {
  return { ...DEFAULT_INVESTMENT_TAX_INPUT, ...overrides };
}

function newBuild(overrides: Partial<InvestmentTaxInput> = {}): InvestmentTaxInput {
  return input({
    purchasePriceCents: 100_000_000,
    acquisitionCostsCents: 0,
    landShareRate: 0,
    completionDate: "2025-01-01",
    acquisitionDate: "2025-01-01",
    contractDate: "2024-10-01",
    propertyKind: "new_build",
    degressiveEligibilityConfirmed: true,
    years: 5,
    autoSwitchToLinear: true,
    ...overrides,
  });
}

function fundedNewBuild(overrides: Partial<InvestmentTaxInput> = {}): InvestmentTaxInput {
  return newBuild({
    special7bEnabled: true,
    buildingApplicationDate: "2024-01-01",
    livingAreaSquareMeters: 250,
    special7bEligibilityConfirmed: true,
    qngCertified: true,
    tenYearRentalConfirmed: true,
    ...overrides,
  });
}

function heritage(overrides: Partial<InvestmentTaxInput> = {}): InvestmentTaxInput {
  return input({
    purchasePriceCents: 50_000_000,
    acquisitionCostsCents: 5_000_000,
    capitalizedMeasuresCents: 10_000_000,
    propertyKind: "heritage",
    completionDate: "1900-01-01",
    acquisitionDate: "2026-01-01",
    heritageCompletionDate: "2026-12-31",
    certifiedHeritageCostsCents: 10_000_000,
    heritageEligibilityConfirmed: true,
    years: 13,
    ...overrides,
  });
}

function scenario(value: InvestmentTaxInput, id: InvestmentTaxScenarioId) {
  const result = calculateInvestmentTax(value).scenarios.find(item => item.id === id);
  if (!result) throw new Error(`Missing scenario ${id}`);
  return result;
}

describe("investment tax cost allocation and validation", () => {
  it("removes land AND its allocated acquisition costs, then adds building-only measures once", () => {
    const result = calculateInvestmentTax(input({
      purchasePriceCents: 50_000_000,
      acquisitionCostsCents: 5_000_000,
      landShareRate: 0.2,
      capitalizedMeasuresCents: 3_000_000,
    }));
    expect(result.basis).toMatchObject({
      totalInvestmentCents: 58_000_000,
      landPurchasePriceCents: 10_000_000,
      landAcquisitionCostsCents: 1_000_000,
      buildingPurchasePriceCents: 40_000_000,
      buildingAcquisitionCostsCents: 4_000_000,
      buildingBasisCents: 47_000_000,
      regularBuildingBasisCents: 47_000_000,
    });
  });

  it.each([
    ["purchasePriceCents", -1], ["acquisitionCostsCents", 1.5],
    ["capitalizedMeasuresCents", NaN], ["purchasePriceCents", Infinity],
    ["marginalTaxRate", 42], ["landShareRate", 1.01],
    ["years", 0], ["years", 61], ["years", 2.5],
    ["acquisitionDate", "2026-02-30"], ["completionDate", "2026-13-01"],
    ["contractDate", "2026-02-29"], ["degressiveEligibilityConfirmed", "true"],
  ])("rejects invalid %s=%s without silently changing the number", (field, value) => {
    const invalid = input({ [field]: value });
    expect(validateInvestmentTaxInput(invalid).some(issue => issue.field === field)).toBe(true);
    expect(() => calculateInvestmentTax(invalid)).toThrow();
  });

  it("validates real leap dates, optional empty dates, and contract chronology", () => {
    expect(validateInvestmentTaxInput(input({ acquisitionDate: "2024-02-29", contractDate: "" }))).toEqual([]);
    expect(validateInvestmentTaxInput(input({ contractDate: "2027-01-01" }))).toEqual(expect.arrayContaining([expect.objectContaining({ field: "contractDate" })]));
  });

  it("prevents duplicate/oversized heritage costs and requires their completion date", () => {
    expect(() => calculateInvestmentTax(heritage({ certifiedHeritageCostsCents: 100_000_000 }))).toThrow(/Teil der Gebäudekosten/);
    expect(() => calculateInvestmentTax(heritage({ heritageCompletionDate: undefined }))).toThrow(/Abschlussdatum/);
    expect(() => calculateInvestmentTax(heritage({ heritageCompletionDate: "2025-12-31" }))).toThrow(/ab Anschaffung/);
  });
});

describe("residential linear and degressive depreciation", () => {
  it.each([["1924-12-31", 0.025], ["1925-01-01", 0.02], ["2022-12-31", 0.02], ["2023-01-01", 0.03]])(
    "uses the completion date %s, not the category, for linear rate %s", (completionDate, rate) => {
      expect(calculateInvestmentTax(input({ completionDate })).linearRate).toBe(rate);
    },
  );

  it("includes the acquisition month and returns cumulative savings in integer cents", () => {
    const result = scenario(input({
      purchasePriceCents: 10_000_000,
      acquisitionCostsCents: 0,
      landShareRate: 0,
      acquisitionDate: "2026-07-31",
      years: 2,
    }), "linear");
    expect(result.annualRows[0]).toMatchObject({ months: 6, regularDepreciationCents: 100_000, taxSavingCents: 42_000 });
    expect(result.annualRows[1]).toMatchObject({ months: 12, regularDepreciationCents: 200_000, cumulativeTaxSavingCents: 126_000 });
  });

  it("waits for completion if the acquired building was unfinished", () => {
    const result = calculateInvestmentTax(newBuild({ acquisitionDate: "2024-12-01", completionDate: "2025-08-01", years: 2 }));
    expect(result.scenarios[0].annualRows[0].totalDeductionCents).toBe(0);
    expect(result.scenarios[0].annualRows[1].months).toBe(5);
    expect(result.eligibility.degressive.eligible).toBe(false);
  });

  it("prorates first-year DEGRESSIVE depreciation too, then applies 5% to the remainder", () => {
    const result = scenario(newBuild({ acquisitionDate: "2025-07-31", years: 2 }), "degressive");
    expect(result.annualRows[0].regularDepreciationCents).toBe(2_500_000);
    expect(result.annualRows[1].regularDepreciationCents).toBe(4_875_000);
  });

  it.each([
    ["2023-09-30", false], ["2023-10-01", true],
    ["2029-09-30", true], ["2029-10-01", false],
  ])("checks purchase-contract boundary %s", (contractDate, expected) => {
    const year = Math.max(2025, Number(contractDate.slice(0, 4)));
    const result = calculateInvestmentTax(newBuild({ contractDate, completionDate: `${year}-12-01`, acquisitionDate: `${year}-12-31` }));
    expect(result.eligibility.degressive.eligible).toBe(expected);
    expect(result.scenarios.some(item => item.id === "degressive")).toBe(expected);
  });

  it("does not treat an ordinary existing property or an unconfirmed checkbox as eligible", () => {
    expect(calculateInvestmentTax(newBuild({ degressiveEligibilityConfirmed: false })).scenarios.map(item => item.id)).toEqual(["linear"]);
    expect(calculateInvestmentTax(newBuild({ acquisitionDate: "2026-01-01" })).eligibility.degressive.eligible).toBe(false);
  });

  it("switches irreversibly to a fixed annual linear rest-value charge when beneficial", () => {
    const result = scenario(newBuild({ years: 40 }), "degressive");
    expect(result.switchedToLinearYear).toBe(2039);
    const switched = result.annualRows.filter(row => row.year >= result.switchedToLinearYear! && row.remainingBasisCents > 0);
    expect(new Set(switched.map(row => row.regularDepreciationCents)).size).toBe(1);
    expect(result.totalDeductionCents).toBe(100_000_000);
    expect(result.remainingBasisCents).toBe(0);
    const noSwitch = scenario(newBuild({ years: 40, autoSwitchToLinear: false }), "degressive");
    expect(noSwitch.switchedToLinearYear).toBeNull();
    expect(noSwitch.remainingBasisCents).toBeGreaterThan(0);
  });
});

describe("§ 7b eligibility and rest-value accounting", () => {
  it("matches BMF example 7c including the year-five reset after all special deductions", () => {
    const result = scenario(fundedNewBuild(), "degressive_7b");
    expect(result.annualRows.map(row => row.regularDepreciationCents)).toEqual([5_000_000, 4_750_000, 4_512_500, 4_286_875, 3_072_531]);
    expect(result.annualRows.map(row => row.specialDepreciationCents)).toEqual([5_000_000, 5_000_000, 5_000_000, 5_000_000, 0]);
    expect(result.annualRows[3].remainingBasisCents).toBe(61_450_625);
  });

  it("prorates normal AfA in December but retains the full-year §7b amount", () => {
    const result = scenario(fundedNewBuild({ acquisitionDate: "2025-12-31" }), "linear_7b");
    expect(result.annualRows[0]).toMatchObject({ regularDepreciationCents: 250_000, specialDepreciationCents: 5_000_000 });
    // 2029: 33-year reference life minus 3 years + 1 month already elapsed.
    expect(result.annualRows[4].regularDepreciationCents).toBe(Math.round(70_750_000 / (33 - 3 - 1 / 12)));
  });

  it("caps the eligible basis at 4,000 €/m², while 5,200 €/m² is a complete eligibility cutoff", () => {
    const atLimit = calculateInvestmentTax(fundedNewBuild({ purchasePriceCents: 52_000_000, livingAreaSquareMeters: 100 }));
    expect(atLimit.eligibility.special7b.eligible).toBe(true);
    expect(atLimit.basis.special7bBasisCents).toBe(40_000_000);
    const overLimit = calculateInvestmentTax(fundedNewBuild({ purchasePriceCents: 52_000_001, livingAreaSquareMeters: 100 }));
    expect(overLimit.eligibility.special7b.eligible).toBe(false);
    expect(overLimit.scenarios.some(item => item.id.endsWith("_7b"))).toBe(false);
  });

  it.each([
    { qngCertified: false }, { tenYearRentalConfirmed: false },
    { special7bEligibilityConfirmed: false }, { livingAreaSquareMeters: 0 },
    { buildingApplicationDate: "2022-12-31" },
    { propertyKind: "heritage" as const },
  ])("blocks unsupported 7b case %j", changes => {
    expect(calculateInvestmentTax(fundedNewBuild(changes)).eligibility.special7b.eligible).toBe(false);
  });

  it("models the legacy 2,000 €/m² cap and 2026 cutoff without shortening the four-year rest-value period", () => {
    const result = calculateInvestmentTax(fundedNewBuild({
      purchasePriceCents: 80_750_000, livingAreaSquareMeters: 323,
      completionDate: "2026-01-01", acquisitionDate: "2026-01-01",
      buildingApplicationDate: "2021-12-31", qngCertified: false,
    }));
    expect(result.eligibility.special7b.eligible).toBe(true);
    expect(result.basis.special7bBasisCents).toBe(64_600_000);
    const rows = result.scenarios.find(item => item.id === "linear_7b")!.annualRows;
    expect(rows.map(row => row.specialDepreciationCents)).toEqual([3_230_000, 0, 0, 0, 0]);
    expect(rows[3].regularDepreciationCents).toBe(2_422_500);
    expect(rows[4].regularDepreciationCents).toBe(Math.round(67_830_000 / 29));
  });
});

describe("heritage and owner-occupied property", () => {
  it("separates certified costs, uses 8 × 9% plus 4 × 7%, and never gives the same costs normal AfA", () => {
    const value = heritage();
    const result = calculateInvestmentTax(value);
    expect(result.basis.buildingBasisCents).toBe(54_000_000);
    expect(result.basis.regularBuildingBasisCents).toBe(44_000_000);
    const modeled = result.scenarios.find(item => item.id === "heritage")!;
    expect(modeled.annualRows.map(row => row.heritageDeductionCents)).toEqual([
      ...Array(8).fill(900_000), ...Array(4).fill(700_000), 0,
    ]);
    expect(modeled.annualRows[0].regularDepreciationCents).toBe(1_100_000);
    expect(modeled.annualRows[0].totalDeductionCents).toBe(2_000_000);
    expect(modeled.annualRows.reduce((sum, row) => sum + row.heritageDeductionCents, 0)).toBe(10_000_000);
  });

  it("does not depreciate future heritage works before completion, including in the linear alternative", () => {
    const value = heritage({ heritageCompletionDate: "2028-12-31", years: 3 });
    const special = scenario(value, "heritage");
    expect(special.annualRows.map(row => row.heritageDeductionCents)).toEqual([0, 0, 900_000]);
    const ordinary = scenario(value, "linear");
    expect(ordinary.annualRows.map(row => row.regularDepreciationCents)).toEqual([1_100_000, 1_100_000, 1_120_833]);
  });

  it("allows only 90% special expenses for an owner-occupied monument, without normal building AfA", () => {
    const value = heritage({ usage: "owner_occupied", years: 12 });
    const modeled = scenario(value, "heritage");
    expect(modeled.annualRows.every(row => row.regularDepreciationCents === 0)).toBe(true);
    expect(modeled.totalDeductionCents).toBe(9_000_000);
    expect(modeled.totalTaxSavingCents).toBe(3_780_000);
    expect(modeled.annualRows[10].heritageDeductionCents).toBe(0);
    expect(scenario(value, "owner_occupied").totalDeductionCents).toBe(0);
  });

  it("does not fabricate a heritage entitlement when the certificate prerequisites are unconfirmed", () => {
    const result = calculateInvestmentTax(heritage({ heritageEligibilityConfirmed: false }));
    expect(result.scenarios.map(item => item.id)).toEqual(["linear"]);
    expect(result.warnings.some(item => item.includes("Bescheinigung"))).toBe(true);
  });

  it("applies no ordinary AfA or special new-build deductions to an owner-occupied home", () => {
    const result = calculateInvestmentTax(fundedNewBuild({ usage: "owner_occupied" }));
    expect(result.scenarios).toHaveLength(1);
    expect(result.scenarios[0].totalDeductionCents).toBe(0);
    expect(result.eligibility.special7b.eligible).toBe(false);
    expect(result.eligibility.degressive.eligible).toBe(false);
  });
});

describe("schedule conservation and rounding", () => {
  it.each([
    input({ years: 60 }), newBuild({ years: 60 }),
    fundedNewBuild({ years: 60 }), heritage({ years: 60 }),
    heritage({ usage: "owner_occupied", years: 60 }),
    heritage({ purchasePriceCents: 100_003, acquisitionCostsCents: 997, capitalizedMeasuresCents: 10_003, certifiedHeritageCostsCents: 10_003, years: 60 }),
  ])("preserves every cent, never exceeds the cost basis, and accumulates displayed rows", value => {
    const result = calculateInvestmentTax(value);
    for (const modeled of result.scenarios) {
      expect(modeled.totalDeductionCents + modeled.remainingBasisCents).toBe(result.basis.buildingBasisCents);
      expect(modeled.totalTaxSavingCents).toBe(modeled.annualRows.reduce((sum, row) => sum + row.taxSavingCents, 0));
      expect(modeled.totalDeductionCents).toBe(modeled.annualRows.reduce((sum, row) => sum + row.totalDeductionCents, 0));
      for (const row of modeled.annualRows) {
        expect(row.remainingBasisCents).toBeGreaterThanOrEqual(0);
        expect(row.cumulativeDeductionCents + row.remainingBasisCents).toBe(result.basis.buildingBasisCents);
        expect(Number.isSafeInteger(row.totalDeductionCents)).toBe(true);
      }
    }
  });

  it("fully consumes odd-cent rented heritage costs and precisely 90% for self use", () => {
    const value = heritage({ certifiedHeritageCostsCents: 10_000_003, years: 12 });
    const rented = scenario(value, "heritage");
    expect(rented.annualRows.reduce((sum, row) => sum + row.heritageDeductionCents, 0)).toBe(10_000_003);
    const owner = scenario({ ...value, usage: "owner_occupied" }, "heritage");
    expect(owner.totalDeductionCents).toBe(9_000_003);
  });
});
