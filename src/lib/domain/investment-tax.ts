import { DomainValidationError, multiplyCents, sumCents } from "./money";
import { recommendedResidentialBuildingDepreciationRate } from "./tax";
import type { DecimalRate, IsoDate, MoneyCents } from "./types";

/** All amounts are integer euro cents; all rates are decimal (0.42 = 42%). */
export interface InvestmentTaxInput {
  purchasePriceCents: MoneyCents;
  acquisitionCostsCents: MoneyCents;
  landShareRate: DecimalRate;
  /** Building-only costs, net of grants, not already in purchase price. */
  capitalizedMeasuresCents: MoneyCents;
  completionDate: IsoDate;
  /** Economic ownership / transfer of benefits and burdens, not contract date. */
  acquisitionDate: IsoDate;
  usage: "rented" | "owner_occupied";
  propertyKind: "existing" | "new_build" | "heritage";
  marginalTaxRate: DecimalRate;
  years: number;
  contractDate?: IsoDate;
  /** Confirms qualifying EU/EEA residential purchase and absence of exclusions. */
  degressiveEligibilityConfirmed?: boolean;
  /** NET eligible costs ALREADY INCLUDED in the building basis, never additive. */
  certifiedHeritageCostsCents?: MoneyCents;
  heritageCompletionDate?: IsoDate;
  /** Domestic monument, authority coordination/certificate, grants deducted;
   * qualifying works after purchase contract; for §10f also object restrictions. */
  heritageEligibilityConfirmed?: boolean;
  special7bEnabled?: boolean;
  buildingApplicationDate?: IsoDate;
  /** Relevant eligible residential/useful area per BMF, not entire plot area. */
  livingAreaSquareMeters?: number;
  /** New qualifying dwelling, geography and applicable state-aid rules verified. */
  special7bEligibilityConfirmed?: boolean;
  /** Efficiency House 40 with sustainability class AND QNG certificate. */
  qngCertified?: boolean;
  tenYearRentalConfirmed?: boolean;
  autoSwitchToLinear?: boolean;
}

export type InvestmentTaxScenarioId =
  | "linear" | "degressive" | "linear_7b" | "degressive_7b"
  | "heritage" | "owner_occupied";

export interface InvestmentTaxEligibility {
  eligible: boolean;
  reasons: string[];
}

export interface InvestmentTaxBasis {
  totalInvestmentCents: MoneyCents;
  landPurchasePriceCents: MoneyCents;
  landAcquisitionCostsCents: MoneyCents;
  buildingPurchasePriceCents: MoneyCents;
  buildingAcquisitionCostsCents: MoneyCents;
  buildingBasisCents: MoneyCents;
  regularBuildingBasisCents: MoneyCents;
  heritageBasisCents: MoneyCents;
  special7bBasisCents: MoneyCents;
  costPerSquareMeterCents: number | null;
}

export interface InvestmentTaxAnnualRow {
  year: number;
  /** One-based calendar-year index, starting at acquisition. */
  yearIndex: number;
  months: number;
  regularDepreciationCents: MoneyCents;
  specialDepreciationCents: MoneyCents;
  heritageDeductionCents: MoneyCents;
  totalDeductionCents: MoneyCents;
  taxSavingCents: MoneyCents;
  cumulativeDeductionCents: MoneyCents;
  cumulativeTaxSavingCents: MoneyCents;
  /** Unconsumed modeled building costs; for §10f not a tax book value. */
  remainingBasisCents: MoneyCents;
  method: string;
}

export interface InvestmentTaxScenario {
  id: InvestmentTaxScenarioId;
  label: string;
  method: string;
  annualRows: InvestmentTaxAnnualRow[];
  totalDeductionCents: MoneyCents;
  totalTaxSavingCents: MoneyCents;
  remainingBasisCents: MoneyCents;
  firstYearDeductionCents: MoneyCents;
  firstYearTaxSavingCents: MoneyCents;
  switchedToLinearYear: number | null;
}

export const INVESTMENT_TAX_VERIFIED_AT = "2026-09-22";

export const INVESTMENT_TAX_SOURCES = [
  { label: "§ 7 EStG · lineare und degressive AfA", url: "https://www.gesetze-im-internet.de/estg/__7.html" },
  { label: "§ 7b EStG · Sonderabschreibung", url: "https://www.gesetze-im-internet.de/estg/__7b.html" },
  { label: "§ 7i EStG · vermietetes Denkmal", url: "https://www.gesetze-im-internet.de/estg/__7i.html" },
  { label: "§ 10f EStG · selbst genutztes Denkmal", url: "https://www.gesetze-im-internet.de/estg/__10f.html" },
  { label: "§ 7a EStG · Restwert und Kumulationsverbot", url: "https://www.gesetze-im-internet.de/estg/__7a.html" },
  {
    label: "BMF vom 21.05.2025 · Anwendung des § 7b",
    url: "https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Steuerarten/Einkommensteuer/2025-05-21-anwendungsschreiben-7b-estg-neu.pdf?__blob=publicationFile&v=5",
  },
] as const;

export const DEFAULT_INVESTMENT_TAX_INPUT: InvestmentTaxInput = {
  purchasePriceCents: 45_000_000,
  acquisitionCostsCents: 4_500_000,
  landShareRate: 0.2,
  capitalizedMeasuresCents: 0,
  completionDate: "1995-01-01",
  acquisitionDate: "2026-07-01",
  usage: "rented",
  propertyKind: "existing",
  marginalTaxRate: 0.42,
  years: 20,
  certifiedHeritageCostsCents: 0,
  degressiveEligibilityConfirmed: false,
  heritageEligibilityConfirmed: false,
  special7bEnabled: false,
  special7bEligibilityConfirmed: false,
  qngCertified: false,
  tenYearRentalConfirmed: false,
  autoSwitchToLinear: true,
};

export interface InvestmentTaxValidationIssue {
  field: string;
  message: string;
}

export interface InvestmentTaxResult {
  basis: InvestmentTaxBasis;
  linearRate: DecimalRate;
  eligibility: {
    degressive: InvestmentTaxEligibility;
    special7b: InvestmentTaxEligibility;
    heritage: InvestmentTaxEligibility;
  };
  scenarios: InvestmentTaxScenario[];
  /** Highest modeled deduction benefit over the entered horizon, not advice. */
  recommendedScenarioId: InvestmentTaxScenarioId;
  warnings: string[];
  sources: typeof INVESTMENT_TAX_SOURCES;
  verifiedAt: string;
  disclaimer: string;
}

function isDate(value: unknown): value is IsoDate {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
    && Number(value.slice(0, 4)) >= 1000 && Number(value.slice(0, 4)) <= 2200;
}

/** Pure validation shared by the calculator and persistence; never coerces input. */
export function validateInvestmentTaxInput(input: InvestmentTaxInput): InvestmentTaxValidationIssue[] {
  const issues: InvestmentTaxValidationIssue[] = [];
  const add = (field: string, message: string) => issues.push({ field, message });
  for (const [field, label, value] of [
    ["purchasePriceCents", "Kaufpreis", input.purchasePriceCents],
    ["acquisitionCostsCents", "Kaufnebenkosten", input.acquisitionCostsCents],
    ["capitalizedMeasuresCents", "Aktivierungspflichtige Maßnahmen", input.capitalizedMeasuresCents],
    ["certifiedHeritageCostsCents", "Bescheinigte Denkmalkosten", input.certifiedHeritageCostsCents ?? 0],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < 0 || value > 1_000_000_000_000) {
      add(field, `${label}: Bitte einen Betrag zwischen 0 und 10 Milliarden Euro mit höchstens zwei Nachkommastellen eingeben.`);
    }
  }
  for (const [field, label, value, maximum] of [
    ["landShareRate", "Grundstücksanteil", input.landShareRate, 1],
    ["marginalTaxRate", "Grenzsteuersatz", input.marginalTaxRate, 0.6],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || value > maximum) add(field, `${label}: Bitte einen Wert zwischen 0 und ${maximum * 100} % eingeben.`);
  }
  if (!Number.isInteger(input.years) || input.years < 1 || input.years > 60) add("years", "Der Betrachtungszeitraum muss zwischen 1 und 60 Jahren liegen.");
  if (!["rented", "owner_occupied"].includes(input.usage)) add("usage", "Bitte Vermietung oder Eigennutzung wählen.");
  if (!["existing", "new_build", "heritage"].includes(input.propertyKind)) add("propertyKind", "Bitte Bestand, Neubau oder Denkmal wählen.");
  for (const [field, label] of [["completionDate", "Fertigstellung"], ["acquisitionDate", "Anschaffung"]] as const) {
    if (!isDate(input[field])) add(field, `${label}: Bitte ein gültiges Datum eingeben.`);
  }
  for (const [field, label] of [["contractDate", "Kaufvertrag"], ["heritageCompletionDate", "Abschluss der Denkmalmaßnahmen"], ["buildingApplicationDate", "Bauantrag / Bauanzeige"]] as const) {
    if (input[field] !== undefined && input[field] !== "" && !isDate(input[field])) add(field, `${label}: Bitte ein gültiges Datum eingeben.`);
  }
  for (const field of ["degressiveEligibilityConfirmed", "heritageEligibilityConfirmed", "special7bEnabled", "special7bEligibilityConfirmed", "qngCertified", "tenYearRentalConfirmed", "autoSwitchToLinear"] as const) {
    if (input[field] !== undefined && typeof input[field] !== "boolean") add(field, "Bestätigungen müssen als Ja-/Nein-Wert vorliegen.");
  }
  if (input.livingAreaSquareMeters !== undefined && (!Number.isFinite(input.livingAreaSquareMeters) || input.livingAreaSquareMeters < 0 || input.livingAreaSquareMeters > 1_000_000)) add("livingAreaSquareMeters", "Bitte eine gültige begünstigte Fläche zwischen 0 und 1.000.000 m² eingeben.");
  if (isDate(input.contractDate) && isDate(input.acquisitionDate) && input.contractDate > input.acquisitionDate) add("contractDate", "Der Kaufvertrag darf nicht nach der Anschaffung liegen.");
  if (isDate(input.buildingApplicationDate) && isDate(input.completionDate) && input.buildingApplicationDate > input.completionDate) add("buildingApplicationDate", "Der Bauantrag darf nicht nach der Fertigstellung liegen.");
  const certified = input.certifiedHeritageCostsCents ?? 0;
  if (certified > 0 && input.propertyKind !== "heritage") add("certifiedHeritageCostsCents", "Denkmalkosten können nur bei einem Denkmal eingegeben werden.");
  if (certified > 0 && !isDate(input.heritageCompletionDate)) add("heritageCompletionDate", "Für Denkmalkosten wird das Abschlussdatum der Maßnahmen benötigt.");
  if (certified > 0 && isDate(input.heritageCompletionDate) && isDate(input.acquisitionDate) && input.heritageCompletionDate < input.acquisitionDate) add("heritageCompletionDate", "Dieses Erwerbermodell benötigt den Abschluss der Denkmalmaßnahmen ab Anschaffung.");
  if (certified > 0 && isDate(input.heritageCompletionDate) && isDate(input.completionDate) && input.heritageCompletionDate < input.completionDate) add("heritageCompletionDate", "Denkmalmaßnahmen dürfen nicht vor der ursprünglichen Gebäudefertigstellung abgeschlossen sein.");
  if (issues.length === 0) {
    const basis = allocateBasis(input);
    if (certified > basis.buildingBasisCents) add("certifiedHeritageCostsCents", "Bescheinigte Denkmalkosten sind ein Teil der Gebäudekosten und dürfen die AfA-Bemessungsgrundlage nicht überschreiten.");
  }
  return issues;
}

function allocateBasis(input: InvestmentTaxInput): InvestmentTaxBasis {
  const landPurchasePriceCents = multiplyCents(input.purchasePriceCents, input.landShareRate);
  const landAcquisitionCostsCents = multiplyCents(input.acquisitionCostsCents, input.landShareRate);
  const buildingPurchasePriceCents = input.purchasePriceCents - landPurchasePriceCents;
  const buildingAcquisitionCostsCents = input.acquisitionCostsCents - landAcquisitionCostsCents;
  const buildingBasisCents = sumCents([buildingPurchasePriceCents, buildingAcquisitionCostsCents, input.capitalizedMeasuresCents]);
  const heritageBasisCents = input.certifiedHeritageCostsCents ?? 0;
  return {
    totalInvestmentCents: sumCents([input.purchasePriceCents, input.acquisitionCostsCents, input.capitalizedMeasuresCents]),
    landPurchasePriceCents, landAcquisitionCostsCents, buildingPurchasePriceCents,
    buildingAcquisitionCostsCents, buildingBasisCents, heritageBasisCents,
    regularBuildingBasisCents: buildingBasisCents - heritageBasisCents,
    special7bBasisCents: 0,
    costPerSquareMeterCents: input.livingAreaSquareMeters ? buildingBasisCents / input.livingAreaSquareMeters : null,
  };
}

function eligibility(reasons: string[]): InvestmentTaxEligibility {
  return { eligible: reasons.length === 0, reasons };
}

function yearOf(date: IsoDate) { return Number(date.slice(0, 4)); }
function monthOf(date: IsoDate) { return Number(date.slice(5, 7)); }
function monthsInYear(year: number, startDate: IsoDate) {
  return year < yearOf(startDate) ? 0 : year === yearOf(startDate) ? 13 - monthOf(startDate) : 12;
}

/** Purchase comparison for one fully residential dwelling / homogeneous asset.
 * Eligible options are alternatives, never additive to one another. */
export function calculateInvestmentTax(input: InvestmentTaxInput): InvestmentTaxResult {
  const issues = validateInvestmentTaxInput(input);
  if (issues.length) throw new DomainValidationError(issues[0].message, issues[0].field);
  const basis = allocateBasis(input);
  const linearRate = recommendedResidentialBuildingDepreciationRate(yearOf(input.completionDate));
  const startDate = input.acquisitionDate > input.completionDate ? input.acquisitionDate : input.completionDate;
  const purchasedNew = input.propertyKind === "new_build" && yearOf(input.acquisitionDate) === yearOf(input.completionDate)
    && input.acquisitionDate >= input.completionDate;
  const degressiveReasons: string[] = [];
  if (input.usage !== "rented") degressiveReasons.push("Degressive Gebäude-AfA setzt eine Nutzung zur Einkunftserzielung voraus.");
  if (!purchasedNew || linearRate !== 0.03) degressiveReasons.push("Dieses Erwerbermodell setzt einen Neubau ab 2023 und den Erwerb ab Fertigstellung bis zum Ende desselben Jahres voraus.");
  if (!input.contractDate || input.contractDate < "2023-10-01" || input.contractDate >= "2029-10-01") degressiveReasons.push("Der rechtswirksame Kaufvertrag muss zwischen dem 01.10.2023 und dem 30.09.2029 liegen.");
  if (!input.degressiveEligibilityConfirmed) degressiveReasons.push("Die weiteren Voraussetzungen für § 7 Abs. 5a (insbesondere Wohnnutzung und EU-/EWR-Belegenheit) sind noch nicht bestätigt.");

  const legacy7b = Boolean(input.buildingApplicationDate && input.buildingApplicationDate >= "2018-09-01" && input.buildingApplicationDate < "2022-01-01");
  const modern7b = Boolean(input.buildingApplicationDate && input.buildingApplicationDate >= "2023-01-01" && input.buildingApplicationDate < "2029-10-01");
  const specialReasons: string[] = [];
  if (!input.special7bEnabled) specialReasons.push("Die Sonderabschreibung nach § 7b ist nicht aktiviert.");
  if (input.usage !== "rented") specialReasons.push("§ 7b gilt für entgeltlich zu Wohnzwecken vermietete Wohnungen.");
  if (!purchasedNew) specialReasons.push("Für § 7b wird hier eine neue Wohnung mit Erwerb ab Fertigstellung im selben Kalenderjahr vorausgesetzt.");
  if (!legacy7b && !modern7b) specialReasons.push("Der Bauantrag muss im Zeitraum 01.09.2018–31.12.2021 oder 01.01.2023–30.09.2029 liegen.");
  if (legacy7b && yearOf(startDate) > 2026) specialReasons.push("Für Bauanträge von 2018 bis 2021 kann § 7b letztmals 2026 genutzt werden.");
  if (modern7b && !input.qngCertified) specialReasons.push("Für den Förderzeitraum ab 2023 werden Effizienzhaus 40 mit Nachhaltigkeits-Klasse und QNG-Nachweis benötigt.");
  if (!input.tenYearRentalConfirmed) specialReasons.push("Die entgeltliche Wohnraumvermietung im Erstjahr und den folgenden neun Jahren ist noch nicht bestätigt.");
  if (!input.special7bEligibilityConfirmed) specialReasons.push("Die weiteren §-7b-Voraussetzungen (neue Wohnung, begünstigter Standort, gegebenenfalls Beihilferecht) sind noch nicht bestätigt.");
  const costLimitCents = legacy7b ? 300_000 : 520_000;
  if (!input.livingAreaSquareMeters) specialReasons.push("Für § 7b wird die begünstigte Wohn-/Nutzfläche benötigt.");
  else if (basis.buildingBasisCents > multiplyCents(costLimitCents, input.livingAreaSquareMeters)) specialReasons.push(`Die Gebäudekosten überschreiten die §-7b-Baukostenobergrenze von ${legacy7b ? "3.000" : "5.200"} €/m²; die Sonderabschreibung entfällt vollständig.`);
  const heritageReasons: string[] = [];
  if (input.propertyKind !== "heritage") heritageReasons.push("Das Objekt ist nicht als Denkmal eingeordnet.");
  if (!basis.heritageBasisCents) heritageReasons.push("Es wurden noch keine begünstigten, bescheinigten Denkmalkosten eingegeben.");
  if (!input.heritageEligibilityConfirmed) heritageReasons.push("Bescheinigung, vorherige Abstimmung, Zuschussabzug und persönliche Voraussetzungen des Denkmalabzugs sind noch nicht bestätigt.");
  if (input.heritageCompletionDate && input.heritageCompletionDate < "2004-01-01") heritageReasons.push("Das 9-/7-%-Denkmalmodell bildet die aktuelle Förderung ab; historische Maßnahmen vor 2004 werden nicht berechnet.");
  const eligibilityResult = {
    degressive: eligibility(degressiveReasons),
    special7b: eligibility(specialReasons),
    heritage: eligibility(heritageReasons),
  };
  if (eligibilityResult.special7b.eligible) basis.special7bBasisCents = Math.min(basis.buildingBasisCents, multiplyCents(legacy7b ? 200_000 : 400_000, input.livingAreaSquareMeters!));

  const scenarioIds: InvestmentTaxScenarioId[] = input.usage === "rented" ? ["linear"] : ["owner_occupied"];
  if (eligibilityResult.degressive.eligible) scenarioIds.push("degressive");
  if (eligibilityResult.special7b.eligible) {
    scenarioIds.push("linear_7b");
    if (eligibilityResult.degressive.eligible) scenarioIds.push("degressive_7b");
  }
  if (eligibilityResult.heritage.eligible) scenarioIds.push("heritage");
  const scenarios = scenarioIds.map(id => buildSchedule(input, basis, linearRate, startDate, id, legacy7b));
  const best = scenarios.reduce((current, candidate) => candidate.totalTaxSavingCents > current.totalTaxSavingCents ? candidate : current);
  const warnings = [
    "Die Steuerentlastung ist der Abzugsbetrag × unveränderter Grenzsteuersatz. Ausreichende steuerpflichtige Einkünfte und gegebenenfalls sofortiger Verlustausgleich werden unterstellt; Progression, Soli und Kirchensteuer sind nicht enthalten.",
    "Der Grundstücksanteil wird auch auf allgemeine Kaufnebenkosten angewandt. Individuell zuordenbare Kosten, Förderung und die Kaufpreisaufteilung müssen gesondert geprüft werden.",
  ];
  if (input.capitalizedMeasuresCents > 0) warnings.push("Zusätzliche aktivierungspflichtige Maßnahmen sind einmalig und netto nach Zuschüssen berücksichtigt. Außer separat datierten Denkmalkosten gelten sie bei Beginn der Gebäude-AfA als fertiggestellt.");
  if (input.acquisitionDate < input.completionDate) warnings.push("Die normale AfA beginnt erst mit Fertigstellung. Ein eigener Herstellungsfall vor Fertigstellung wird für die Neubauförderungen in diesem Erwerbermodell nicht berechnet.");
  if (input.propertyKind === "new_build" && !eligibilityResult.degressive.eligible) warnings.push(...degressiveReasons);
  if (input.special7bEnabled && !eligibilityResult.special7b.eligible) warnings.push(...specialReasons);
  if (input.propertyKind === "heritage" && !eligibilityResult.heritage.eligible) warnings.push(...heritageReasons);
  if (input.usage === "owner_occupied") warnings.push("Bei Eigennutzung gibt es hier keine normale Gebäude-AfA. § 10f erfasst nur begünstigte Aufwendungen als Sonderausgaben; maximal 90 % in zehn Jahren. Der angezeigte Kostenrest ist kein steuerlicher Buchwert.");
  if (eligibilityResult.special7b.eligible) warnings.push("§ 7b wird mit dem Höchstsatz von 5 % modelliert. Nutzungswechsel, ein schädlicher Verkauf oder nachträgliche Überschreitung der Kostenobergrenze können eine Rückabwicklung auslösen.");
  if (eligibilityResult.heritage.eligible) warnings.push("Bescheinigte Denkmalkosten sind bereits Teil der Gebäudekosten. Sie werden aus der normalen AfA herausgelöst; eine zusätzliche §-7b-Förderung derselben Kosten wird nicht kombiniert.");
  return {
    basis, linearRate, eligibility: eligibilityResult, scenarios,
    recommendedScenarioId: best.id, warnings: [...new Set(warnings)],
    sources: INVESTMENT_TAX_SOURCES, verifiedAt: INVESTMENT_TAX_VERIFIED_AT,
    disclaimer: "Unverbindliche Modellrechnung für vollständig wohnwirtschaftlich genutzte Erwerbsobjekte. Keine Steuerberatung, Renditeprognose oder Zusage einer Steuererstattung.",
  };
}

function buildSchedule(
  input: InvestmentTaxInput, basis: InvestmentTaxBasis, linearRate: number,
  startDate: IsoDate, id: InvestmentTaxScenarioId, legacy7b: boolean,
): InvestmentTaxScenario {
  const degressive = id === "degressive" || id === "degressive_7b";
  const with7b = id === "linear_7b" || id === "degressive_7b";
  const withHeritage = id === "heritage";
  const selfUse = input.usage === "owner_occupied";
  const linearLabel = `${(linearRate * 100).toLocaleString("de-DE")} % linear`;
  const labels: Record<InvestmentTaxScenarioId, string> = {
    linear: linearLabel, degressive: "5 % degressiv",
    linear_7b: `${linearLabel} + § 7b`, degressive_7b: "5 % degressiv + § 7b",
    heritage: selfUse ? "Denkmal · § 10f" : "Denkmal · § 7i",
    owner_occupied: "Eigennutzung ohne Gebäude-AfA",
  };
  const firstYear = yearOf(input.acquisitionDate);
  const heritageStart = input.heritageCompletionDate || startDate;
  // The certified part has its own start even in the ordinary linear alternative.
  let regularRemaining = basis.regularBuildingBasisCents;
  let heritageRemaining = basis.heritageBasisCents;
  let regularCumulative = 0;
  let totalDeductionCents = 0;
  let totalTaxSavingCents = 0;
  let fixedRestValueAnnualCents: number | null = null;
  let switchedToLinearYear: number | null = null;
  // R 7a (9) EStR / BMF example 7b uses 33, 40 or 50 years for rest-value AfA.
  const restValueUsefulYears = linearRate === 0.03 ? 33 : linearRate === 0.025 ? 40 : 50;
  const annualRows: InvestmentTaxAnnualRow[] = [];
  for (let index = 0; index < input.years; index++) {
    const year = firstYear + index;
    const months = monthsInYear(year, startDate);
    const elapsedYears = Math.max(0, year - yearOf(startDate) - (monthOf(startDate) - 1) / 12);
    const remainingYears = Math.max(1 / 12, restValueUsefulYears - elapsedYears);
    const specialIndex = year - yearOf(startDate);
    const inSpecialPeriod = with7b && specialIndex >= 0 && specialIndex < 4;
    let regularDepreciationCents = 0;
    let specialDepreciationCents = 0;
    let heritageDeductionCents = 0;
    let method = labels[id];
    if (!selfUse && months > 0) {
      if (degressive) {
        // §7b does not reduce the running degressive basis during its first four
        // calendar years. At year five all special deductions enter the rest value.
        const runningBasis = inSpecialPeriod ? basis.regularBuildingBasisCents - regularCumulative : regularRemaining;
        const declining = multiplyCents(runningBasis, 0.05 * months / 12);
        const switchedAmount = multiplyCents(regularRemaining, 1 / remainingYears);
        if (input.autoSwitchToLinear !== false && !inSpecialPeriod && switchedToLinearYear === null && specialIndex > 0 && switchedAmount > declining) {
          switchedToLinearYear = year;
          fixedRestValueAnnualCents = switchedAmount;
        }
        regularDepreciationCents = fixedRestValueAnnualCents ?? declining;
        if (switchedToLinearYear !== null) method = "Linear ab Methodenwechsel";
      } else if (with7b && specialIndex >= 4) {
        fixedRestValueAnnualCents ??= multiplyCents(regularRemaining, 1 / remainingYears);
        regularDepreciationCents = fixedRestValueAnnualCents;
        method = "Lineare Restwert-AfA nach § 7a";
      } else {
        regularDepreciationCents = multiplyCents(basis.regularBuildingBasisCents, linearRate * months / 12);
      }
      regularDepreciationCents = Math.min(regularRemaining, regularDepreciationCents);
      regularRemaining -= regularDepreciationCents;
      regularCumulative += regularDepreciationCents;
      if (inSpecialPeriod && (!legacy7b || year <= 2026)) {
        specialDepreciationCents = Math.min(regularRemaining, multiplyCents(basis.special7bBasisCents, 0.05));
        regularRemaining -= specialDepreciationCents;
      }
    }
    const heritageIndex = year - yearOf(heritageStart);
    if (withHeritage && heritageIndex >= 0 && heritageIndex < (selfUse ? 10 : 12)) {
      // Cumulative rounding retains exactly 100% (rental) / 90% (§10f), even
      // where annual percentage calculations would leave a few stray cents.
      const cumulativeRate = selfUse || heritageIndex < 8
        ? 0.09 * (heritageIndex + 1)
        : 0.72 + 0.07 * (heritageIndex - 7);
      heritageDeductionCents = Math.min(heritageRemaining, Math.max(0,
        multiplyCents(basis.heritageBasisCents, cumulativeRate) - (basis.heritageBasisCents - heritageRemaining)));
      heritageRemaining -= heritageDeductionCents;
    } else if (!withHeritage && !selfUse && basis.heritageBasisCents > 0) {
      const standardHeritage = Math.min(heritageRemaining, multiplyCents(basis.heritageBasisCents, linearRate * monthsInYear(year, heritageStart) / 12));
      heritageRemaining -= standardHeritage;
      regularDepreciationCents += standardHeritage;
    }
    const deduction = sumCents([regularDepreciationCents, specialDepreciationCents, heritageDeductionCents]);
    const saving = multiplyCents(deduction, input.marginalTaxRate);
    totalDeductionCents += deduction;
    totalTaxSavingCents += saving;
    annualRows.push({
      year, yearIndex: index + 1, months, regularDepreciationCents,
      specialDepreciationCents, heritageDeductionCents, totalDeductionCents: deduction,
      taxSavingCents: saving, cumulativeDeductionCents: totalDeductionCents,
      cumulativeTaxSavingCents: totalTaxSavingCents,
      remainingBasisCents: regularRemaining + heritageRemaining, method,
    });
  }
  return {
    id, label: labels[id], method: labels[id], annualRows, totalDeductionCents,
    totalTaxSavingCents, remainingBasisCents: regularRemaining + heritageRemaining,
    firstYearDeductionCents: annualRows[0].totalDeductionCents,
    firstYearTaxSavingCents: annualRows[0].taxSavingCents,
    switchedToLinearYear,
  };
}
