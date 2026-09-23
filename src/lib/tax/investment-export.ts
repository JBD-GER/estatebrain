import type { InvestmentTaxInput, InvestmentTaxScenario } from "@/lib/domain/investment-tax";
import { calculateInvestmentCashflow } from "@/lib/domain/investment-cashflow";
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
      { key: "rent", label: "Kaltmiete nach Ausfall EUR" }, { key: "ownerCosts", label: "Laufende Kosten EUR" },
      { key: "interest", label: "Zinsen EUR" }, { key: "principal", label: "Tilgung EUR" },
      { key: "debt", label: "Restschuld EUR" }, { key: "taxable", label: "Steuerliches Ergebnis EUR" },
      { key: "incomeTax", label: "Steuerbelastung (+) Entlastung (-) EUR" },
      { key: "beforeTax", label: "Cashflow vor Steuern EUR" }, { key: "afterTax", label: "Cashflow nach Steuern EUR" },
      { key: "usage", label: "Nutzung" }, { key: "assumptions", label: "Modellannahmen" },
    ],
    rows: items.flatMap(({ name, input, result }) => {
      const cashflow = calculateInvestmentCashflow(input, result);
      return result.annualRows.map((row, index) => ({
      name, method: result.label, annualMethod: row.method, year: row.year, yearIndex: row.yearIndex,
      regular: row.regularDepreciationCents / 100, special: row.specialDepreciationCents / 100,
      heritage: row.heritageDeductionCents / 100, deduction: row.totalDeductionCents / 100,
      tax: row.taxSavingCents / 100, cumulative: row.cumulativeTaxSavingCents / 100,
      remaining: row.remainingBasisCents / 100, rate: input.marginalTaxRate * 100,
      purchase: input.purchasePriceCents / 100, costs: input.acquisitionCostsCents / 100,
      land: input.landShareRate * 100, measures: input.capitalizedMeasuresCents / 100,
      completion: input.completionDate, acquisition: input.acquisitionDate,
      usage: input.usage === "rented" ? "Vermietet" : "Selbst genutzt",
      rent: cashflow.rows[index].rentCents / 100, ownerCosts: cashflow.rows[index].ownerCostsCents / 100,
      interest: cashflow.rows[index].interestCents / 100, principal: cashflow.rows[index].principalCents / 100,
      debt: cashflow.rows[index].remainingDebtCents / 100, taxable: cashflow.rows[index].taxableIncomeCents / 100,
      incomeTax: cashflow.rows[index].taxCents / 100, beforeTax: cashflow.rows[index].beforeTaxCents / 100,
      afterTax: cashflow.rows[index].afterTaxCents / 100,
      assumptions: "Unverbindliche Modellrechnung; konstanter Grenzsteuersatz und Sollzins, volle Abziehbarkeit laufender Kosten und sofortige Verlustnutzung; laufender Cashflow ohne Kauf, Darlehensauszahlung, Eigenkapital, Verkauf, Soli und Kirchensteuer. Fehlende Miet- und Darlehensangaben = 0 EUR.",
    })); }),
  });
}
