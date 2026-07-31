import {
  assertFiniteNonNegative,
  assertMoneyCents,
  assertPositive,
  divideOrNull,
  roundRatio,
  sumCents,
} from "./money";
import type { MoneyCents } from "./types";

export interface MonthlyLeaseRentInput {
  baseRentCents: MoneyCents;
  serviceChargeCents?: MoneyCents;
  parkingRentCents?: MoneyCents;
  otherRentCents?: MoneyCents;
}

export interface ExpectedRentItem {
  amountCents: MoneyCents | null;
  status?: "due" | "cancelled";
}

export interface ActualRentItem {
  amountCents: MoneyCents | null;
  status?: "booked" | "pending" | "reversed";
}

export interface RentTotalResult {
  totalCents: MoneyCents;
  includedItems: number;
  ignoredItems: number;
  missingItems: number;
}

export interface RentReconciliation {
  targetRentCents: MoneyCents;
  actualRentCents: MoneyCents;
  arrearsCents: MoneyCents;
  overpaymentCents: MoneyCents;
  coverageRatio: number | null;
}

/**
 * Monthly contractual rent = base rent + service charge + parking + other rent.
 * Optional components are explicitly treated as zero.
 */
export function calculateMonthlyLeaseRentCents(
  input: MonthlyLeaseRentInput,
): MoneyCents {
  assertMoneyCents(input.baseRentCents, "baseRentCents");
  const optionalComponents = [
    input.serviceChargeCents ?? 0,
    input.parkingRentCents ?? 0,
    input.otherRentCents ?? 0,
  ];
  optionalComponents.forEach((value, index) =>
    assertMoneyCents(value, `rentComponent[${index}]`),
  );

  return sumCents([input.baseRentCents, ...optionalComponents]);
}

/**
 * Sollmiete = sum of all due rent items.
 *
 * `null` amounts are not silently converted to zero. They are counted in
 * `missingItems`, allowing the caller to show incomplete source data.
 */
export function calculateTargetRent(
  items: readonly ExpectedRentItem[],
): RentTotalResult {
  let includedItems = 0;
  let ignoredItems = 0;
  let missingItems = 0;
  const amounts: MoneyCents[] = [];

  for (const item of items) {
    if (item.status === "cancelled") {
      ignoredItems += 1;
      continue;
    }
    if (item.amountCents === null) {
      missingItems += 1;
      continue;
    }
    assertMoneyCents(item.amountCents, "expectedRent.amountCents");
    includedItems += 1;
    amounts.push(item.amountCents);
  }

  return {
    totalCents: sumCents(amounts),
    includedItems,
    ignoredItems,
    missingItems,
  };
}

/** Ist-Miete = sum of booked payments; pending/reversed payments are excluded. */
export function calculateActualRent(
  payments: readonly ActualRentItem[],
): RentTotalResult {
  let includedItems = 0;
  let ignoredItems = 0;
  let missingItems = 0;
  const amounts: MoneyCents[] = [];

  for (const payment of payments) {
    if (
      payment.status === "pending" ||
      payment.status === "reversed"
    ) {
      ignoredItems += 1;
      continue;
    }
    if (payment.amountCents === null) {
      missingItems += 1;
      continue;
    }
    assertMoneyCents(payment.amountCents, "payment.amountCents");
    includedItems += 1;
    amounts.push(payment.amountCents);
  }

  return {
    totalCents: sumCents(amounts),
    includedItems,
    ignoredItems,
    missingItems,
  };
}

/**
 * Mietrückstand never becomes negative. Any excess is reported separately as
 * overpayment, so partial payments and overpayments remain visible.
 */
export function calculateRentReconciliation(
  targetRentCents: MoneyCents,
  actualRentCents: MoneyCents,
): RentReconciliation {
  assertMoneyCents(targetRentCents, "targetRentCents");
  assertMoneyCents(actualRentCents, "actualRentCents");

  const difference = targetRentCents - actualRentCents;
  return {
    targetRentCents,
    actualRentCents,
    arrearsCents: Math.max(0, difference),
    overpaymentCents: Math.max(0, -difference),
    coverageRatio: roundRatio(
      divideOrNull(actualRentCents, targetRentCents),
    ),
  };
}

export function calculateRentArrearsCents(
  targetRentCents: MoneyCents,
  actualRentCents: MoneyCents,
): MoneyCents {
  return calculateRentReconciliation(targetRentCents, actualRentCents)
    .arrearsCents;
}

/**
 * Area-weighted vacancy = vacant lettable area / total lettable area.
 * A portfolio without lettable area returns null.
 */
export function calculateVacancyRateByArea(input: {
  vacantAreaSquareMeters: number;
  totalAreaSquareMeters: number;
}): number | null {
  assertFiniteNonNegative(
    input.vacantAreaSquareMeters,
    "vacantAreaSquareMeters",
  );
  assertFiniteNonNegative(input.totalAreaSquareMeters, "totalAreaSquareMeters");
  if (input.vacantAreaSquareMeters > input.totalAreaSquareMeters) {
    throw new RangeError(
      "vacantAreaSquareMeters darf totalAreaSquareMeters nicht überschreiten.",
    );
  }

  return roundRatio(
    divideOrNull(input.vacantAreaSquareMeters, input.totalAreaSquareMeters),
  );
}

/** Unit-weighted vacancy = vacant units / all lettable units. */
export function calculateVacancyRateByUnits(input: {
  vacantUnits: number;
  totalUnits: number;
}): number | null {
  for (const [field, value] of Object.entries(input)) {
    assertFiniteNonNegative(value, field);
    if (!Number.isInteger(value)) {
      throw new RangeError(`${field} muss ganzzahlig sein.`);
    }
  }
  if (input.vacantUnits > input.totalUnits) {
    throw new RangeError("vacantUnits darf totalUnits nicht überschreiten.");
  }

  return roundRatio(divideOrNull(input.vacantUnits, input.totalUnits));
}

export function calculateRentPerSquareMeterCents(input: {
  monthlyRentCents: MoneyCents;
  areaSquareMeters: number;
}): MoneyCents | null {
  assertMoneyCents(input.monthlyRentCents, "monthlyRentCents");
  assertFiniteNonNegative(input.areaSquareMeters, "areaSquareMeters");
  if (input.areaSquareMeters === 0) {
    return null;
  }

  return Math.round(input.monthlyRentCents / input.areaSquareMeters);
}

export function calculateCostPerSquareMeterCents(input: {
  costCents: MoneyCents;
  areaSquareMeters: number;
}): MoneyCents | null {
  assertMoneyCents(input.costCents, "costCents");
  assertFiniteNonNegative(input.areaSquareMeters, "areaSquareMeters");
  if (input.areaSquareMeters === 0) {
    return null;
  }

  return Math.round(input.costCents / input.areaSquareMeters);
}

/** Helper for callers that require a strictly positive area. */
export function assertLettableArea(areaSquareMeters: number): void {
  assertPositive(areaSquareMeters, "areaSquareMeters");
}
