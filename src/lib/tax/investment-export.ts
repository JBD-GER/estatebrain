import type { InvestmentTaxInput, InvestmentTaxScenario } from "@/lib/domain/investment-tax";
import { rowsToCsv } from "@/lib/exports/csv";

export function investmentComparisonCsv(items: { name: string; input: InvestmentTaxInput; result: InvestmentTaxScenario }[]) {
  return rowsToCsv({
    columns: [
      { key: "name", label: "Szenario" }, { key: "method", label: "Methode" },
      { key: "annualMethod", label: "Methode im Kalenderjahr" },
      { key: "year", label: "Kalenderjahr" }, { key: "yearIndex", label: "Betrachtungsjahr" },
      { key: "regular", label: "Normale AfA EUR" }, { key: "special", label: "Sonder-AfA §7b EUR" },
      { key: "heritage", label: "Denkmalabzug EUR" }, { key: "deduction", label: "Abzug gesamt EUR" },
      { key: "tax", label: "Geschätzte Steuerentlastung EUR" }, { key: "cumulative", label: "Steuerentlastung kumuliert EUR" },
      { key: "remaining", label: "Restbemessungsgrundlage EUR" }, { key: "rate", label: "Grenzsteuersatz Prozent" },
      { key: "purchase", label: "Kaufpreis EUR" }, { key: "costs", label: "Kaufnebenkosten EUR" },
      { key: "land", label: "Grundstücksanteil Prozent" }, { key: "measures", label: "Aktivierte Maßnahmen EUR" },
      { key: "completion", label: "Fertigstellung" }, { key: "acquisition", label: "Anschaffung" },
      { key: "usage", label: "Nutzung" }, { key: "assumptions", label: "Modellannahmen" },
    ],
    rows: items.flatMap(({ name, input, result }) => result.annualRows.map((row) => ({
      name, method: result.label, annualMethod: row.method, year: row.year, yearIndex: row.yearIndex,
      regular: row.regularDepreciationCents / 100, special: row.specialDepreciationCents / 100,
      heritage: row.heritageDeductionCents / 100, deduction: row.totalDeductionCents / 100,
      tax: row.taxSavingCents / 100, cumulative: row.cumulativeTaxSavingCents / 100,
      remaining: row.remainingBasisCents / 100, rate: input.marginalTaxRate * 100,
      purchase: input.purchasePriceCents / 100, costs: input.acquisitionCostsCents / 100,
      land: input.landShareRate * 100, measures: input.capitalizedMeasuresCents / 100,
      completion: input.completionDate, acquisition: input.acquisitionDate,
      usage: input.usage === "rented" ? "Vermietet" : "Selbst genutzt",
      assumptions: "Unverbindliche Modellrechnung; konstanter Grenzsteuersatz, volle Nutzbarkeit; ohne Soli, Kirchensteuer, Finanzierung, laufenden Cashflow und Verkauf.",
    }))),
  });
}
