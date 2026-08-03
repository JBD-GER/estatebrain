import Link from "next/link";
import { ArrowRight, Building2, CircleDollarSign, PiggyBank, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLiveDashboardSnapshot } from "@/lib/data/dashboard";
import { cn } from "@/lib/utils";

const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});
const percent = new Intl.NumberFormat("de-DE", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function money(cents: number | null) {
  return cents === null ? "Nicht berechnet" : euro.format(cents / 100);
}

export default async function PotentialsPage() {
  const snapshot = await getLiveDashboardSnapshot();
  const totalGapCents =
    snapshot.metrics.monthlyMarketColdRentCents -
    snapshot.metrics.monthlyContractColdRentCents;
  const gapRate =
    snapshot.metrics.monthlyContractColdRentCents > 0
      ? totalGapCents / snapshot.metrics.monthlyContractColdRentCents
      : null;

  return (
    <>
      <PageHeader
        eyebrow="Analyse"
        title="Potenziale"
        description="Vertrags-/IST-Kaltmiete im direkten Vergleich zur hinterlegten Markt-/SOLL-Kaltmiete."
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "IST / Vertrags-Kaltmiete (mtl.)",
            value: money(snapshot.metrics.monthlyContractColdRentCents),
            icon: CircleDollarSign,
          },
          {
            label: "SOLL / Markt-Kaltmiete (mtl.)",
            value: money(snapshot.metrics.monthlyMarketColdRentCents),
            icon: TrendingUp,
          },
          {
            label: "Mietpotenzial (mtl.)",
            value: money(totalGapCents),
            icon: Building2,
          },
          {
            label: "Geschätztes Eigenkapital",
            value: money(snapshot.metrics.equityCents),
            icon: PiggyBank,
          },
        ].map((item) => (
          <Card key={item.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{item.label}</p>
                <item.icon className="size-4 text-primary" aria-hidden="true" />
              </div>
              <p className="mt-3 text-2xl font-semibold tabular-nums">
                {item.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Mietpotenzial je Immobilie</CardTitle>
          <CardDescription>
            Positive Differenz = Markt-/SOLL-Miete liegt über der aktuellen
            Vertragsmiete. Rechtliche Grenzen für Mieterhöhungen werden hier
            noch nicht automatisch bewertet.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
          {snapshot.properties.map((property) => {
            const gap =
              property.monthlyMarketColdRentCents -
              property.monthlyContractColdRentCents;
            const propertyGapRate =
              property.monthlyContractColdRentCents > 0
                ? gap / property.monthlyContractColdRentCents
                : null;
            return (
              <Link
                href={`/app/immobilien/${property.id}`}
                key={property.id}
                className="group rounded-xl border bg-background p-4 transition-colors hover:border-primary/40 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="font-medium">{property.name}</p>
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  />
                </div>
                <dl className="mt-4 space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">IST-Vertrag</dt>
                    <dd className="tabular-nums">
                      {money(property.monthlyContractColdRentCents)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4">
                    <dt className="text-muted-foreground">SOLL-Markt</dt>
                    <dd className="tabular-nums">
                      {money(property.monthlyMarketColdRentCents)}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t pt-2">
                    <dt className="font-medium">Differenz</dt>
                    <dd
                      className={cn(
                        "font-semibold tabular-nums",
                        gap >= 0
                          ? "text-emerald-700 dark:text-emerald-400"
                          : "text-destructive",
                      )}
                    >
                      {money(gap)}
                      {propertyGapRate === null
                        ? ""
                        : ` · ${percent.format(propertyGapRate)}`}
                    </dd>
                  </div>
                </dl>
              </Link>
            );
          })}
        </CardContent>
      </Card>

      <section className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Portfolio-Mietpotenzial</CardTitle>
            <CardDescription>Hochrechnung ohne rechtliche oder zeitliche Annahmen.</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold tabular-nums">
              {money(totalGapCents * 12)} p. a.
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              {gapRate === null
                ? "Keine aktive Vertragsmiete als Vergleichsbasis."
                : `${percent.format(gapRate)} gegenüber der aktuellen Vertrags-Kaltmiete.`}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Vermögen und Steuer</CardTitle>
            <CardDescription>
              Steuerwirkung und Verkehrswertentwicklung sind getrennte Größen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Marktwert abzüglich Restschuld</span>
              <span className="font-semibold tabular-nums">
                {money(snapshot.metrics.equityCents)}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Cashflow nach geschätzter Steuer (mtl.)</span>
              <span className="font-semibold tabular-nums">
                {money(snapshot.metrics.estimatedAfterTaxCents)}
              </span>
            </div>
            <p className="border-t pt-3 text-xs leading-5 text-muted-foreground">
              Ein „Immobilienvermögen nach Steuer“ wäre ohne Verkaufszeitpunkt,
              Haltedauer und Veräußerungskosten fachlich irreführend. Deshalb
              zeigt Estate Brain Vermögen und laufende Steuerwirkung getrennt.
            </p>
          </CardContent>
        </Card>
      </section>
    </>
  );
}
