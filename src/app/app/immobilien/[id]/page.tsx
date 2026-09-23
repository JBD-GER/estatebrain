import { RecordActions } from "@/components/app/record-actions";
import { expensesWithRenovationCompletion } from "@/lib/dashboard/renovation-cashflow";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  FileText,
  Landmark,
  Plus,
  ReceiptText,
  Wrench,
} from "lucide-react";
import { requireOrganization } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  calculateGrossRentalYield,
  calculateVacancyRateByUnits,
  propertyTypeLabel,
} from "@/lib/domain";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});
const number = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat("de-DE", {
  style: "percent",
  maximumFractionDigits: 2,
});
const date = new Intl.DateTimeFormat("de-DE");

const statusLabels: Record<string, string> = {
  active: "Aktiv",
  paid: "Bezahlt",
  open: "Offen",
  partial: "Teilweise",
  reviewed: "Geprüft",
  review_required: "Prüfung erforderlich",
  rented: "Vermietet",
  vacant: "Leerstand",
  renovation: "Sanierung",
  annuity: "Annuitätendarlehen",
  repayment: "Ratentilgungsdarlehen",
  interest_only: "Endfälliges Darlehen",
  variable: "Variables Darlehen",
  other: "Sonstiges",
};

function cents(value: unknown) {
  const amount = Number(value);
  return euro.format(Number.isFinite(amount) ? amount / 100 : 0);
}

function text(value: unknown, fallback = "–") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function status(value: unknown) {
  const key = text(value, "");
  return statusLabels[key] ?? (key ? key.replaceAll("_", " ") : "–");
}

function formatDate(value: unknown) {
  if (typeof value !== "string" || !value) return "–";
  const parsed = new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(parsed.valueOf()) ? "–" : date.format(parsed);
}

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireOrganization();
  const canReadBookkeeping = hasPermission(viewer.role, "bookkeeping.read");
  const canReadFinancing = hasPermission(viewer.role, "financing.read");
  const canCreateFinancing = hasPermission(viewer.role, "financing.write");
  const canUploadDocuments = hasPermission(viewer.role, "documents.write");
  const supabase = await createClient();

  const now = new Date();
  const currentYear = now.getFullYear();
  const elapsedMonths = now.getMonth() + 1;
  const today = now.toISOString().slice(0, 10);
  const yearStart = `${currentYear}-01-01`;
  const nextYearStart = `${currentYear + 1}-01-01`;

  const { data: property } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .eq("organization_id", viewer.organizationId)
    .is("archived_at",null)
    .maybeSingle();

  if (!property) notFound();

  const [
    { data: units },
    { data: loans },
    { data: renovations },
    { data: documents },
    { data: income },
    { data: expenses },
  ] = await Promise.all([
    supabase
      .from("units")
      .select("*")
      .eq("organization_id", viewer.organizationId)
      .eq("property_id", id)
      .is("archived_at", null)
      .order("unit_number"),
    canReadFinancing
      ? supabase
          .from("loans")
          .select("*")
          .eq("organization_id", viewer.organizationId)
          .eq("property_id", id)
          .is("archived_at", null)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase
      .from("renovation_projects")
      .select("*")
      .is("archived_at",null)
      .eq("organization_id", viewer.organizationId)
      .eq("property_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("documents")
      .select("*")
      .eq("organization_id", viewer.organizationId)
      .eq("property_id", id)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    canReadBookkeeping
      ? supabase
          .from("income_entries")
          .select(
            "amount_cents, entry_date, payment_status, bank_transaction_id",
          )
          .eq("organization_id", viewer.organizationId)
          .eq("property_id", id)
          .is("archived_at", null)
          .gte("entry_date", yearStart)
          .lt("entry_date", nextYearStart)
      : Promise.resolve({ data: [] }),
    canReadBookkeeping
      ? supabase
          .from("expense_entries")
          .select(
            "id, renovation_project_id, amount_cents, description, entry_date, payment_status, document_status, is_cash_effective, is_interest, is_principal",
          )
          .eq("organization_id", viewer.organizationId)
          .eq("property_id", id)
          .is("archived_at", null)
          .gte("entry_date", yearStart)
          .lt("entry_date", nextYearStart)
          .order("entry_date", { ascending: false })
      : Promise.resolve({ data: [] }),
  ]);

  const recordRelations = {properties:[{value:property.id,label:property.name}],units:[],tenants:[]};
  const canEditPortfolio = hasPermission(viewer.role,"portfolio.write");
  const unitRows = units ?? [];
  const loanRows = loans ?? [];
  const expenseRows = expenses ?? [];
  const unitIds = unitRows.map((unit) => unit.id);
  const loanIds = loanRows.map((loan) => loan.id);
  const expenseIds = expenseRows.map((expense) => expense.id);

  const [activeLeaseResult, loanPaymentResult, expenseLinkResult] =
    await Promise.all([
      unitIds.length
        ? supabase
            .from("leases")
            .select(
              "id, unit_id, cold_rent_cents, starts_on, ends_on, status",
            )
            .eq("organization_id", viewer.organizationId)
            .in("unit_id", unitIds)
            .is("archived_at", null)
        : Promise.resolve({ data: [] }),
      canReadFinancing && loanIds.length
        ? supabase
            .from("loan_payments")
            .select("loan_id, payment_cents, paid_on, due_date, status")
            .eq("organization_id", viewer.organizationId)
            .in("loan_id", loanIds)
            .eq("status", "paid")
        : Promise.resolve({ data: [] }),
      canReadBookkeeping && expenseIds.length
        ? supabase
            .from("document_links")
            .select("document_id, expense_entry_id")
            .eq("organization_id", viewer.organizationId)
            .eq("link_type", "expense_receipt")
            .in("expense_entry_id", expenseIds)
        : Promise.resolve({ data: [] }),
    ]);

  const propertyLeases = activeLeaseResult.data ?? [];
  const activeLeases = propertyLeases.filter(
    (lease) =>
      lease.status === "active" &&
      lease.starts_on <= today &&
      (!lease.ends_on || lease.ends_on >= today),
  );
  const leaseIds = activeLeases.map((lease) => lease.id);
  const propertyLeaseIds = propertyLeases.map((lease) => lease.id);
  const [rentScheduleResult, rentClaimResult] = await Promise.all([
    leaseIds.length
      ? supabase
          .from("rent_schedules")
          .select("lease_id, cold_rent_cents, valid_from, valid_until")
          .eq("organization_id", viewer.organizationId)
          .in("lease_id", leaseIds)
          .lte("valid_from", today)
          .order("valid_from", { ascending: false })
      : Promise.resolve({ data: [] }),
    canReadBookkeeping && propertyLeaseIds.length
      ? supabase
          .from("rent_claims")
          .select("id")
          .eq("organization_id", viewer.organizationId)
          .in("lease_id", propertyLeaseIds)
      : Promise.resolve({ data: [] }),
  ]);
  const rentSchedules = rentScheduleResult.data ?? [];
  const propertyClaimIds = (rentClaimResult.data ?? []).map(
    (claim) => claim.id,
  );
  const { data: propertyRentPayments } =
    canReadBookkeeping && propertyClaimIds.length
      ? await supabase
          .from("rent_payments")
          .select("amount_cents, bank_transaction_id, paid_on")
          .eq("organization_id", viewer.organizationId)
          .in("rent_claim_id", propertyClaimIds)
          .eq("allocation_status", "confirmed")
          .gte("paid_on", yearStart)
          .lt("paid_on", nextYearStart)
      : { data: [] };

  const currentScheduleByLease = new Map<
    string,
    { cold_rent_cents: number }
  >();
  for (const schedule of rentSchedules) {
    if (
      !currentScheduleByLease.has(schedule.lease_id) &&
      (!schedule.valid_until || schedule.valid_until >= today)
    ) {
      currentScheduleByLease.set(schedule.lease_id, schedule);
    }
  }

  const contractColdRentByUnit = new Map<string, number>();
  for (const lease of activeLeases) {
    const currentColdRent = Number(
      currentScheduleByLease.get(lease.id)?.cold_rent_cents ??
        lease.cold_rent_cents ??
        0,
    );
    contractColdRentByUnit.set(
      lease.unit_id,
      (contractColdRentByUnit.get(lease.unit_id) ?? 0) + currentColdRent,
    );
  }

  const monthlyContractColdRentCents = Array.from(
    contractColdRentByUnit.values(),
  ).reduce((sum, amount) => sum + amount, 0);
  const monthlyTargetColdRentCents = unitRows.reduce(
    (sum, unit) => sum + Number(unit.target_cold_rent_cents ?? 0),
    0,
  );
  const purchasePriceCents = Number(property.purchase_price_cents ?? 0);
  const grossYield =
    monthlyContractColdRentCents > 0 && purchasePriceCents > 0
      ? calculateGrossRentalYield({
          annualColdRentCents: Math.round(monthlyContractColdRentCents * 12),
          purchasePriceCents: Math.round(purchasePriceCents),
        })
      : null;
  const vacancyRate = calculateVacancyRateByUnits({
    vacantUnits: unitRows.filter((unit) => unit.status === "vacant").length,
    totalUnits: unitRows.length,
  });

  const rentPaymentRows = propertyRentPayments ?? [];
  const rentPaymentBankIds = new Set(
    rentPaymentRows
      .map((row) => row.bank_transaction_id)
      .filter((value): value is string => Boolean(value)),
  );
  const paidRentCents = rentPaymentRows.reduce(
    (sum, row) => sum + Number(row.amount_cents ?? 0),
    0,
  );
  const otherPaidIncomeCents = (income ?? [])
    .filter(
      (row) =>
        row.payment_status === "paid" &&
        (!row.bank_transaction_id ||
          !rentPaymentBankIds.has(row.bank_transaction_id)),
    )
    .reduce((sum, row) => sum + Number(row.amount_cents ?? 0), 0);
  const paidIncomeCents = paidRentCents + otherPaidIncomeCents;
  const paidCashExpenses = expenseRows.filter(
    (row) => row.payment_status === "paid" && row.is_cash_effective,
  );
  const cashExpenses = expensesWithRenovationCompletion(paidCashExpenses.map(e=>({propertyId:property.id,renovationProjectId:e.renovation_project_id,entryDate:e.entry_date,amountCents:e.amount_cents,bankTransactionId:null,cashEffective:true,isInterest:e.is_interest,isPrincipal:e.is_principal,isCapitalizable:false,isDeductible:false})), (renovations ?? []).map(r=>({id:r.id,propertyId:r.property_id,name:r.name,status:r.status,priority:r.priority,estimatedCostCents:r.estimated_cost_cents,actualCostCents:r.actual_cost_cents,actualEndDate:r.actual_end_date,plannedStartDate:r.planned_start_date}))).filter(e=>e.entryDate>=yearStart && e.entryDate<=today);
  const totalExpenseCents = cashExpenses.reduce(
    (sum, row) => sum + row.amountCents,
    0,
  );
  const operatingExpenseCents = cashExpenses
    .filter((row) => !row.isInterest && !row.isPrincipal)
    .reduce((sum, row) => sum + row.amountCents, 0);

  const confirmedLoanPayments = (loanPaymentResult.data ?? []).filter((row) => {
    const effectiveDate = row.paid_on ?? row.due_date;
    return effectiveDate >= yearStart && effectiveDate < nextYearStart;
  });
  const paymentsByLoan = new Map<string, number>();
  for (const payment of confirmedLoanPayments) {
    paymentsByLoan.set(
      payment.loan_id,
      (paymentsByLoan.get(payment.loan_id) ?? 0) +
        Number(payment.payment_cents ?? 0),
    );
  }
  const financingSummary = loanRows
    .filter((loan) => loan.status === "active")
    .reduce(
      (summary, loan) => {
      const actual = paymentsByLoan.get(loan.id);
      if (actual !== undefined) {
          return {
            ...summary,
            amountCents: summary.amountCents + actual,
            actualLoanCount: summary.actualLoanCount + 1,
          };
      }
      const forecast = Number(loan.monthly_payment_cents ?? 0) * elapsedMonths;
        return {
          ...summary,
          amountCents: summary.amountCents + forecast,
          forecastLoanCount:
            summary.forecastLoanCount + (forecast > 0 ? 1 : 0),
        };
      },
      { amountCents: 0, actualLoanCount: 0, forecastLoanCount: 0 },
    );
  const financingCashflowCents = financingSummary.amountCents;
  const financingMode =
    financingSummary.actualLoanCount > 0 &&
    financingSummary.forecastLoanCount > 0
      ? "mixed"
      : financingSummary.actualLoanCount > 0
        ? "actual"
        : financingSummary.forecastLoanCount > 0
          ? "forecast"
          : "none";
  const cashflowAfterFinancingCents =
    paidIncomeCents - operatingExpenseCents - financingCashflowCents;

  const documentById = new Map(
    (documents ?? []).map((document) => [document.id, document]),
  );
  const documentIdByExpenseId = new Map<string, string>();
  for (const link of expenseLinkResult.data ?? []) {
    if (link.expense_entry_id) {
      documentIdByExpenseId.set(link.expense_entry_id, link.document_id);
    }
  }
  const receiptExpenses = expenseRows.filter((expense) =>
    documentIdByExpenseId.has(expense.id),
  );

  const address = [
    text(property.street, ""),
    text(property.house_number, ""),
    text(property.postal_code, ""),
    text(property.city, ""),
  ]
    .filter(Boolean)
    .join(" ");
  const propertyMode = (property as unknown as Record<string, unknown>)[
    "property_mode"
  ];

  return (
    <>
      <Button asChild variant="ghost" className="-ml-3 mb-3">
        <Link href="/app/immobilien">
          <ArrowLeft />
          Alle Immobilien
        </Link>
      </Button>

      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-primary">Immobiliendetails</p>
            <Badge variant="secondary">{status(property.status)}</Badge>
            {propertyMode ? (
              <Badge variant="outline">
                {propertyMode === "scenario"
                  ? "Fiktives Szenario"
                  : "Bestandsimmobilie"}
              </Badge>
            ) : null}
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {property.name}
          </h1>
          <p className="mt-2 text-muted-foreground">
            {address || "Keine Adresse"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canEditPortfolio && <RecordActions module="immobilien" record={property} afterDeleteHref="/app/immobilien"/>}
          <Button asChild variant="outline"><Link href={`/app/markt?property=${property.id}`}>Immobilie bewerten</Link></Button>
          {canCreateFinancing ? (
            <Button asChild variant="outline">
              <Link
                href={`/app/finanzierungen?property=${property.id}&create=1`}
              >
                <Landmark />
                Finanzierung hinzufügen
              </Link>
            </Button>
          ) : null}
          {canUploadDocuments ? (
            <Button asChild>
              <Link href={`/app/belege/upload?property=${property.id}`}>
                <FileText />
                Beleg zuordnen
              </Link>
            </Button>
          ) : null}
        </div>
      </header>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          [
            "Marktwert",
            property.current_market_value_cents === null
              ? "Noch nicht bewertet"
              : cents(property.current_market_value_cents),
          ],
          [
            "Vertrags-Kaltmiete (mtl.)",
            activeLeases.length
              ? cents(monthlyContractColdRentCents)
              : "Kein aktiver Vertrag",
          ],
          ["Markt-/SOLL-Kaltmiete (mtl.)", cents(monthlyTargetColdRentCents)],
          [
            "Bruttomietrendite aus Vertrag",
            grossYield === null ? "Nicht berechenbar" : percent.format(grossYield),
          ],
          [
            "Leerstand",
            vacancyRate === null ? "Keine Einheiten" : percent.format(vacancyRate),
          ],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="units">Einheiten</TabsTrigger>
          {canReadFinancing ? (
            <TabsTrigger value="finance">Finanzierung</TabsTrigger>
          ) : null}
          {canReadBookkeeping ? (
            <TabsTrigger value="expenses">Ausgaben & Belege</TabsTrigger>
          ) : null}
          <TabsTrigger value="renovation">Sanierung</TabsTrigger>
          <TabsTrigger value="documents">Dokumente</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5 grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="size-4 text-primary" />
                Stammdaten
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Objekttyp</p>
                <p className="mt-1 font-medium">
                  {propertyTypeLabel(property.property_type)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Baujahr</p>
                <p className="mt-1 font-medium">
                  {property.construction_year ?? "–"}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Vermietbare Fläche</p>
                <p className="mt-1 font-medium">
                  {number.format(Number(property.rentable_area_sqm ?? 0))} m²
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Kaufpreis</p>
                <p className="mt-1 font-medium">
                  {cents(property.purchase_price_cents)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Grundstücksanteil</p>
                <p className="mt-1 font-medium">
                  {property.land_value_cents === null
                    ? "–"
                    : cents(property.land_value_cents)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Gebäudeanteil inkl. Kosten</p>
                <p className="mt-1 font-medium">
                  {property.building_value_cents === null
                    ? "–"
                    : cents(property.building_value_cents)}
                </p>
              </div>
            </CardContent>
          </Card>

          {canReadBookkeeping ? (
            <Card
              className={cn(
                "border-2",
                cashflowAfterFinancingCents >= 0
                  ? "border-emerald-500/30"
                  : "border-destructive/40",
              )}
            >
              <CardHeader>
                <CardTitle className="text-base">
                  Cashflow im Kalenderjahr {currentYear}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">
                    Bezahlte Einnahmen
                  </span>
                  <span className="font-medium text-primary">
                    {cents(paidIncomeCents)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">
                    Operative, bezahlte Ausgaben
                  </span>
                  <span className="font-medium">
                    − {cents(operatingExpenseCents)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">
                    {financingMode === "forecast"
                      ? `Darlehensraten – Prognose bis einschließlich Monat ${elapsedMonths}`
                      : financingMode === "mixed"
                        ? `Darlehenszahlungen ${currentYear} – gebucht und prognostiziert`
                        : `Bestätigte Darlehenszahlungen ${currentYear}`}
                  </span>
                  <span className="font-medium">
                    − {cents(financingCashflowCents)}
                  </span>
                </div>
                <div className="flex justify-between gap-4 border-t pt-3">
                  <span className="font-medium">Cashflow nach Finanzierung</span>
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      cashflowAfterFinancingCents >= 0
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-destructive",
                    )}
                  >
                    {cents(cashflowAfterFinancingCents)}
                  </span>
                </div>
                <div className="flex justify-between gap-4 border-t pt-3">
                  <span>Gesamtausgaben laufendes Jahr</span>
                  <span className="font-semibold">
                    {cents(totalExpenseCents)}
                  </span>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  Bestätigte Mietzahlungen und andere bezahlte Einnahmen werden
                  gemeinsam berücksichtigt. Als Zins oder
                  Tilgung markierte Ausgaben werden im operativen Betrag nicht
                  erneut abgezogen. Für Darlehen ohne bestätigte Zahlung wird
                  die hinterlegte Monatsrate bis zum aktuellen Monat als klar
                  markierte Prognose verwendet.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="units" className="mt-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Einheiten ({unitRows.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Einheit</TableHead>
                    <TableHead>Fläche</TableHead>
                    <TableHead>Vertrags-Kaltmiete (mtl.)</TableHead>
                    <TableHead>Markt-/SOLL-Kaltmiete (mtl.)</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unitRows.map((unit) => {
                    const contractColdRent = contractColdRentByUnit.get(unit.id);
                    return (
                      <TableRow key={unit.id}>
                        <TableCell className="font-medium">
                          {unit.unit_number}
                        </TableCell>
                        <TableCell>
                          {number.format(Number(unit.area_sqm ?? 0))} m²
                        </TableCell>
                        <TableCell>
                          {contractColdRent === undefined
                            ? "Kein aktiver Vertrag"
                            : cents(contractColdRent)}
                        </TableCell>
                        <TableCell>
                          {cents(unit.target_cold_rent_cents)}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{status(unit.status)}</Badge>
                          {canEditPortfolio && <RecordActions module="einheiten" record={unit} relations={recordRelations}/>}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {unitRows.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                  Noch keine Einheiten angelegt.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {canReadFinancing ? (
          <TabsContent
            value="finance"
            className="mt-5 grid gap-4 lg:grid-cols-2"
          >
            <Card className="lg:col-span-2">
              <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-medium">
                    {financingMode === "actual"
                      ? `Bestätigte Darlehenszahlungen ${currentYear}`
                      : financingMode === "mixed"
                        ? `Darlehenszahlungen ${currentYear}: Ist und Prognose`
                        : `Darlehensraten-Prognose bis Monat ${elapsedMonths}`}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {financingMode === "actual"
                      ? `${confirmedLoanPayments.length} bestätigte Zahlung(en)`
                      : financingMode === "mixed"
                        ? "Je Darlehen werden vorhandene Zahlungen genutzt, sonst die Rate"
                        : "Noch keine bestätigte Darlehenszahlung im laufenden Jahr"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <p className="text-xl font-semibold tabular-nums">
                    {cents(financingCashflowCents)}
                  </p>
                  {canCreateFinancing ? (
                    <Button asChild size="sm">
                      <Link
                        href={`/app/finanzierungen?property=${property.id}&create=1`}
                      >
                        <Plus />
                        Finanzierung
                      </Link>
                    </Button>
                  ) : null}
                </div>
              </CardContent>
            </Card>
            {loanRows.map((loan) => (
              <Card key={loan.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Landmark className="size-4 text-primary" />
                    {loan.lender_name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      Finanzierungsart
                    </span>
                    <span>
                      {status(
                        (loan as unknown as Record<string, unknown>)[
                          "loan_type"
                        ],
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">Restschuld</span>
                    <span className="font-medium">
                      {cents(loan.current_balance_cents)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      Darlehensrate (mtl.)
                    </span>
                    <span>{cents(loan.monthly_payment_cents)}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      Sollzins (p.a.)
                    </span>
                    <span>
                      {percent.format(Number(loan.nominal_interest_rate ?? 0))}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      Anfängliche Tilgung (p.a.)
                    </span>
                    <span>
                      {loan.initial_repayment_rate === null
                        ? "–"
                        : percent.format(Number(loan.initial_repayment_rate))}
                    </span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground">
                      Zinsbindung bis
                    </span>
                    <span>{formatDate(loan.fixed_rate_until)}</span>
                  </div>
                  {canCreateFinancing && <RecordActions module="finanzierungen" record={loan} relations={recordRelations}/>}
                </CardContent>
              </Card>
            ))}
            {loanRows.length === 0 ? (
              <Card className="lg:col-span-2">
                <CardContent className="flex flex-col items-start gap-4 p-8 text-sm text-muted-foreground">
                  <p>Für dieses Objekt ist noch keine Finanzierung hinterlegt.</p>
                  {canCreateFinancing ? (
                    <Button asChild>
                      <Link
                        href={`/app/finanzierungen?property=${property.id}&create=1`}
                      >
                        <Plus />
                        Finanzierung hinzufügen
                      </Link>
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>
        ) : null}

        {canReadBookkeeping ? (
          <TabsContent value="expenses" className="mt-5">
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <div>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <ReceiptText className="size-4 text-primary" />
                    Belegausgaben {currentYear}
                  </CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Geprüfte Rechnungen und Belege, die einer Ausgabe dieses
                    Objekts zugeordnet sind.
                  </p>
                </div>
                {canUploadDocuments ? (
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/app/belege/upload?property=${property.id}`}>
                      <Plus />
                      Beleg
                    </Link>
                  </Button>
                ) : null}
              </CardHeader>
              <CardContent className="px-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Datum</TableHead>
                      <TableHead>Beschreibung</TableHead>
                      <TableHead>Beleg</TableHead>
                      <TableHead>Zahlungsstatus</TableHead>
                      <TableHead className="text-right">Betrag</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {receiptExpenses.map((expense) => {
                      const documentId = documentIdByExpenseId.get(expense.id);
                      const document = documentId
                        ? documentById.get(documentId)
                        : undefined;
                      return (
                        <TableRow key={expense.id}>
                          <TableCell>{formatDate(expense.entry_date)}</TableCell>
                          <TableCell className="font-medium">
                            {expense.description}
                          </TableCell>
                          <TableCell>
                            {documentId ? (
                              <a
                                href={`/api/documents/${documentId}/download`}
                                className="text-primary underline-offset-4 hover:underline"
                              >
                                {document?.original_file_name ?? "Beleg öffnen"}
                              </a>
                            ) : (
                              "–"
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {status(expense.payment_status)}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono tabular-nums">
                            {cents(expense.amount_cents)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                {receiptExpenses.length === 0 ? (
                  <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                    Im laufenden Jahr ist noch keine Belegausgabe mit diesem
                    Objekt verknüpft.
                  </p>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}

        <TabsContent value="renovation" className="mt-5 grid gap-4 lg:grid-cols-2">
          {(renovations ?? []).map((project) => (
            <Card key={project.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wrench className="size-4 text-primary" />
                  <Link className="underline" href={`/app/sanierungen/${project.id}`}>{project.name}</Link>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {canEditPortfolio && <RecordActions module="sanierungen" record={project} relations={recordRelations}/>}
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Budget</span>
                  <span>{cents(project.estimated_cost_cents)}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Priorität</span>
                  <Badge variant="secondary">{status(project.priority)}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
          {(renovations ?? []).length === 0 ? (
            <Card>
              <CardContent className="p-8 text-sm text-muted-foreground">
                Keine Sanierungsmaßnahme geplant.
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="documents" className="mt-5">
          <Card>
            <CardContent className="divide-y p-0">
              {(documents ?? []).map((document) => (
                <div
                  key={document.id}
                  className="flex items-center justify-between gap-4 p-5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {document.original_file_name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {status(document.document_type)} ·{" "}
                      {status(document.review_status)}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <a href={`/api/documents/${document.id}/download`}>Öffnen</a>
                  </Button>
                </div>
              ))}
              {(documents ?? []).length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  Keine Dokumente für dieses Objekt.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
