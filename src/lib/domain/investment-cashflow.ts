import type { InvestmentCashflowInput, InvestmentTaxInput, InvestmentTaxScenario } from "./investment-tax";
import { validateInvestmentTaxInput } from "./investment-tax";
import { DomainValidationError, multiplyCents, sumCents } from "./money";

export const DEFAULT_INVESTMENT_CASHFLOW: InvestmentCashflowInput = {
  monthlyColdRentCents: 0, annualRentGrowthRate: 0, vacancyRate: 0,
  monthlyOwnerCostsCents: 0, loanAmountCents: 0, annualInterestRate: 0,
  initialRepaymentRate: 0,
};

export interface InvestmentCashflowRow {
  year: number;
  rentCents: number;
  ownerCostsCents: number;
  interestCents: number;
  principalCents: number;
  remainingDebtCents: number;
  taxableIncomeCents: number;
  /** Positive = tax payment, negative = modeled tax relief. */
  taxCents: number;
  beforeTaxCents: number;
  afterTaxCents: number;
}

const monthIndex = (date: string) => Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;

/** Monthly annuity with constant rate, aggregated by calendar year. No loan
 * proceeds / acquisition cash flows: this is operating cash flow, not an IRR.
 * Full rental intent and immediate use of losses are model assumptions. */
export function calculateInvestmentCashflow(input: InvestmentTaxInput, scenario: InvestmentTaxScenario) {
  const issue = validateInvestmentTaxInput(input)[0];
  if (issue) throw new DomainValidationError(issue.message, issue.field);
  const config = input.cashflow ?? DEFAULT_INVESTMENT_CASHFLOW;
  const ownershipMonth = monthIndex(input.acquisitionDate);
  const rentMonth = Math.max(ownershipMonth, monthIndex(input.completionDate), monthIndex(config.rentStartsOn || input.acquisitionDate));
  const loanMonth = monthIndex(config.loanStartsOn || input.acquisitionDate);
  const monthlyPaymentCents = multiplyCents(config.loanAmountCents, (config.annualInterestRate + config.initialRepaymentRate) / 12);
  let balance = 0;
  const rows: InvestmentCashflowRow[] = scenario.annualRows.map((taxRow) => {
    let rentCents = 0, ownerCostsCents = 0, interestCents = 0, principalCents = 0;
    for (let month = 0; month < 12; month++) {
      const currentMonth = taxRow.year * 12 + month;
      if (currentMonth < ownershipMonth) continue;
      ownerCostsCents += config.monthlyOwnerCostsCents;
      if (input.usage === "rented" && currentMonth >= rentMonth) {
        const growthYears = Math.floor((currentMonth - rentMonth) / 12);
        rentCents += multiplyCents(config.monthlyColdRentCents, (1 + config.annualRentGrowthRate) ** growthYears * (1 - config.vacancyRate));
      }
      if (currentMonth === loanMonth) balance = config.loanAmountCents;
      if (currentMonth >= loanMonth && balance > 0) {
        const interest = multiplyCents(balance, config.annualInterestRate / 12);
        const principal = Math.min(balance, Math.max(0, monthlyPaymentCents - interest));
        interestCents += interest;
        principalCents += principal;
        balance -= principal;
      }
    }
    const taxableIncomeCents = input.usage === "rented"
      ? rentCents - ownerCostsCents - interestCents - taxRow.totalDeductionCents : 0;
    const taxCents = input.usage === "rented"
      ? multiplyCents(taxableIncomeCents, input.marginalTaxRate) : -taxRow.taxSavingCents || 0;
    const beforeTaxCents = rentCents - ownerCostsCents - interestCents - principalCents;
    return { year: taxRow.year, rentCents, ownerCostsCents, interestCents, principalCents,
      remainingDebtCents: balance, taxableIncomeCents, taxCents, beforeTaxCents, afterTaxCents: beforeTaxCents - taxCents };
  });
  return {
    rows, monthlyPaymentCents,
    totalAfterTaxCents: sumCents(rows.map((row) => row.afterTaxCents), { allowNegative: true }),
    totalRentCents: sumCents(rows.map((row) => row.rentCents)),
    totalInterestCents: sumCents(rows.map((row) => row.interestCents)),
    totalPrincipalCents: sumCents(rows.map((row) => row.principalCents)),
  };
}
