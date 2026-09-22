import { describe, expect, it } from "vitest";
import {
  investmentScenarioSaveSchema,
  investmentTaxInputSchema,
} from "@/lib/tax/scenario-schema";

const input = {
  purchasePriceCents: 40_000_000,
  acquisitionCostsCents: 4_000_000,
  landShareRate: 0.2,
  capitalizedMeasuresCents: 0,
  completionDate: "2000-01-01",
  acquisitionDate: "2026-07-01",
  usage: "rented",
  propertyKind: "existing",
  marginalTaxRate: 0.42,
  years: 20,
};

describe("investment scenario input boundary", () => {
  it("preserves the selected method and strips whitespace from the name", () => {
    const parsed = investmentScenarioSaveSchema.parse({
      name: "  Wohnung Berlin  ", input, selectedMethod: "degressive_7b",
    });
    expect(parsed.name).toBe("Wohnung Berlin");
    expect(parsed.selectedMethod).toBe("degressive_7b");
    expect(parsed.input.purchasePriceCents).toBe(40_000_000);
  });

  it("rejects client-controlled ownership and arbitrary nested payloads", () => {
    expect(investmentScenarioSaveSchema.safeParse({ name: "Test", input, organization_id: "other" }).success).toBe(false);
    expect(investmentTaxInputSchema.safeParse({ ...input, extra: { data: "unbounded" } }).success).toBe(false);
  });

  it.each([NaN, Infinity, -1, 1.5, 1_000_000_000_001])("rejects invalid cent values %s", (value) => {
    expect(investmentTaxInputSchema.safeParse({ ...input, purchasePriceCents: value }).success).toBe(false);
  });

  it.each(["2026-02-30", "2026-13-01", "2026-2-01", "0999-01-01", "2201-01-01"])("rejects invalid calendar dates %s", (value) => {
    expect(investmentTaxInputSchema.safeParse({ ...input, completionDate: value }).success).toBe(false);
  });

  it("accepts absent optional dates without persisting empty strings", () => {
    expect(investmentTaxInputSchema.parse({ ...input, contractDate: "" }).contractDate).toBeUndefined();
  });

  it("applies domain validation to prevent certified costs exceeding the building basis", () => {
    expect(investmentTaxInputSchema.safeParse({
      ...input,
      propertyKind: "heritage",
      certifiedHeritageCostsCents: 50_000_000,
      heritageCompletionDate: "2026-08-01",
    }).success).toBe(false);
  });

  it("bounds names, method identifiers, IDs and the calculation horizon", () => {
    expect(investmentScenarioSaveSchema.safeParse({ name: " ", input }).success).toBe(false);
    expect(investmentScenarioSaveSchema.safeParse({ name: "x".repeat(121), input }).success).toBe(false);
    expect(investmentScenarioSaveSchema.safeParse({ name: "Test", input, id: "not-a-uuid" }).success).toBe(false);
    expect(investmentScenarioSaveSchema.safeParse({ name: "Test", input, selectedMethod: "unknown" }).success).toBe(false);
    expect(investmentTaxInputSchema.safeParse({ ...input, years: 61 }).success).toBe(false);
  });
});
