import {
  assertMoneyCents,
  divideOrNull,
  roundRatio,
  sumCents,
} from "./money";
import type { MoneyCents } from "./types";

/** Estimated equity = market value - all outstanding loan balances. */
export function calculateEstimatedEquityCents(input: {
  marketValueCents: MoneyCents;
  outstandingLoanBalancesCents: readonly MoneyCents[];
}): MoneyCents {
  assertMoneyCents(input.marketValueCents, "marketValueCents");
  const outstandingDebtCents = sumCents(input.outstandingLoanBalancesCents);
  return input.marketValueCents - outstandingDebtCents;
}

export interface SaleScenarioInput {
  expectedSalePriceCents: MoneyCents;
  outstandingLoanBalancesCents: readonly MoneyCents[];
  sellingCostsCents: MoneyCents;
  prepaymentPenaltiesCents?: MoneyCents;
  estimatedTaxesCents?: MoneyCents;
  otherExitCostsCents?: MoneyCents;
  originallyInvestedEquityCents: MoneyCents;
  cumulativeCashflowCents?: MoneyCents;
}

export interface SaleScenarioResult {
  expectedSalePriceCents: MoneyCents;
  outstandingDebtCents: MoneyCents;
  totalExitCostsCents: MoneyCents;
  netSaleProceedsCents: MoneyCents;
  cumulativeCashflowCents: MoneyCents;
  totalInvestorProceedsCents: MoneyCents;
  modeledProfitCents: MoneyCents;
  equityMultiple: number | null;
  totalReturnOnEquity: number | null;
  explanation: string;
  disclaimer: string;
}

/**
 * Net sale proceeds = expected price - debt - selling costs - prepayment costs
 * - user-entered tax estimate - other exit costs.
 *
 * No capital-gains tax rule is inferred. Any tax is a manual scenario input.
 */
export function calculateSaleScenario(
  input: SaleScenarioInput,
): SaleScenarioResult {
  const nonNegativeFields = [
    ["expectedSalePriceCents", input.expectedSalePriceCents],
    ["sellingCostsCents", input.sellingCostsCents],
    ["prepaymentPenaltiesCents", input.prepaymentPenaltiesCents ?? 0],
    ["estimatedTaxesCents", input.estimatedTaxesCents ?? 0],
    ["otherExitCostsCents", input.otherExitCostsCents ?? 0],
    ["originallyInvestedEquityCents", input.originallyInvestedEquityCents],
  ] as const;
  nonNegativeFields.forEach(([field, value]) =>
    assertMoneyCents(value, field),
  );
  const cumulativeCashflowCents = input.cumulativeCashflowCents ?? 0;
  assertMoneyCents(cumulativeCashflowCents, "cumulativeCashflowCents", {
    allowNegative: true,
  });

  const outstandingDebtCents = sumCents(
    input.outstandingLoanBalancesCents,
  );
  const totalExitCostsCents =
    input.sellingCostsCents +
    (input.prepaymentPenaltiesCents ?? 0) +
    (input.estimatedTaxesCents ?? 0) +
    (input.otherExitCostsCents ?? 0);
  const netSaleProceedsCents =
    input.expectedSalePriceCents -
    outstandingDebtCents -
    totalExitCostsCents;
  const totalInvestorProceedsCents =
    netSaleProceedsCents + cumulativeCashflowCents;
  const modeledProfitCents =
    totalInvestorProceedsCents - input.originallyInvestedEquityCents;

  return {
    expectedSalePriceCents: input.expectedSalePriceCents,
    outstandingDebtCents,
    totalExitCostsCents,
    netSaleProceedsCents,
    cumulativeCashflowCents,
    totalInvestorProceedsCents,
    modeledProfitCents,
    equityMultiple: roundRatio(
      divideOrNull(
        totalInvestorProceedsCents,
        input.originallyInvestedEquityCents,
      ),
      4,
    ),
    totalReturnOnEquity: roundRatio(
      divideOrNull(
        modeledProfitCents,
        input.originallyInvestedEquityCents,
      ),
    ),
    explanation:
      "Erwarteter Preis abzüglich Restschulden und aller manuell hinterlegten Exit-Kosten; kumulierter Cashflow wird anschließend addiert.",
    disclaimer:
      "Unverbindliches Verkaufsszenario auf Basis der Eingaben, keine Verkaufs-, Rechts- oder Steuerberatung.",
  };
}
