import { describe, expect, it } from "vitest";
import { calculateInvestmentTax, DEFAULT_INVESTMENT_TAX_INPUT, type InvestmentTaxInput } from "@/lib/domain/investment-tax";
import { calculateInvestmentCashflow, DEFAULT_INVESTMENT_CASHFLOW } from "@/lib/domain/investment-cashflow";
import { investmentTaxInputSchema } from "@/lib/tax/scenario-schema";

function run(patch: Partial<InvestmentTaxInput> = {}) {
  const input: InvestmentTaxInput = { ...DEFAULT_INVESTMENT_TAX_INPUT, purchasePriceCents: 10_000_000, acquisitionCostsCents: 0, landShareRate: 0, acquisitionDate: "2026-01-01", marginalTaxRate: 0.4, years: 3,
    cashflow: { ...DEFAULT_INVESTMENT_CASHFLOW, monthlyColdRentCents: 100_000, monthlyOwnerCostsCents: 10_000 }, ...patch };
  return calculateInvestmentCashflow(input, calculateInvestmentTax(input).scenarios[0]);
}

describe("investment scenario rent and financing", () => {
  it("calculates rental income, taxable profit and cash flow separately", () => {
    expect(run().rows[0]).toMatchObject({ rentCents: 1_200_000, ownerCostsCents: 120_000, taxableIncomeCents: 880_000, taxCents: 352_000, beforeTaxCents: 1_080_000, afterTaxCents: 728_000 });
  });
  it("prorates acquisition and rent start, increases rent on its anniversary and applies vacancy", () => {
    const result = run({ acquisitionDate: "2026-07-15", cashflow: { ...DEFAULT_INVESTMENT_CASHFLOW, monthlyColdRentCents: 100_000, monthlyOwnerCostsCents: 10_000, rentStartsOn: "2026-10-15", annualRentGrowthRate: 0.02, vacancyRate: 0.1 } });
    expect(result.rows[0].rentCents).toBe(270_000);
    expect(result.rows[0].ownerCostsCents).toBe(60_000);
    expect(result.rows[1].rentCents).toBe(9 * 90_000 + 3 * 91_800);
  });
  it("uses an amortizing monthly annuity; only interest reduces taxable profit", () => {
    const result = run({ cashflow: { ...DEFAULT_INVESTMENT_CASHFLOW, monthlyColdRentCents: 100_000, loanAmountCents: 10_000_000, annualInterestRate: 0.06, initialRepaymentRate: 0.06 } });
    expect(result.monthlyPaymentCents).toBe(100_000);
    expect(result.rows[0].interestCents).toBeLessThan(600_000);
    expect(result.rows[0].principalCents).toBeGreaterThan(600_000);
    expect(result.rows[0].interestCents + result.rows[0].principalCents).toBe(1_200_000);
    expect(result.rows[1].interestCents).toBeLessThan(result.rows[0].interestCents);
    expect(result.rows[0].taxableIncomeCents).toBe(1_200_000 - result.rows[0].interestCents - 200_000);
    expect(result.rows[0].beforeTaxCents).toBe(0);
    expect(result.rows[0].afterTaxCents).toBe(-result.rows[0].taxCents);
    expect(result.rows[2].remainingDebtCents + result.totalPrincipalCents).toBe(10_000_000);
  });
  it("stops repayment at zero even when the last payment is smaller", () => {
    const result = run({ cashflow: { ...DEFAULT_INVESTMENT_CASHFLOW, loanAmountCents: 10_001, initialRepaymentRate: 1 } });
    expect(result.totalPrincipalCents).toBe(10_001);
    expect(result.rows[0].remainingDebtCents).toBe(5);
    expect(result.rows[1].principalCents).toBe(5);
    expect(result.rows[2].principalCents).toBe(0);
  });
  it("does not create rental tax deductions for an owner-occupied property", () => {
    const result = run({ usage: "owner_occupied", cashflow: { ...DEFAULT_INVESTMENT_CASHFLOW, monthlyColdRentCents: 100_000, monthlyOwnerCostsCents: 10_000, loanAmountCents: 10_000_000, annualInterestRate: 0.03 } });
    expect(result.rows[0]).toMatchObject({ rentCents: 0, taxCents: 0, taxableIncomeCents: 0, afterTaxCents: -420_000 });
  });
  it("does not draw or charge a future loan before its start month", () => {
    const result = run({ cashflow: { ...DEFAULT_INVESTMENT_CASHFLOW, loanAmountCents: 10_000_000, annualInterestRate: 0.06, loanStartsOn: "2027-07-01" } });
    expect(result.rows[0].remainingDebtCents).toBe(0);
    expect(result.rows[0].interestCents).toBe(0);
    expect(result.rows[1].interestCents).toBe(300_000);
  });
  it("retains compatibility with saved scenarios and persists the new assumptions", () => {
    expect(investmentTaxInputSchema.safeParse(DEFAULT_INVESTMENT_TAX_INPUT).success).toBe(true);
    const input = { ...DEFAULT_INVESTMENT_TAX_INPUT, linearSwitchAfterYears: 6, cashflow: { ...DEFAULT_INVESTMENT_CASHFLOW, monthlyColdRentCents: 123_456 } };
    expect(investmentTaxInputSchema.parse(input)).toEqual(input);
    expect(investmentTaxInputSchema.safeParse({ ...input, cashflow: { ...input.cashflow, loanStartsOn: "2020-01-01" } }).success).toBe(false);
    expect(investmentTaxInputSchema.safeParse({ ...input, cashflow: { ...input.cashflow, annualInterestRate: -0.03 } }).success).toBe(false);
  });
});
