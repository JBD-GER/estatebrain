import type { DecimalRate, MoneyCents } from "./types";

export class DomainValidationError extends Error {
  readonly field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = "DomainValidationError";
    this.field = field;
  }
}

/**
 * Monetary rounding rule used throughout Estate Brain:
 * round to the nearest cent; exact half cents are rounded away from zero.
 */
export function roundHalfAwayFromZero(value: number): number {
  if (!Number.isFinite(value)) {
    throw new DomainValidationError("Der zu rundende Wert muss endlich sein.");
  }

  return value < 0
    ? -Math.round(Math.abs(value) + Number.EPSILON)
    : Math.round(value + Number.EPSILON);
}

export function toCents(euros: number): MoneyCents {
  if (!Number.isFinite(euros)) {
    throw new DomainValidationError("Der Eurobetrag muss endlich sein.", "euros");
  }

  // Move binary floating-point representations such as 1.005 minimally toward
  // their mathematical value before scaling.
  const adjustedEuros = euros + Math.sign(euros) * Number.EPSILON;
  const cents = roundHalfAwayFromZero(adjustedEuros * 100);
  assertMoneyCents(cents, "euros", { allowNegative: true });
  return cents;
}

export function fromCents(cents: MoneyCents): number {
  assertMoneyCents(cents, "cents", { allowNegative: true });
  return cents / 100;
}

export function assertMoneyCents(
  value: unknown,
  field = "amountCents",
  options: { allowNegative?: boolean } = {},
): asserts value is MoneyCents {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    (!options.allowNegative && value < 0)
  ) {
    const signRule = options.allowNegative ? "" : " und nicht negativ";
    throw new DomainValidationError(
      `${field} muss ein sicherer ganzzahliger Centbetrag${signRule} sein.`,
      field,
    );
  }
}

export function assertFiniteNonNegative(
  value: unknown,
  field: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new DomainValidationError(
      `${field} muss eine endliche, nicht negative Zahl sein.`,
      field,
    );
  }
}

export function assertPositive(
  value: unknown,
  field: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new DomainValidationError(
      `${field} muss eine endliche Zahl größer als null sein.`,
      field,
    );
  }
}

export function assertDecimalRate(
  value: unknown,
  field: string,
  options: { maximum?: number } = {},
): asserts value is DecimalRate {
  const maximum = options.maximum ?? 1;
  if (
    typeof value !== "number" ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > maximum
  ) {
    throw new DomainValidationError(
      `${field} muss als Dezimalwert zwischen 0 und ${maximum} angegeben werden.`,
      field,
    );
  }
}

export function sumCents(
  values: readonly MoneyCents[],
  options: { allowNegative?: boolean } = {},
): MoneyCents {
  let total = 0;

  for (const [index, value] of values.entries()) {
    assertMoneyCents(value, `values[${index}]`, options);
    total += value;
    if (!Number.isSafeInteger(total)) {
      throw new DomainValidationError(
        "Die Summe überschreitet den sicheren Zahlenbereich.",
      );
    }
  }

  return total;
}

export function multiplyCents(
  cents: MoneyCents,
  multiplier: number,
): MoneyCents {
  assertMoneyCents(cents, "cents", { allowNegative: true });
  if (!Number.isFinite(multiplier)) {
    throw new DomainValidationError(
      "Der Multiplikator muss endlich sein.",
      "multiplier",
    );
  }

  const result = roundHalfAwayFromZero(cents * multiplier);
  assertMoneyCents(result, "result", { allowNegative: true });
  return result;
}

/**
 * Ratios with a zero denominator deliberately return null. This prevents the UI
 * from showing a misleading 0 % when the metric is actually not calculable.
 */
export function divideOrNull(
  numerator: number,
  denominator: number,
): number | null {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator)) {
    throw new DomainValidationError("Zähler und Nenner müssen endlich sein.");
  }

  return denominator === 0 ? null : numerator / denominator;
}

export function roundRatio(
  value: number | null,
  decimalPlaces = 6,
): number | null {
  if (value === null) {
    return null;
  }
  if (!Number.isInteger(decimalPlaces) || decimalPlaces < 0 || decimalPlaces > 12) {
    throw new DomainValidationError(
      "decimalPlaces muss eine ganze Zahl zwischen 0 und 12 sein.",
      "decimalPlaces",
    );
  }

  const factor = 10 ** decimalPlaces;
  return roundHalfAwayFromZero(value * factor) / factor;
}

export function clamp(value: number, minimum: number, maximum: number): number {
  if (
    !Number.isFinite(value) ||
    !Number.isFinite(minimum) ||
    !Number.isFinite(maximum) ||
    minimum > maximum
  ) {
    throw new DomainValidationError("Ungültiger Wertebereich.");
  }
  return Math.min(maximum, Math.max(minimum, value));
}
