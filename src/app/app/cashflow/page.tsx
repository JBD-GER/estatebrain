import Link from "next/link";
import { ArrowRight, Building2, Landmark, ReceiptText, WalletCards } from "lucide-react";
import { CashflowChart } from "@/components/app/dashboard-charts";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLiveDashboardSnapshot } from "@/lib/data/dashboard";
import { cn } from "@/lib/utils";

const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

function money(cents: number | null) {
  return cents === null ? "Nicht berechnet" : euro.format(cents / 100);
}

function debtModeLabel(mode: "actual" | "forecast" | "mixed" | "none") {
  if (mode === "actual") return "gebucht";
  if (mode === "forecast") return "Prognose";
  if (mode === "mixed") return "gebucht + Prognose";
  return "keine Finanzierung";
}

export default async function CashflowPage() {
  const snapshot = await getLiveDashboardSnapshot();
  const metrics = snapshot.metrics;

  return (
    <>
      <PageHeader
        eyebrow="Liquidität"
        title="Cashflow"
        description="Kaltmiete inklusive Stellplatzmiete und weitere Einnahmen, abzüglich Nebenkosten, Eigentümerkosten und Finanzierung. Umlagefähige Nebenkostenbelege werden nicht doppelt abgezogen. Sanierungen zählen im Abschlussmonat."
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          {
            label: "Einnahmen ohne Nebenkosten (mtl.)",
            value: money(
              metrics.operatingCashflowCents + metrics.monthlyCashExpensesCents,
            ),
            detail: `${money(metrics.monthlyAncillaryIncomeCents)} Nebenkosten bereits abgezogen`,
            icon: WalletCards,
          },
          {
            label: "Eigentümerkosten inkl. Sanierungen (mtl.)",
            value: money(metrics.monthlyCashExpensesCents),
            detail: `${money(metrics.currentYearExpensesCents)} im laufenden Jahr`,
            icon: ReceiptText,
          },
          {
            label: "Schuldendienst (mtl.)",
            value: money(metrics.monthlyDebtServiceCents),
            detail: debtModeLabel(metrics.debtServiceMode),
            icon: Landmark,
          },
          {
            label: "Cashflow nach Finanzierung (mtl.)",
            value: money(metrics.financingCashflowCents),
            detail: "Gesamter Portfolio-Cashflow vor geschätzter Steuer",
            icon: Building2,
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
              <p className="mt-2 text-xs text-muted-foreground">{item.detail}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-6">
        <div className="mb-3">
          <h2 className="text-sm font-semibold">Je Immobilie</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Grün = positiver Cashflow, Rot = negativer Cashflow. Fiktive
            Szenarien sind aus dem Ist-Portfolio ausgeschlossen.
          </p>
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {snapshot.properties.map((property) => {
            const positive = property.monthlyCashflowAfterFinancingCents >= 0;
            return (
              <Link
                href={`/app/immobilien/${property.id}`}
                key={property.id}
                className={cn(
                  "group rounded-xl border-l-4 bg-card p-5 shadow-xs transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  positive ? "border-l-emerald-500" : "border-l-destructive",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">{property.name}</p>
                    <Badge className="mt-2" variant="outline">
                      Finanzierung: {debtModeLabel(property.debtServiceMode)}
                    </Badge>
                  </div>
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  />
                </div>
                <p
                  className={cn(
                    "mt-5 text-2xl font-semibold tabular-nums",
                    positive
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-destructive",
                  )}
                >
                  {money(property.monthlyCashflowAfterFinancingCents)}
                </p>
                <dl className="mt-4 grid grid-cols-3 gap-2 border-t pt-3 text-xs">
                  <div>
                    <dt className="text-muted-foreground">Einnahmen ohne NK</dt>
                    <dd className="mt-1 font-medium tabular-nums">
                      {money(property.monthlyIncomeCents)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Eigentümerkosten</dt>
                    <dd className="mt-1 font-medium tabular-nums">
                      {money(property.monthlyCashExpensesCents)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Rate</dt>
                    <dd className="mt-1 font-medium tabular-nums">
                      {money(property.monthlyDebtServiceCents)}
                    </dd>
                  </div>
                </dl>
              </Link>
            );
          })}
        </div>
      </section>

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Entwicklung der letzten zwölf Monate</CardTitle>
          <CardDescription>
            Operativer Cashflow und Ergebnis nach bestätigtem beziehungsweise
            klar prognostiziertem Schuldendienst.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CashflowChart data={snapshot.months} />
        </CardContent>
      </Card>
    </>
  );
}
