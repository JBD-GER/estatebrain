import {
  assertDecimalRate,
  assertMoneyCents,
  DomainValidationError,
  multiplyCents,
  roundHalfAwayFromZero,
  sumCents,
} from "./money";
import type { DecimalRate, IsoDate, MoneyCents } from "./types";

export const TAX_ESTIMATE_DISCLAIMER =
  "Unverbindliche Modellrechnung. Estate Brain ersetzt keine Beratung durch einen Steuerberater.";

export interface DepreciableComponent {
  label: string;
  basisCents: MoneyCents;
  placedInServiceDate: IsoDate;
  annualRate?: DecimalRate;
}

export interface DepreciationInput {
  taxYear: number;
  buildingBasisCents: MoneyCents;
  placedInServiceDate: IsoDate;
  annualRate: DecimalRate;
  additionalComponents?: readonly DepreciableComponent[];
  manualAdjustmentCents?: MoneyCents;
}

export interface DepreciationBreakdown {
  label: string;
  basisCents: MoneyCents;
  annualRate: DecimalRate;
  monthsInTaxYear: number;
  fullYearDepreciationCents: MoneyCents;
  taxYearDepreciationCents: MoneyCents;
}

export interface DepreciationResult {
  taxYear: number;
  totalBasisCents: MoneyCents;
  monthsForBuilding: number;
  depreciationBeforeAdjustmentCents: MoneyCents;
  manualAdjustmentCents: MoneyCents;
  depreciationCents: MoneyCents;
  breakdown: DepreciationBreakdown[];
  assumption: string;
}

export interface EstimatedTaxEffect {
  status: "estimated" | "missing_tax_rate";
  taxableResultCents: MoneyCents;
  taxRate: DecimalRate | null;
  estimatedTaxCents: MoneyCents | null;
  cashflowImpactCents: MoneyCents | null;
  explanation: string;
  disclaimer: string;
}

export interface TaxCashflowInput {
  rentalIncomeCents: MoneyCents;
  otherOperatingIncomeCents?: MoneyCents;
  cashOperatingExpensesCents: MoneyCents;
  deductibleOperatingExpensesCents: MoneyCents;
  interestPaidCents: MoneyCents;
  principalPaidCents: MoneyCents;
  otherFinancingCostsCents?: MoneyCents;
  depreciationCents: MoneyCents;
  otherDeductibleExpensesCents?: MoneyCents;
  taxRate: DecimalRate | null;
  lossOffsetAllowed?: boolean;
}

export interface TaxCashflowResult {
  operatingIncomeCents: MoneyCents;
  cashOperatingExpensesCents: MoneyCents;
  operatingSurplusCents: MoneyCents;
  interestPaidCents: MoneyCents;
  principalPaidCents: MoneyCents;
  cashflowBeforeTaxCents: MoneyCents;
  taxableResultCents: MoneyCents;
  estimatedTax: EstimatedTaxEffect;
  cashflowAfterEstimatedTaxCents: MoneyCents | null;
  liquidityExplanation: string;
  taxExplanation: string;
}

export type GermanTaxAssessmentType = "individual" | "joint";

export interface GermanIncomeTaxEstimate {
  taxYear: 2026;
  assessmentType: GermanTaxAssessmentType;
  otherTaxableIncomeCents: MoneyCents;
  taxableRentalResultCents: MoneyCents;
  taxableIncomeCents: MoneyCents;
  incomeTaxBeforeRentalCents: MoneyCents;
  incomeTaxAfterRentalCents: MoneyCents;
  estimatedRentalTaxEffectCents: MoneyCents;
  effectiveTaxRate: DecimalRate;
  marginalTaxRate: DecimalRate;
  explanation: string;
  disclaimer: string;
}

/**
 * Tarifliche Einkommensteuer 2026 nach § 32a Abs. 1 und 5 EStG.
 *
 * Das zu versteuernde Einkommen und die tarifliche Steuer werden wie im
 * Gesetz auf volle Euro abgerundet. Kirchensteuer, Solidaritätszuschlag,
 * Progressionsvorbehalt und individuelle Abzüge sind nicht enthalten.
 */
export function calculateGermanIncomeTax2026Cents(input: {
  taxableIncomeCents: MoneyCents;
  assessmentType: GermanTaxAssessmentType;
}): MoneyCents {
  assertMoneyCents(input.taxableIncomeCents, "taxableIncomeCents");
  const taxableIncomeEuros = Math.floor(input.taxableIncomeCents / 100);
  const divisor = input.assessmentType === "joint" ? 2 : 1;
  const tariffIncomeEuros = Math.floor(taxableIncomeEuros / divisor);
  const tariffTaxEuros = germanBasicIncomeTax2026Euros(
    tariffIncomeEuros,
  );
  return tariffTaxEuros * divisor * 100;
}

/**
 * Berechnet die zusätzliche tarifliche Steuerwirkung des steuerlichen
 * Vermietungsergebnisses. Der Grenzsteuersatz wird als nachvollziehbare
 * 100-Euro-Differenz am gesamten zvE ermittelt und nicht manuell abgefragt.
 */
export function calculateGermanRentalTaxEstimate2026(input: {
  otherTaxableIncomeCents: MoneyCents;
  taxableRentalResultCents: MoneyCents;
  assessmentType: GermanTaxAssessmentType;
}): GermanIncomeTaxEstimate {
  assertMoneyCents(
    input.otherTaxableIncomeCents,
    "otherTaxableIncomeCents",
  );
  assertMoneyCents(
    input.taxableRentalResultCents,
    "taxableRentalResultCents",
    { allowNegative: true },
  );
  const taxableIncomeCents = Math.max(
    0,
    input.otherTaxableIncomeCents + input.taxableRentalResultCents,
  );
  const incomeTaxBeforeRentalCents = calculateGermanIncomeTax2026Cents({
    taxableIncomeCents: input.otherTaxableIncomeCents,
    assessmentType: input.assessmentType,
  });
  const incomeTaxAfterRentalCents = calculateGermanIncomeTax2026Cents({
    taxableIncomeCents,
    assessmentType: input.assessmentType,
  });
  const marginalProbeCents = 10_000;
  const taxAfterProbeCents = calculateGermanIncomeTax2026Cents({
    taxableIncomeCents: taxableIncomeCents + marginalProbeCents,
    assessmentType: input.assessmentType,
  });

  return {
    taxYear: 2026,
    assessmentType: input.assessmentType,
    otherTaxableIncomeCents: input.otherTaxableIncomeCents,
    taxableRentalResultCents: input.taxableRentalResultCents,
    taxableIncomeCents,
    incomeTaxBeforeRentalCents,
    incomeTaxAfterRentalCents,
    estimatedRentalTaxEffectCents:
      incomeTaxAfterRentalCents - incomeTaxBeforeRentalCents,
    effectiveTaxRate:
      taxableIncomeCents === 0
        ? 0
        : incomeTaxAfterRentalCents / taxableIncomeCents,
    marginalTaxRate:
      (taxAfterProbeCents - incomeTaxAfterRentalCents) /
      marginalProbeCents,
    explanation:
      input.assessmentType === "joint"
        ? "Tarif 2026 mit Splittingverfahren: Die Steuer auf die Hälfte des gemeinsamen zu versteuernden Einkommens wird verdoppelt."
        : "Tarifliche Einkommensteuer 2026 für Einzelveranlagung auf Basis des geschätzten zu versteuernden Einkommens.",
    disclaimer: TAX_ESTIMATE_DISCLAIMER,
  };
}

/** Gesetzlicher typisierter linearer AfA-Ausgangspunkt für Wohngebäude. */
export function recommendedResidentialBuildingDepreciationRate(
  constructionYear: number,
): DecimalRate {
  if (
    !Number.isInteger(constructionYear) ||
    constructionYear < 1000 ||
    constructionYear > 2200
  ) {
    throw new DomainValidationError(
      "constructionYear muss ein gültiges Baujahr sein.",
      "constructionYear",
    );
  }
  if (constructionYear < 1925) return 0.025;
  if (constructionYear < 2023) return 0.02;
  return 0.03;
}

/**
 * Typisierter AfA-Ausgangspunkt anhand der Nutzung. Für Gewerbe ist das
 * Baujahr nur eine Näherung für den gesetzlich maßgeblichen Bauantrag; der
 * Wert bleibt deshalb ausdrücklich eine editierbare Modellannahme.
 */
export function recommendedBuildingDepreciationRate(
  propertyType: string,
  constructionYear: number,
): DecimalRate {
  if (propertyType !== "commercial") {
    return recommendedResidentialBuildingDepreciationRate(constructionYear);
  }
  if (
    !Number.isInteger(constructionYear) ||
    constructionYear < 1000 ||
    constructionYear > 2200
  ) {
    throw new DomainValidationError(
      "constructionYear muss ein gültiges Baujahr sein.",
      "constructionYear",
    );
  }
  return constructionYear > 1985 ? 0.03 : 0.025;
}

function germanBasicIncomeTax2026Euros(taxableIncomeEuros: number) {
  if (taxableIncomeEuros <= 12_348) return 0;
  let tax: number;
  if (taxableIncomeEuros <= 17_799) {
    const y = (taxableIncomeEuros - 12_348) / 10_000;
    tax = (914.51 * y + 1_400) * y;
  } else if (taxableIncomeEuros <= 69_878) {
    const z = (taxableIncomeEuros - 17_799) / 10_000;
    tax = (173.1 * z + 2_397) * z + 1_034.87;
  } else if (taxableIncomeEuros <= 277_825) {
    tax = 0.42 * taxableIncomeEuros - 11_135.63;
  } else {
    tax = 0.45 * taxableIncomeEuros - 19_470.38;
  }
  return Math.max(0, Math.floor(tax));
}

/**
 * Straight-line depreciation with an editable monthly pro-rata assumption.
 *
 * In the first tax year, the month of commissioning counts as a full month.
 * The result is calculated per component, rounded to cents, then summed.
 * A manual adjustment is applied last and the result is floored at zero.
 */
export function calculateDepreciation(
  input: DepreciationInput,
): DepreciationResult {
  if (
    !Number.isInteger(input.taxYear) ||
    input.taxYear < 1900 ||
    input.taxYear > 9999
  ) {
    throw new DomainValidationError(
      "taxYear muss ein gültiges vierstelliges Jahr sein.",
      "taxYear",
    );
  }
  assertMoneyCents(input.buildingBasisCents, "buildingBasisCents");
  assertDecimalRate(input.annualRate, "annualRate", { maximum: 1 });
  assertIsoDate(input.placedInServiceDate, "placedInServiceDate");
  const manualAdjustmentCents = input.manualAdjustmentCents ?? 0;
  assertMoneyCents(manualAdjustmentCents, "manualAdjustmentCents", {
    allowNegative: true,
  });

  const components: DepreciableComponent[] = [
    {
      label: "Gebäude",
      basisCents: input.buildingBasisCents,
      placedInServiceDate: input.placedInServiceDate,
      annualRate: input.annualRate,
    },
    ...(input.additionalComponents ?? []),
  ];

  const breakdown = components.map((component, index) => {
    assertMoneyCents(
      component.basisCents,
      `additionalComponents[${index}].basisCents`,
    );
    assertIsoDate(
      component.placedInServiceDate,
      `additionalComponents[${index}].placedInServiceDate`,
    );
    const annualRate = component.annualRate ?? input.annualRate;
    assertDecimalRate(
      annualRate,
      `additionalComponents[${index}].annualRate`,
      { maximum: 1 },
    );
    const monthsInTaxYear = depreciableMonths(
      input.taxYear,
      component.placedInServiceDate,
    );
    const fullYearDepreciationCents = multiplyCents(
      component.basisCents,
      annualRate,
    );
    const taxYearDepreciationCents = roundHalfAwayFromZero(
      (component.basisCents * annualRate * monthsInTaxYear) / 12,
    );
    return {
      label: component.label,
      basisCents: component.basisCents,
      annualRate,
      monthsInTaxYear,
      fullYearDepreciationCents,
      taxYearDepreciationCents,
    };
  });

  const depreciationBeforeAdjustmentCents = sumCents(
    breakdown.map((item) => item.taxYearDepreciationCents),
  );
  const adjustedDepreciationCents = sumCents(
    [depreciationBeforeAdjustmentCents, manualAdjustmentCents],
    { allowNegative: true },
  );
  const depreciationCents = Math.max(0, adjustedDepreciationCents);

  return {
    taxYear: input.taxYear,
    totalBasisCents: sumCents(components.map((item) => item.basisCents)),
    monthsForBuilding: breakdown[0]?.monthsInTaxYear ?? 0,
    depreciationBeforeAdjustmentCents,
    manualAdjustmentCents,
    depreciationCents,
    breakdown,
    assumption:
      "Lineare Abschreibung; im Erstjahr monatsgenau einschließlich des Monats der Nutzungsaufnahme. Werte und steuerliche Einordnung sind editierbare Annahmen.",
  };
}

/**
 * Taxable rental result = taxable income - deductible operating expenses -
 * loan interest - depreciation - other deductible expenses.
 *
 * Principal repayments never enter this function.
 */
export function calculateTaxableResultCents(input: {
  taxableRentalIncomeCents: MoneyCents;
  deductibleOperatingExpensesCents: MoneyCents;
  loanInterestCents: MoneyCents;
  depreciationCents: MoneyCents;
  otherDeductibleExpensesCents?: MoneyCents;
}): MoneyCents {
  assertMoneyCents(
    input.taxableRentalIncomeCents,
    "taxableRentalIncomeCents",
  );
  assertMoneyCents(
    input.deductibleOperatingExpensesCents,
    "deductibleOperatingExpensesCents",
  );
  assertMoneyCents(input.loanInterestCents, "loanInterestCents");
  assertMoneyCents(input.depreciationCents, "depreciationCents");
  const otherDeductibleExpensesCents =
    input.otherDeductibleExpensesCents ?? 0;
  assertMoneyCents(
    otherDeductibleExpensesCents,
    "otherDeductibleExpensesCents",
  );

  return (
    input.taxableRentalIncomeCents -
    input.deductibleOperatingExpensesCents -
    input.loanInterestCents -
    input.depreciationCents -
    otherDeductibleExpensesCents
  );
}

/**
 * Positive tax means an estimated payment, negative tax an estimated relief.
 * If no tax rate is available the result stays null instead of assuming 0 %.
 */
export function calculateEstimatedTaxEffect(input: {
  taxableResultCents: MoneyCents;
  taxRate: DecimalRate | null;
  lossOffsetAllowed?: boolean;
}): EstimatedTaxEffect {
  assertMoneyCents(input.taxableResultCents, "taxableResultCents", {
    allowNegative: true,
  });
  if (input.taxRate === null) {
    return {
      status: "missing_tax_rate",
      taxableResultCents: input.taxableResultCents,
      taxRate: null,
      estimatedTaxCents: null,
      cashflowImpactCents: null,
      explanation:
        "Keine Steuerwirkung berechnet, weil keine Steuerannahme hinterlegt ist.",
      disclaimer: TAX_ESTIMATE_DISCLAIMER,
    };
  }
  assertDecimalRate(input.taxRate, "taxRate", { maximum: 1 });
  const lossOffsetAllowed = input.lossOffsetAllowed ?? true;
  const taxableBaseCents =
    input.taxableResultCents < 0 && !lossOffsetAllowed
      ? 0
      : input.taxableResultCents;
  const estimatedTaxCents = multiplyCents(taxableBaseCents, input.taxRate);

  return {
    status: "estimated",
    taxableResultCents: input.taxableResultCents,
    taxRate: input.taxRate,
    estimatedTaxCents,
    cashflowImpactCents: -estimatedTaxCents,
    explanation:
      taxableBaseCents < 0
        ? "Der modellierte Verlust erzeugt bei angenommener Verlustverrechnung eine geschätzte Entlastung."
        : "Das positive steuerliche Ergebnis erzeugt eine geschätzte Steuerbelastung.",
    disclaimer: TAX_ESTIMATE_DISCLAIMER,
  };
}

/**
 * Full tax-cashflow bridge. Cash expenses and deductible expenses are separate
 * inputs by design. Interest affects cash and tax; principal affects only cash.
 */
export function calculateTaxCashflow(
  input: TaxCashflowInput,
): TaxCashflowResult {
  const nonNegativeMoneyFields = [
    ["rentalIncomeCents", input.rentalIncomeCents],
    ["otherOperatingIncomeCents", input.otherOperatingIncomeCents ?? 0],
    ["cashOperatingExpensesCents", input.cashOperatingExpensesCents],
    [
      "deductibleOperatingExpensesCents",
      input.deductibleOperatingExpensesCents,
    ],
    ["interestPaidCents", input.interestPaidCents],
    ["principalPaidCents", input.principalPaidCents],
    ["otherFinancingCostsCents", input.otherFinancingCostsCents ?? 0],
    ["depreciationCents", input.depreciationCents],
    [
      "otherDeductibleExpensesCents",
      input.otherDeductibleExpensesCents ?? 0,
    ],
  ] as const;
  for (const [field, value] of nonNegativeMoneyFields) {
    assertMoneyCents(value, field);
  }

  const otherOperatingIncomeCents = input.otherOperatingIncomeCents ?? 0;
  const otherFinancingCostsCents = input.otherFinancingCostsCents ?? 0;
  const otherDeductibleExpensesCents =
    input.otherDeductibleExpensesCents ?? 0;
  const operatingIncomeCents =
    input.rentalIncomeCents + otherOperatingIncomeCents;
  const operatingSurplusCents =
    operatingIncomeCents - input.cashOperatingExpensesCents;
  const cashflowBeforeTaxCents =
    operatingSurplusCents -
    input.interestPaidCents -
    input.principalPaidCents -
    otherFinancingCostsCents;
  const taxableResultCents = calculateTaxableResultCents({
    taxableRentalIncomeCents: operatingIncomeCents,
    deductibleOperatingExpensesCents:
      input.deductibleOperatingExpensesCents,
    loanInterestCents: input.interestPaidCents,
    depreciationCents: input.depreciationCents,
    otherDeductibleExpensesCents,
  });
  const estimatedTax = calculateEstimatedTaxEffect({
    taxableResultCents,
    taxRate: input.taxRate,
    lossOffsetAllowed: input.lossOffsetAllowed,
  });

  return {
    operatingIncomeCents,
    cashOperatingExpensesCents: input.cashOperatingExpensesCents,
    operatingSurplusCents,
    interestPaidCents: input.interestPaidCents,
    principalPaidCents: input.principalPaidCents,
    cashflowBeforeTaxCents,
    taxableResultCents,
    estimatedTax,
    cashflowAfterEstimatedTaxCents:
      estimatedTax.estimatedTaxCents === null
        ? null
        : cashflowBeforeTaxCents - estimatedTax.estimatedTaxCents,
    liquidityExplanation:
      "Liquidität: Einnahmen minus laufende Cash-Ausgaben, Zinsen, Tilgung und sonstige Finanzierungskosten.",
    taxExplanation:
      "Steuermodell: steuerpflichtige Einnahmen minus abzugsfähige Ausgaben, Zinsen, AfA und sonstige berücksichtigte Aufwendungen; Tilgung ist ausgeschlossen.",
  };
}

function depreciableMonths(taxYear: number, placedInServiceDate: IsoDate): number {
  const [startYear, startMonth] = placedInServiceDate.split("-").map(Number);
  if (taxYear < startYear) {
    return 0;
  }
  if (taxYear > startYear) {
    return 12;
  }
  return 13 - startMonth;
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
