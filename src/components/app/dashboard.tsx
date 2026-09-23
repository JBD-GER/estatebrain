import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Banknote,
  Building2,
  CalendarClock,
  CircleDollarSign,
  FileQuestion,
  Info,
  Landmark,
  ListChecks,
  PiggyBank,
  ReceiptText,
  TrendingUp,
  Users,
  WalletCards,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  CashflowChart,
  PortfolioChart,
  RentChart,
} from "@/components/app/dashboard-charts";
import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  DashboardAction,
  DashboardSnapshot,
} from "@/lib/dashboard/types";
import { cn } from "@/lib/utils";

const euroFormatter = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat("de-DE");
const percentFormatter = new Intl.NumberFormat("de-DE", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function euros(cents: number | null) {
  return cents === null ? "Nicht berechnet" : euroFormatter.format(cents / 100);
}

function percent(value: number | null) {
  return value === null ? "Nicht berechnet" : percentFormatter.format(value);
}

function date(value: string | null) {
  if (!value) return "Nicht hinterlegt";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00.000Z`));
}

function KpiCard({
  title,
  value,
  description,
  icon: Icon,
  href,
  tone = "default",
}: {
  title: string;
  value: string;
  description: string;
  icon: LucideIcon;
  href: string;
  tone?: "default" | "positive" | "warning";
}) {
  return (
    <Link className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={href}>
      <Card className="min-h-40 transition-colors group-hover:border-primary/40 group-hover:bg-muted/20">
        <CardHeader>
          <CardTitle className="text-sm text-muted-foreground">{title}</CardTitle>
          <CardAction>
            <span
              className={cn(
                "grid size-9 place-items-center rounded-lg",
                tone === "positive" && "bg-primary/10 text-primary",
                tone === "warning" &&
                  "bg-amber-500/10 text-amber-700 dark:text-amber-400",
                tone === "default" && "bg-muted text-muted-foreground",
              )}
            >
              <Icon className="size-4" aria-hidden="true" />
            </span>
          </CardAction>
        </CardHeader>
        <CardContent className="mt-auto">
          <p className="text-2xl font-semibold tracking-tight tabular-nums">
            {value}
          </p>
          <p className="mt-2 text-xs leading-5 text-muted-foreground">
            {description}
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary">
            Details <ArrowRight className="size-3" aria-hidden="true" />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

function StatTile({
  label,
  value,
  detail,
  icon: Icon,
  href,
}: {
  label: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
        <Icon className="size-4 text-primary" aria-hidden="true" />
      </div>
      <p className="mt-3 text-xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</p>
    </Link>
  );
}

const ACTION_STYLE: Record<
  DashboardAction["priority"],
  { badge: "destructive" | "secondary" | "outline"; label: string }
> = {
  urgent: { badge: "destructive", label: "Sofort" },
  high: { badge: "destructive", label: "Hoch" },
  medium: { badge: "secondary", label: "Mittel" },
  low: { badge: "outline", label: "Niedrig" },
};

function EmptyDashboard() {
  return (
    <Card className="surface-grid">
      <CardContent className="flex min-h-[420px] flex-col items-center justify-center px-6 text-center">
        <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
          <Building2 className="size-7" aria-hidden="true" />
        </span>
        <h2 className="mt-5 text-xl font-semibold">
          Dein Portfolio-Cockpit ist bereit
        </h2>
        <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
          Lege zuerst eine Immobilie an. Sobald Einheiten, Mietverhältnisse und
          Buchungen vorhanden sind, entstehen die Kennzahlen ausschließlich aus
          deinen Organisationsdaten.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button asChild>
            <Link href="/onboarding?resume=1">
              Geführte Einrichtung fortsetzen
              <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/app/immobilien">Direkt Immobilie anlegen</Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/demo">Fiktive Demo ansehen</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function DemoNotice() {
  return (
    <div className="mb-5 flex flex-col gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 text-sm sm:flex-row sm:items-center">
      <Badge className="w-fit">Demo-Modus</Badge>
      <p className="flex-1 text-muted-foreground">
        Alle Namen, Adressen, Konten und Buchungen auf dieser Seite sind frei
        erfunden und werden nicht dauerhaft gespeichert.
      </p>
      <Button asChild size="sm">
        <Link href="/registrieren">Eigenes Portfolio anlegen</Link>
      </Button>
    </div>
  );
}

function DashboardActions({
  snapshot,
}: {
  snapshot: DashboardSnapshot;
}) {
  const isDemo = snapshot.mode === "demo";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nächste Aktionen</CardTitle>
        <CardDescription>
          Offene Forderungen, Fristen und Datenlücken nach Priorität.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {snapshot.actions.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Aktuell sind keine dringenden Folgeaktionen erkennbar.
          </div>
        ) : (
          <div className="divide-y">
            {snapshot.actions.map((action) => {
              const style = ACTION_STYLE[action.priority];
              return (
                <Link
                  className="group flex items-start gap-3 py-3 first:pt-0 last:pb-0"
                  href={isDemo ? "/registrieren" : action.href}
                  key={action.id}
                >
                  <Badge className="mt-0.5" variant={style.badge}>
                    {style.label}
                  </Badge>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium group-hover:text-primary">
                      {action.title}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {action.detail}
                    </span>
                  </span>
                  <ArrowRight className="mt-1 size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OpenClaims({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Offene Mietforderungen</CardTitle>
        <CardDescription>
          Soll, Zahlungseingang und offener Betrag über alle Fälligkeiten.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {snapshot.openClaims.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Keine offenen Mietforderungen in den verfügbaren Daten.
          </div>
        ) : (
          <div className="space-y-4">
            {snapshot.openClaims.slice(0, 5).map((claim) => (
              <div key={claim.id}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{claim.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Fällig am {date(claim.dueDate)}
                    </p>
                  </div>
                  <p className="shrink-0 font-semibold tabular-nums text-destructive">
                    {euros(claim.openCents)}
                  </p>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    aria-label={`${percent(
                      claim.coverageRate,
                    )} der Forderung bezahlt`}
                    className="h-full rounded-full bg-primary"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(0, (claim.coverageRate ?? 0) * 100),
                      )}%`,
                    }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>{euros(claim.paidCents)} bezahlt</span>
                  <span>{euros(claim.amountCents)} Soll</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PropertyTable({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Performance je Immobilie</CardTitle>
        <CardDescription>
          Vertrags- und Marktmiete, Zahlung, laufende Ausgaben und Cashflow.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Immobilie</TableHead>
              <TableHead className="text-right">IST-Vertragsmiete (mtl.)</TableHead>
              <TableHead className="text-right">SOLL-Marktmiete (mtl.)</TableHead>
              <TableHead className="text-right">Zahlungseingang (mtl.)</TableHead>
              <TableHead className="text-right">Ausgaben lfd. Jahr</TableHead>
              <TableHead className="text-right">Schuldendienst (mtl.)</TableHead>
              <TableHead className="text-right">Cashflow (mtl.)</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {snapshot.properties.map((property) => (
              <TableRow key={property.id}>
                <TableCell className="font-medium">
                  <Link
                    className="hover:text-primary hover:underline"
                    href={`/app/immobilien/${property.id}`}
                  >
                    {property.name}
                  </Link>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {euros(property.monthlyContractColdRentCents)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {euros(property.monthlyMarketColdRentCents)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {euros(property.monthlyRentPaymentsCents)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {euros(property.currentYearExpensesCents)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  {euros(property.monthlyDebtServiceCents)}
                  <span className="ml-1 block text-[10px] text-muted-foreground">
                    {property.debtServiceMode === "forecast"
                      ? "Prognose"
                      : property.debtServiceMode === "actual"
                        ? "gebucht"
                        : property.debtServiceMode === "mixed"
                          ? "gemischt"
                          : "keine"}
                  </span>
                </TableCell>
                <TableCell
                  className={cn(
                    "text-right font-semibold tabular-nums",
                    property.monthlyCashflowAfterFinancingCents >= 0
                      ? "text-emerald-700 dark:text-emerald-400"
                      : "text-destructive",
                  )}
                >
                  {euros(property.monthlyCashflowAfterFinancingCents)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function PropertyCashflowCards({ snapshot }: { snapshot: DashboardSnapshot }) {
  return (
    <section aria-labelledby="property-cashflow">
      <div className="mb-3 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold" id="property-cashflow">
            Cashflow je Immobilie
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Zahlungseingänge minus zugeordnete Belegausgaben und Schuldendienst.
          </p>
        </div>
        <Button asChild size="sm" variant="ghost">
          <Link href="/app/cashflow">Gesamt-Cashflow ansehen</Link>
        </Button>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {snapshot.properties.map((property) => {
          const positive = property.monthlyCashflowAfterFinancingCents >= 0;
          return (
            <Link
              key={property.id}
              href={`/app/immobilien/${property.id}`}
              className={cn(
                "group rounded-xl border-l-4 bg-card p-4 shadow-xs transition-colors hover:bg-muted/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                positive
                  ? "border-l-emerald-500"
                  : "border-l-destructive",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium">{property.name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    nach Finanzierung · monatlich
                  </p>
                </div>
                <ArrowRight
                  aria-hidden="true"
                  className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                />
              </div>
              <p
                className={cn(
                  "mt-4 text-2xl font-semibold tabular-nums",
                  positive
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-destructive",
                )}
              >
                {euros(property.monthlyCashflowAfterFinancingCents)}
              </p>
              <dl className="mt-4 grid grid-cols-3 gap-2 border-t pt-3 text-xs">
                <div>
                  <dt className="text-muted-foreground">Einnahmen</dt>
                  <dd className="mt-1 font-medium tabular-nums">
                    {euros(property.monthlyIncomeCents)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Ausgaben</dt>
                  <dd className="mt-1 font-medium tabular-nums">
                    {euros(property.monthlyCashExpensesCents)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Finanzierung</dt>
                  <dd className="mt-1 font-medium tabular-nums">
                    {euros(property.monthlyDebtServiceCents)}
                  </dd>
                </div>
              </dl>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export function Dashboard({ snapshot }: { snapshot: DashboardSnapshot }) {
  const metrics = snapshot.metrics;
  const demo = snapshot.mode === "demo";
  const rentCoverage =
    metrics.monthlyTargetRentCents === 0
      ? null
      : metrics.monthlyActualRentCents / metrics.monthlyTargetRentCents;

  return (
    <>
      {demo ? <DemoNotice /> : null}
      <PageHeader
        demo={demo}
        eyebrow={snapshot.organizationName}
        title="Portfolio-Cockpit"
        description={`Kennzahlen für ${snapshot.periodLabel} · Datenstand ${date(
          snapshot.asOfDate,
        )}`}
        actions={
          demo ? (
            <Button asChild>
              <Link href="/registrieren">Eigenes Portfolio starten</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="outline">
                <Link href="/app/immobilien">Immobilie hinzufügen</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/app/belege">Rechnung oder Beleg erfassen</Link>
              </Button>
              <Button asChild>
                <Link href="/app/mietverhaeltnisse">Einnahme erfassen</Link>
              </Button>
            </>
          )
        }
      />

      {snapshot.sourceState === "partial" ? (
        <Alert className="mb-6 border-amber-500/30 bg-amber-500/5">
          <AlertTriangle className="text-amber-700 dark:text-amber-400" />
          <AlertTitle>Einige Quellen sind vorübergehend unvollständig</AlertTitle>
          <AlertDescription>
            Die sichtbaren Werte stammen nur aus erfolgreich geladenen
            Organisationsdaten. Fehlende Bereiche werden nicht mit Demo-Werten
            aufgefüllt.
            {snapshot.issues.length > 0 ? (
              <span className="mt-1 block">
                {snapshot.issues.join(" ")}
              </span>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}

      {snapshot.sourceState === "empty" && !demo ? (
        <EmptyDashboard />
      ) : (
        <div className="space-y-6">
          <section aria-labelledby="cashflow-kpis">
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold" id="cashflow-kpis">
                Liquidität & Vermögen
              </h2>
              <Info className="size-3.5 text-muted-foreground" aria-hidden="true" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <KpiCard
                description="Aktive Kaltmiete aus realen Mietverhältnissen, ohne Nebenkosten."
                icon={CircleDollarSign}
                title="IST / Vertrags-Kaltmiete (mtl.)"
                tone="positive"
                value={euros(metrics.monthlyContractColdRentCents)}
                href="/app/mietverhaeltnisse"
              />
              <KpiCard
                description="Hinterlegte Markt-/Ziel-Kaltmiete als Vergleichspotenzial."
                icon={TrendingUp}
                title="SOLL / Markt-Kaltmiete (mtl.)"
                value={euros(metrics.monthlyMarketColdRentCents)}
                href="/app/potenziale"
              />
              <KpiCard
                description={`${percent(rentCoverage)} der fälligen Monatsmiete bestätigt`}
                icon={Banknote}
                title="Zahlungseingang Miete (mtl.)"
                tone="positive"
                value={euros(metrics.monthlyActualRentCents)}
                href="/app/mietverhaeltnisse"
              />
              <KpiCard
                description="Einnahmen minus liquiditätswirksame Betriebsausgaben."
                icon={TrendingUp}
                title="Operativer Cashflow"
                tone={
                  metrics.operatingCashflowCents >= 0 ? "positive" : "warning"
                }
                value={euros(metrics.operatingCashflowCents)}
                href="/app/cashflow"
              />
              <KpiCard
                description="Operativer Cashflow abzüglich Zins und Tilgung."
                icon={WalletCards}
                title="Nach Finanzierung"
                tone={
                  metrics.financingCashflowCents >= 0 ? "positive" : "warning"
                }
                value={euros(metrics.financingCashflowCents)}
                href="/app/cashflow"
              />
              <KpiCard
                description="Unverbindliche Modellrechnung mit hinterlegten Annahmen."
                icon={ReceiptText}
                title="Nach geschätzter Steuer"
                value={euros(metrics.estimatedAfterTaxCents)}
                href="/app/steuern"
              />
              <KpiCard
                description="Immobilienbezogene Ausgaben aus geprüften Rechnungen und Belegen."
                icon={ReceiptText}
                title="Gesamtausgaben laufendes Jahr"
                tone="warning"
                value={euros(metrics.currentYearExpensesCents)}
                href="/app/belege"
              />
              <KpiCard
                description={`${metrics.valuedPropertyCount} von ${
                  metrics.propertyCount
                } Immobilien mit Marktwert`}
                icon={Building2}
                title="Erfasster Portfoliowert"
                value={euros(metrics.portfolioValueCents)}
                href="/app/immobilien"
              />
              <KpiCard
                description={
                  !metrics.loansAvailable
                    ? "Finanzierungsdaten sind für deine aktuelle Rolle nicht verfügbar."
                    : metrics.valuedPropertyCount === metrics.propertyCount
                    ? `Marktwert minus ${euros(
                        metrics.loanBalanceCents,
                      )} Restschuld`
                    : "Nur bewertete Immobilien und deren zugeordnete Restschulden."
                }
                icon={PiggyBank}
                title="Geschätztes Eigenkapital"
                tone="positive"
                value={euros(metrics.equityCents)}
                href="/app/immobilien"
              />
            </div>
          </section>

          <section
            aria-labelledby="portfolio-status"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8"
          >
            <h2 className="sr-only" id="portfolio-status">
              Bestand und Risiken
            </h2>
            <StatTile
              detail={`${integerFormatter.format(
                metrics.unitCount,
              )} Einheiten gesamt`}
              icon={Building2}
              label="Immobilien"
              value={integerFormatter.format(metrics.propertyCount)}
              href="/app/immobilien"
            />
            <StatTile
              detail={`${integerFormatter.format(
                metrics.vacantUnitCount,
              )} leer oder in Sanierung`}
              icon={Users}
              label="Vermietet"
              value={`${metrics.occupiedUnitCount}/${metrics.unitCount}`}
              href="/app/mietverhaeltnisse"
            />
            <StatTile
              detail="Nach Anzahl vermietbarer Einheiten"
              icon={Landmark}
              label="Leerstandsquote"
              value={percent(metrics.vacancyRate)}
              href="/app/potenziale"
            />
            <StatTile
              detail="Über alle offenen Mietforderungen"
              icon={AlertTriangle}
              label="Miete offen"
              value={euros(metrics.openRentCents)}
              href="/app/mietverhaeltnisse"
            />
            <StatTile
              detail={
                metrics.loansAvailable
                  ? `LTV ${percent(metrics.loanToValue)}`
                  : "Finanzdaten rollenbedingt ausgeblendet"
              }
              icon={Banknote}
              label="Restschuld"
              value={
                metrics.loansAvailable
                  ? euros(metrics.loanBalanceCents)
                  : "Nicht verfügbar"
              }
              href="/app/finanzierungen"
            />
            <StatTile
              detail="Noch nicht abgeschlossene Vorhaben"
              icon={Wrench}
              label="Sanierungsbedarf"
              value={euros(metrics.plannedRenovationCents)}
              href="/app/sanierungen"
            />
            <StatTile
              detail="Fehlend, unklar oder zu prüfen"
              icon={FileQuestion}
              label="Belege klären"
              value={integerFormatter.format(metrics.unresolvedDocuments)}
              href="/app/belege"
            />
            <StatTile
              detail={`${metrics.expiringLeases} Vertragsende in 12 Monaten`}
              icon={ListChecks}
              label="Offene Aufgaben"
              value={integerFormatter.format(metrics.openTasks)}
              href="/app/aufgaben"
            />
          </section>

          <section className="grid gap-6 xl:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Mietforderung und Zahlungseingang</CardTitle>
                <CardDescription>
                  Fällige Vertragsmiete und bestätigte Zahlungen der letzten
                  zwölf Monate. Der Marktvergleich steht unter Potenziale.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <RentChart data={snapshot.months} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Cashflow vor und nach Finanzierung</CardTitle>
                <CardDescription>
                  Betriebliches Ergebnis getrennt von Zins und Tilgung.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <CashflowChart data={snapshot.months} />
              </CardContent>
            </Card>
          </section>

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
            <Card>
              <CardHeader>
                <CardTitle>Portfolioaufteilung</CardTitle>
                <CardDescription>
                  {metrics.loansAvailable
                    ? "Erfasster Marktwert und daraus abgeleitetes Eigenkapital je Immobilie."
                    : "Erfasster Marktwert; Eigenkapital bleibt ohne rollenberechtigte Finanzierungsdaten ausgeblendet."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PortfolioChart data={snapshot.properties} />
              </CardContent>
            </Card>
            <DashboardActions snapshot={snapshot} />
          </section>

          <PropertyCashflowCards snapshot={snapshot} />

          <section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
            <PropertyTable snapshot={snapshot} />
            <OpenClaims snapshot={snapshot} />
          </section>

          <section className="grid gap-3 md:grid-cols-3">
            <StatTile
              detail="Aktuellen Monatswert auf zwölf Monate hochgerechnet"
              icon={ReceiptText}
              label="Geschätzte Steuerwirkung p.a."
              value={euros(metrics.annualEstimatedTaxEffectCents)}
              href="/app/steuern"
            />
            <StatTile
              detail={
                metrics.loansAvailable
                  ? "Nächstes Ende einer Zinsbindung"
                  : "Finanzdaten rollenbedingt ausgeblendet"
              }
              icon={CalendarClock}
              label="Finanzierungsablauf"
              value={
                metrics.loansAvailable
                  ? date(metrics.nextFinancingExpiry)
                  : "Nicht verfügbar"
              }
              href="/app/finanzierungen"
            />
            <StatTile
              detail="Aktive Vertragskaltmiete im Verhältnis zu erfassten Kaufpreisen"
              icon={TrendingUp}
              label="Bruttomietrendite"
              value={percent(metrics.grossRentalYield)}
              href="/app/potenziale"
            />
          </section>

          <details className="rounded-xl border bg-card px-4 py-3 text-sm">
            <summary className="cursor-pointer font-medium">
              Berechnungen und Annahmen nachvollziehen
            </summary>
            <ul className="mt-3 space-y-2 border-t pt-3 text-sm leading-6 text-muted-foreground">
              {snapshot.assumptions.map((assumption) => (
                <li className="flex gap-2" key={assumption}>
                  <span aria-hidden="true">•</span>
                  <span>{assumption}</span>
                </li>
              ))}
            </ul>
          </details>

          <p className="text-xs leading-5 text-muted-foreground">
            Steuerwerte sind unverbindliche Modellrechnungen und ersetzen keine
            Beratung durch einen Steuerberater. Marktwerte sind manuelle oder
            angebundene Schätzwerte und keine Verkehrswertgutachten.
          </p>
        </div>
      )}
    </>
  );
}
