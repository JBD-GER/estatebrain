import {
  assertDecimalRate,
  assertMoneyCents,
  assertPositive,
  divideOrNull,
  DomainValidationError,
  roundHalfAwayFromZero,
  roundRatio,
} from "./money";
import type { DecimalRate, IsoDate, MoneyCents } from "./types";

export interface LoanPaymentSplit {
  openingBalanceCents: MoneyCents;
  paymentCents: MoneyCents;
  interestCents: MoneyCents;
  principalCents: MoneyCents;
  closingBalanceCents: MoneyCents;
}

export interface ExtraLoanPayment {
  paymentNumber: number;
  amountCents: MoneyCents;
}

export interface AmortizationScheduleInput {
  principalCents: MoneyCents;
  annualInterestRate: DecimalRate;
  monthlyPaymentCents: MoneyCents;
  numberOfPayments: number;
  firstPaymentDate: IsoDate;
  extraPayments?: readonly ExtraLoanPayment[];
}

export interface AmortizationScheduleRow {
  paymentNumber: number;
  paymentDate: IsoDate;
  openingBalanceCents: MoneyCents;
  scheduledPaymentCents: MoneyCents;
  interestCents: MoneyCents;
  scheduledPrincipalCents: MoneyCents;
  extraPrincipalCents: MoneyCents;
  totalPaymentCents: MoneyCents;
  closingBalanceCents: MoneyCents;
}

/**
 * Constant annuity:
 * principal * monthlyRate / (1 - (1 + monthlyRate)^(-termMonths)).
 * At 0 % interest, principal is divided evenly across the term.
 */
export function calculateAnnuityPaymentCents(input: {
  principalCents: MoneyCents;
  annualInterestRate: DecimalRate;
  termMonths: number;
}): MoneyCents {
  assertMoneyCents(input.principalCents, "principalCents");
  assertDecimalRate(input.annualInterestRate, "annualInterestRate", {
    maximum: 10,
  });
  assertPositive(input.termMonths, "termMonths");
  if (!Number.isInteger(input.termMonths)) {
    throw new DomainValidationError(
      "termMonths muss ganzzahlig sein.",
      "termMonths",
    );
  }
  if (input.principalCents === 0) {
    return 0;
  }

  const monthlyRate = input.annualInterestRate / 12;
  const rawPayment =
    monthlyRate === 0
      ? input.principalCents / input.termMonths
      : (input.principalCents * monthlyRate) /
        (1 - (1 + monthlyRate) ** -input.termMonths);

  return roundHalfAwayFromZero(rawPayment);
}

/**
 * German initial-annuity convention:
 * monthly rate = principal * (interest rate + initial repayment rate) / 12.
 */
export function calculateInitialAnnuityPaymentCents(input: {
  principalCents: MoneyCents;
  annualInterestRate: DecimalRate;
  initialAnnualRepaymentRate: DecimalRate;
}): MoneyCents {
  assertMoneyCents(input.principalCents, "principalCents");
  assertDecimalRate(input.annualInterestRate, "annualInterestRate", {
    maximum: 10,
  });
  assertDecimalRate(
    input.initialAnnualRepaymentRate,
    "initialAnnualRepaymentRate",
    { maximum: 10 },
  );

  return roundHalfAwayFromZero(
    (input.principalCents *
      (input.annualInterestRate + input.initialAnnualRepaymentRate)) /
      12,
  );
}

/** Splits one payment using cent-rounded monthly interest. */
export function calculateLoanPaymentSplit(input: {
  openingBalanceCents: MoneyCents;
  annualInterestRate: DecimalRate;
  scheduledPaymentCents: MoneyCents;
}): LoanPaymentSplit {
  assertMoneyCents(input.openingBalanceCents, "openingBalanceCents");
  assertDecimalRate(input.annualInterestRate, "annualInterestRate", {
    maximum: 10,
  });
  assertMoneyCents(input.scheduledPaymentCents, "scheduledPaymentCents");

  if (input.openingBalanceCents === 0) {
    return {
      openingBalanceCents: 0,
      paymentCents: 0,
      interestCents: 0,
      principalCents: 0,
      closingBalanceCents: 0,
    };
  }

  const interestCents = roundHalfAwayFromZero(
    (input.openingBalanceCents * input.annualInterestRate) / 12,
  );
  if (input.scheduledPaymentCents < interestCents) {
    throw new DomainValidationError(
      "Die Rate deckt nicht einmal den berechneten Zins; eine Zinskapitalisierung wird nicht automatisch angenommen.",
      "scheduledPaymentCents",
    );
  }

  const paymentCents = Math.min(
    input.scheduledPaymentCents,
    input.openingBalanceCents + interestCents,
  );
  const principalCents = paymentCents - interestCents;
  return {
    openingBalanceCents: input.openingBalanceCents,
    paymentCents,
    interestCents,
    principalCents,
    closingBalanceCents: input.openingBalanceCents - principalCents,
  };
}

/**
 * Generates a deterministic cent-based interest and principal schedule.
 * Interest is rounded for each payment; the last installment is capped so the
 * balance can never become negative.
 */
export function generateAmortizationSchedule(
  input: AmortizationScheduleInput,
): AmortizationScheduleRow[] {
  assertMoneyCents(input.principalCents, "principalCents");
  assertDecimalRate(input.annualInterestRate, "annualInterestRate", {
    maximum: 10,
  });
  assertMoneyCents(input.monthlyPaymentCents, "monthlyPaymentCents");
  assertPositive(input.numberOfPayments, "numberOfPayments");
  if (!Number.isInteger(input.numberOfPayments)) {
    throw new DomainValidationError(
      "numberOfPayments muss ganzzahlig sein.",
      "numberOfPayments",
    );
  }
  assertIsoDate(input.firstPaymentDate, "firstPaymentDate");

  const extraByPayment = new Map<number, MoneyCents>();
  for (const extra of input.extraPayments ?? []) {
    if (!Number.isInteger(extra.paymentNumber) || extra.paymentNumber < 1) {
      throw new DomainValidationError(
        "paymentNumber einer Sondertilgung muss eine positive ganze Zahl sein.",
        "extraPayments.paymentNumber",
      );
    }
    assertMoneyCents(extra.amountCents, "extraPayments.amountCents");
    extraByPayment.set(
      extra.paymentNumber,
      (extraByPayment.get(extra.paymentNumber) ?? 0) + extra.amountCents,
    );
  }

  const rows: AmortizationScheduleRow[] = [];
  let balanceCents = input.principalCents;

  for (
    let paymentNumber = 1;
    paymentNumber <= input.numberOfPayments && balanceCents > 0;
    paymentNumber += 1
  ) {
    const split = calculateLoanPaymentSplit({
      openingBalanceCents: balanceCents,
      annualInterestRate: input.annualInterestRate,
      scheduledPaymentCents: input.monthlyPaymentCents,
    });
    const requestedExtra = extraByPayment.get(paymentNumber) ?? 0;
    const extraPrincipalCents = Math.min(
      requestedExtra,
      split.closingBalanceCents,
    );
    const closingBalanceCents =
      split.closingBalanceCents - extraPrincipalCents;

    rows.push({
      paymentNumber,
      paymentDate: addMonths(input.firstPaymentDate, paymentNumber - 1),
      openingBalanceCents: balanceCents,
      scheduledPaymentCents: split.paymentCents,
      interestCents: split.interestCents,
      scheduledPrincipalCents: split.principalCents,
      extraPrincipalCents,
      totalPaymentCents: split.paymentCents + extraPrincipalCents,
      closingBalanceCents,
    });
    balanceCents = closingBalanceCents;
  }

  return rows;
}

export function calculateLoanBalanceCents(
  input: AmortizationScheduleInput,
): MoneyCents {
  const schedule = generateAmortizationSchedule(input);
  return schedule.at(-1)?.closingBalanceCents ?? input.principalCents;
}

/** Loan-to-value = outstanding loan balance / current market value. */
export function calculateLoanToValue(input: {
  outstandingLoanCents: MoneyCents;
  marketValueCents: MoneyCents;
}): number | null {
  assertMoneyCents(input.outstandingLoanCents, "outstandingLoanCents");
  assertMoneyCents(input.marketValueCents, "marketValueCents");
  return roundRatio(
    divideOrNull(input.outstandingLoanCents, input.marketValueCents),
  );
}

/** DSCR = net operating income / total debt service for the same period. */
export function calculateDebtServiceCoverageRatio(input: {
  netOperatingIncomeCents: MoneyCents;
  debtServiceCents: MoneyCents;
}): number | null {
  assertMoneyCents(
    input.netOperatingIncomeCents,
    "netOperatingIncomeCents",
    { allowNegative: true },
  );
  assertMoneyCents(input.debtServiceCents, "debtServiceCents");
  return roundRatio(
    divideOrNull(input.netOperatingIncomeCents, input.debtServiceCents),
    4,
  );
}

function assertIsoDate(value: string, field: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new DomainValidationError(
      `${field} muss als YYYY-MM-DD angegeben werden.`,
      field,
    );
  }
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new DomainValidationError(`${field} ist kein gültiges Datum.`, field);
  }
}

function addMonths(date: IsoDate, monthsToAdd: number): IsoDate {
  const [year, month, day] = date.split("-").map(Number);
  const firstOfTargetMonth = new Date(
    Date.UTC(year, month - 1 + monthsToAdd, 1),
  );
  const lastDayOfTargetMonth = new Date(
    Date.UTC(
      firstOfTargetMonth.getUTCFullYear(),
      firstOfTargetMonth.getUTCMonth() + 1,
      0,
    ),
  ).getUTCDate();
  const result = new Date(
    Date.UTC(
      firstOfTargetMonth.getUTCFullYear(),
      firstOfTargetMonth.getUTCMonth(),
      Math.min(day, lastDayOfTargetMonth),
    ),
  );
  return [
    result.getUTCFullYear().toString().padStart(4, "0"),
    (result.getUTCMonth() + 1).toString().padStart(2, "0"),
    result.getUTCDate().toString().padStart(2, "0"),
  ].join("-");
}
