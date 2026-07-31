import {
  assertMoneyCents,
  divideOrNull,
  roundRatio,
  sumCents,
} from "./money";
import type { MoneyCents } from "./types";

export interface OperatingCashflowInput {
  operatingIncomeCents: readonly MoneyCents[];
  operatingExpensesCents: readonly MoneyCents[];
}

export interface FinancingCashflowInput {
  operatingCashflowCents: MoneyCents;
  interestPaidCents: MoneyCents;
  principalPaidCents: MoneyCents;
  otherFinancingCostsCents?: MoneyCents;
}

/** Bruttomietrendite = annual contractual cold rent / purchase price. */
export function calculateGrossRentalYield(input: {
  annualColdRentCents: MoneyCents;
  purchasePriceCents: MoneyCents;
}): number | null {
  assertMoneyCents(input.annualColdRentCents, "annualColdRentCents");
  assertMoneyCents(input.purchasePriceCents, "purchasePriceCents");
  return roundRatio(
    divideOrNull(input.annualColdRentCents, input.purchasePriceCents),
  );
}

/**
 * Nettomietrendite =
 * (annual rent - non-recoverable operating expenses) /
 * (purchase price + acquisition costs).
 */
export function calculateNetRentalYield(input: {
  annualRentCents: MoneyCents;
  annualNonRecoverableExpensesCents: MoneyCents;
  purchasePriceCents: MoneyCents;
  acquisitionCostsCents?: MoneyCents;
}): number | null {
  assertMoneyCents(input.annualRentCents, "annualRentCents");
  assertMoneyCents(
    input.annualNonRecoverableExpensesCents,
    "annualNonRecoverableExpensesCents",
  );
  assertMoneyCents(input.purchasePriceCents, "purchasePriceCents");
  const acquisitionCostsCents = input.acquisitionCostsCents ?? 0;
  assertMoneyCents(acquisitionCostsCents, "acquisitionCostsCents");

  const netOperatingIncome =
    input.annualRentCents - input.annualNonRecoverableExpensesCents;
  const investedCost = input.purchasePriceCents + acquisitionCostsCents;
  return roundRatio(divideOrNull(netOperatingIncome, investedCost));
}

/** Operativer Cashflow = cash operating income - cash operating expenses. */
export function calculateOperatingCashflowCents(
  input: OperatingCashflowInput,
): MoneyCents {
  const income = sumCents(input.operatingIncomeCents);
  const expenses = sumCents(input.operatingExpensesCents);
  return income - expenses;
}

/**
 * Cashflow after financing = operating cashflow - interest - principal -
 * other financing costs. Principal is deliberately included in liquidity.
 */
export function calculateCashflowAfterFinancingCents(
  input: FinancingCashflowInput,
): MoneyCents {
  assertMoneyCents(input.operatingCashflowCents, "operatingCashflowCents", {
    allowNegative: true,
  });
  assertMoneyCents(input.interestPaidCents, "interestPaidCents");
  assertMoneyCents(input.principalPaidCents, "principalPaidCents");
  const otherFinancingCostsCents = input.otherFinancingCostsCents ?? 0;
  assertMoneyCents(otherFinancingCostsCents, "otherFinancingCostsCents");

  return (
    input.operatingCashflowCents -
    input.interestPaidCents -
    input.principalPaidCents -
    otherFinancingCostsCents
  );
}

/**
 * Estimated cashflow after tax = cashflow before tax - estimated tax.
 * Tax uses this sign convention: positive = burden, negative = relief.
 */
export function calculateCashflowAfterTaxCents(input: {
  cashflowBeforeTaxCents: MoneyCents;
  estimatedTaxCents: MoneyCents;
}): MoneyCents {
  assertMoneyCents(input.cashflowBeforeTaxCents, "cashflowBeforeTaxCents", {
    allowNegative: true,
  });
  assertMoneyCents(input.estimatedTaxCents, "estimatedTaxCents", {
    allowNegative: true,
  });
  return input.cashflowBeforeTaxCents - input.estimatedTaxCents;
}

/** Eigenkapitalrendite = annual investor cashflow / invested equity. */
export function calculateReturnOnEquity(input: {
  annualCashflowCents: MoneyCents;
  investedEquityCents: MoneyCents;
}): number | null {
  assertMoneyCents(input.annualCashflowCents, "annualCashflowCents", {
    allowNegative: true,
  });
  assertMoneyCents(input.investedEquityCents, "investedEquityCents");
  return roundRatio(
    divideOrNull(input.annualCashflowCents, input.investedEquityCents),
  );
}

/** Kaufpreisfaktor = purchase price / annual cold rent. */
export function calculatePurchasePriceFactor(input: {
  purchasePriceCents: MoneyCents;
  annualColdRentCents: MoneyCents;
}): number | null {
  assertMoneyCents(input.purchasePriceCents, "purchasePriceCents");
  assertMoneyCents(input.annualColdRentCents, "annualColdRentCents");
  return roundRatio(
    divideOrNull(input.purchasePriceCents, input.annualColdRentCents),
    2,
  );
}
