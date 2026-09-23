import type { ModuleSummaryMetric } from "@/lib/modules/summary";

type ValuedProperty = { current_market_value_cents: number | null };
const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" });

/** Use the canonical current-value projection, never sum historical valuations. */
export function valuationSummaryMetrics(properties: readonly ValuedProperty[] | null, historyCount: number): ModuleSummaryMetric[] {
  const valued = properties?.filter(property => property.current_market_value_cents != null) ?? [];
  const value = valued.reduce((total, property) => total + property.current_market_value_cents!, 0);
  return [
    {
      label: "Bewertete Immobilien",
      value: properties == null ? "Nicht geladen" : String(valued.length),
      hint: properties == null ? "Bitte die Seite erneut laden" : `${valued.length} von ${properties.length} aktiven Immobilien mit Marktwert`,
    },
    {
      label: properties?.length === 1 ? "Aktueller Marktwert" : "Aktueller Gesamtwert",
      value: properties == null ? "Nicht geladen" : valued.length ? euro.format(value / 100) : "Noch kein Marktwert",
      hint: "Nur der neueste gespeicherte Wert je Immobilie",
    },
    {
      label: "Bewertungen in der Historie",
      value: String(historyCount),
      hint: "Angezeigte Einträge · frühere Werte werden nicht addiert",
    },
  ];
}
