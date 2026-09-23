import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganization } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { valuationResponseSchema, valuationInputSchema, valuationAvailability, valuationFilterLabel, featureLabels, propertyTypes } from "@/lib/valuations/somantic";
import { PrintReportButton } from "@/components/valuations/print-report-button";
import { ValuationDialog } from "@/components/valuations/valuation-dialog";
import { DeleteRecordButton } from "@/components/app/delete-record-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const euro = new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const amount = (value: number | null | undefined) => value == null ? "Keine Schätzung verfügbar" : euro.format(value);
const quality = { high: "Hoch", medium: "Mittel", low: "Niedrig", none: "Nicht ausreichend" };

export default async function ValuationReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await requireOrganization();
  const supabase = await createClient();
  const { data: report } = await supabase.from("somantic_valuation_reports").select("*").eq("id", id).eq("organization_id", viewer.organizationId).maybeSingle();
  if (!report) notFound();
  const [propertyResult, activeResult] = await Promise.all([
    supabase.from("properties").select("name,country_code,archived_at").eq("id", report.property_id).eq("organization_id", viewer.organizationId).maybeSingle(),
    supabase.from("somantic_valuation_reports").select("id").eq("property_id", report.property_id).eq("organization_id", viewer.organizationId).in("status", ["pending", "uncertain"]).limit(1),
  ]);
  const property = propertyResult.data;
  const result = valuationResponseSchema.safeParse(report.response);
  const input = valuationInputSchema.safeParse(report.input);
  const incomplete = result.success && (result.data.estimates.price == null || result.data.estimates.rent == null);
  const canRepeat = hasPermission(viewer.role, "portfolio.write") && property?.country_code === "DE" && !property.archived_at && !activeResult.error && !activeResult.data?.length;

  return <article className="mx-auto max-w-5xl space-y-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><Link href="/app/markt" className="text-sm underline print:hidden">Zurück zu Bewertungen</Link><div className="flex items-center gap-2 print:hidden">{hasPermission(viewer.role,"portfolio.write") && !["pending","uncertain"].includes(report.status) && <DeleteRecordButton module="markt" id={report.id} valuationReport name="Bewertungsbericht" afterDeleteHref="/app/markt"/>}<PrintReportButton /></div></div>
    <header>
      <p className="text-sm text-muted-foreground">EstateBrain · Somantic · {report.valuation_year}</p>
      <h1 className="text-3xl font-semibold">Bewertungsbericht: {property?.name ?? "Immobilie"}</h1>
      <p className="mt-2 text-muted-foreground">Stand: {new Date(report.requested_at).toLocaleString("de-DE", { timeZone: "Europe/Berlin" })} · Modellbasierte Marktwerteinschätzung</p>
      {input.success && input.data.comparison_scope === "broader" && <p className="mt-2 rounded-lg bg-amber-50 p-3 text-amber-900">Breiterer Vergleich: Die genaue Objektart und Ausstattung wurden nicht als Filter verwendet. Die Vergleichsobjekte können in diesen Merkmalen abweichen.</p>}
    </header>
    {report.error_message && <p role="alert">{report.error_message}</p>}
    {result.success ? <>
      <div className="grid gap-4 sm:grid-cols-2">
        {([ ["price", "Kaufpreis", result.data.estimates.price, result.data.estimates.price_range, result.data.confidence.price], ["rent", "Kaltmiete pro Monat", result.data.estimates.rent, result.data.estimates.rent_range, result.data.confidence.rent] ] as const).map(([side, title, value, range, confidence]) => {
          const availability = valuationAvailability(result.data, side);
          return <Card key={side}><CardHeader><CardTitle>{title}</CardTitle></CardHeader><CardContent>
            <p className="text-3xl font-semibold">{amount(value)}</p>
            {range && <p className="mt-2">Spanne: {amount(range.low)} – {amount(range.high)}</p>}
            {availability && <p className="mt-3 text-sm text-amber-800">{availability}</p>}
            <p className="mt-2 text-sm text-muted-foreground">Datenqualität: {quality[confidence]}</p>
          </CardContent></Card>;
        })}
      </div>
      {incomplete && <div className="space-y-2 rounded-lg bg-amber-50 p-4 text-amber-900">
        <p className="font-medium">Zu wenige passende Vergleichsdaten</p>
        <p>Prüfe Adresse, Wohnfläche und Objektart. Zusätzliche Angaben können die Einordnung verbessern, zugleich können Filter die Auswahl verkleinern. Ein breiterer Vergleich ohne genaue Objektart und Ausstattung kann mehr Treffer liefern; ein Schätzwert ist auch dann nicht garantiert.</p>
        <p>Ein fehlender Kaufpreis ersetzt deinen gespeicherten Marktwert nicht. Vorhandene Miet- oder Kaufwerte werden separat angezeigt.</p>
      </div>}
      <Card><CardHeader><CardTitle>Datengrundlage</CardTitle></CardHeader><CardContent className="space-y-2">
        <p>{result.data.confidence.sample_size} bereinigte Vergleichsobjekte insgesamt · Kauf: {result.data.estimates.price_per_square_meter?.count ?? "Nicht ausgewiesen"} · Miete: {result.data.estimates.rent_per_square_meter?.count ?? "Nicht ausgewiesen"}</p>
        {result.data.confidence.cluster_size != null && <p>Vergleichsobjekte vor der Filterung: {result.data.confidence.cluster_size}</p>}
        <p>Mittlerer Kaufpreis je m²: {amount(result.data.estimates.price_per_square_meter?.mean)} · Kaltmiete je m²: {amount(result.data.estimates.rent_per_square_meter?.mean)}</p>
        <p>Aktualitätsfenster: {result.data.confidence.recency_window_months ? `${result.data.confidence.recency_window_months} Monate` : "Ohne feste zeitliche Eingrenzung"}</p>
        {result.data.confidence.date_span && <p>Inseratszeitraum: {result.data.confidence.date_span.oldest?.slice(0, 10)} bis {result.data.confidence.date_span.newest?.slice(0, 10)}</p>}
        {result.data.confidence.filters_applied?.length ? <p>Berücksichtigte Filter: {result.data.confidence.filters_applied.map(valuationFilterLabel).join(", ")}</p> : null}
        {result.data.confidence.filters_skipped?.length ? <p className="text-amber-800">Wegen geringer Datenmenge nicht verwendete Filter: {result.data.confidence.filters_skipped.map(valuationFilterLabel).join(", ")}</p> : null}
        <p className="text-sm text-muted-foreground">Somantic benötigt mindestens 5 Vergleichsobjekte je Kauf- oder Mietschätzung. Quadratmeterstatistiken können auch bei weniger Treffern vorliegen; daraus wird kein eigener Kaufpreis hochgerechnet. Die Preisspanne zeigt das mittlere Quartilsband der Vergleichsobjekte und ist keine garantierte Verkaufspreisspanne.</p>
      </CardContent></Card>
    </> : <p>Für diese Anfrage liegt noch kein vollständig bestätigtes Ergebnis vor.</p>}
    {input.success && <Card><CardHeader><CardTitle>Verwendete Objektdaten</CardTitle></CardHeader><CardContent className="space-y-2">
      <p>{input.data.street}, {input.data.postcode} {input.data.city}</p>
      <p>{input.data.typ === "haus" ? "Haus" : "Wohnung"} · {input.data.square_meters} m² Wohnfläche · {input.data.rooms ?? "–"} Zimmer · Baujahr {input.data.year_of_construction ?? "–"}</p>
      <p>Objektart: {propertyTypes.find(([type]) => type === input.data.property_type)?.[1] ?? "Keine zusätzliche Eingrenzung"}{input.data.comparison_scope === "broader" ? " (gespeichert, nicht als Filter verwendet)" : ""}</p>
      <p>Vermietung: {input.data.rented == null ? "Keine Eingrenzung" : input.data.rented ? "Vermietet" : "Bezugsfrei"}</p>
      <p>Ausstattung: {Object.entries(input.data.features ?? {}).filter(([, value]) => value).map(([key]) => featureLabels[key as keyof typeof featureLabels]).join(", ") || "Keine zusätzliche Eingrenzung"}{input.data.comparison_scope === "broader" ? " (gespeichert, nicht als Filter verwendet)" : ""}</p>
    </CardContent></Card>}
    {input.success && canRepeat && <div className="space-y-2 print:hidden">
      <ValuationDialog propertyId={report.property_id} name={property?.name ?? "Immobilie"} defaults={{ ...input.data, comparison_scope: "broader" }} triggerLabel={incomplete ? "Angaben prüfen und breiteren Vergleich anfordern" : "Angaben prüfen und erneut bewerten"} />
      <p className="text-sm text-muted-foreground">Der nächste Abruf erstellt einen neuen Bericht. Dieser Bericht bleibt erhalten.</p>
    </div>}
    <p className="text-sm text-muted-foreground">Quelle: <a href="https://www.somantic.net/developers/docs" target="_blank" rel="noreferrer" className="underline">Somantic Immobilienbewertungs-API</a>. Automatisierte Markteinschätzung, kein Verkehrswertgutachten durch einen Sachverständigen. Der Bericht kann jederzeit erneut geöffnet werden, ohne einen weiteren Abruf auszulösen.</p>
  </article>;
}
