import type { InvestmentTaxInput, InvestmentTaxScenario } from "@/lib/domain/investment-tax";
import { calculateInvestmentCashflow } from "@/lib/domain/investment-cashflow";

const euros = (cents: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 2 }).format(cents / 100);

export function InvestmentCashflowPanel({ input, scenario }: { input: InvestmentTaxInput; scenario: InvestmentTaxScenario }) {
  const result = calculateInvestmentCashflow(input, scenario);
  const first = result.rows[0];
  return <div className="space-y-5">
    <div><h2 className="text-base font-semibold">Miete, Finanzierung & Cashflow</h2><p className="mt-1 text-xs text-muted-foreground">Jährliche Prognose einschließlich {scenario.label}. Ein positiver Steuerbetrag ist eine Belastung, ein negativer eine modellierte Entlastung.</p></div>
    {!input.cashflow ? <p className="rounded-xl bg-secondary/50 p-3 text-xs">Ergänze deine prognostizierte Miete und die Finanzierung in den Eingaben. Aktuell sind beide mit 0 € angesetzt.</p> : null}
    <div className="grid gap-3 sm:grid-cols-2">
      {[
        ["Anfängliche Darlehensrate / Monat", result.monthlyPaymentCents],
        [`Mieteinnahmen ${first.year} nach Ausfall`, first.rentCents],
        [`Cashflow nach Steuern ${first.year}`, first.afterTaxCents],
        [`Cashflow nach Steuern · ${input.years} Jahre`, result.totalAfterTaxCents],
      ].map(([label, value]) => <div key={String(label)} className="rounded-xl border bg-secondary/25 p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-2 text-lg font-semibold tabular-nums">{euros(Number(value))}</p></div>)}
    </div>
    <div className="overflow-x-auto rounded-xl border" tabIndex={0} aria-label="Cashflow-Prognose horizontal scrollbar">
      <table className="w-full min-w-[1150px] text-right text-xs"><thead><tr className="bg-secondary/60 text-[10px] text-muted-foreground">
        {["Jahr", "Kaltmiete nach Ausfall", "Laufende Kosten", "Zinsen", "Tilgung", "Steuerliches Ergebnis", "Steuer (+) / Entlastung (−)", "Cashflow vor Steuern", "Cashflow nach Steuern", "Restschuld Jahresende"].map((label) => <th key={label} className="px-3 py-3 font-medium first:text-left">{label}</th>)}
      </tr></thead><tbody>{result.rows.map((row) => <tr key={row.year} className="border-t even:bg-background/50"><th scope="row" className="px-3 py-3 text-left">{row.year}</th>
        {[row.rentCents, row.ownerCostsCents, row.interestCents, row.principalCents, row.taxableIncomeCents, row.taxCents, row.beforeTaxCents, row.afterTaxCents, row.remainingDebtCents].map((value, index) => <td key={index} className={`whitespace-nowrap px-3 py-3 tabular-nums ${index === 7 ? "font-semibold text-primary" : ""}`}>{euros(value)}</td>)}
      </tr>)}</tbody></table>
    </div>
    <div className="rounded-xl border border-dashed p-4 text-xs leading-relaxed text-muted-foreground">
      <p>Bei Vermietung: steuerliches Ergebnis = Kaltmiete nach Mietausfall − laufende Kosten − Zinsen − Abschreibung. Tilgung ist kein steuerlicher Aufwand. Cashflow = Miete − Kosten − Zinsen − Tilgung − modellierte Steuer.</p>
      <p className="mt-2">Das Modell unterstellt durchgehende Vermietungsabsicht, volle Abziehbarkeit der eingegebenen laufenden Kosten und sofort nutzbare Verluste zum angegebenen Grenzsteuersatz. Bei Eigennutzung bleiben Miete und Werbungskosten steuerlich unberücksichtigt; ein möglicher §-10f-Abzug wird separat berücksichtigt.</p>
      <p className="mt-2">Monatsweise Prognose mit konstantem Sollzins. Nebenkostenvorauszahlungen und zugehörige Ausgaben werden als durchlaufend angenommen. Kauf, Eigenkapital, Darlehensauszahlung, Verkauf, Soli und Kirchensteuer sind nicht im laufenden Cashflow enthalten.</p>
    </div>
  </div>;
}
