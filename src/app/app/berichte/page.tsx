import Link from "next/link";
import { CircleAlert, Download, FileText, Filter } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { TaxDisclaimer } from "@/components/app/tax-disclaimer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { requireOrganization } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import {
  canAccessSensitiveReportData,
  reportScopeSearchParams,
  resolveReportScope,
} from "@/lib/reports/scope";
import { documentStatusRequiresAttention } from "@/lib/documents/status";
import { fetchAllRows } from "@/lib/supabase/pagination";
import { createClient } from "@/lib/supabase/server";

const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});
const number = new Intl.NumberFormat("de-DE");

function safeYear(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100
    ? parsed
    : fallback;
}

function money(cents: number) {
  return euro.format(cents / 100);
}

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{
    year?: string;
    property?: string;
    unit?: string;
  }>;
}) {
  const viewer = await requireOrganization();
  const canExport = hasPermission(viewer.role, "reports.export");

  if (!canExport) {
    return (
      <>
        <PageHeader
          eyebrow="Nachvollziehbare Jahresmappe"
          title="Berichte & Exporte"
          description="Einnahmen, Ausgaben und Beleglage organisationssicher auswerten."
        />
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>403 · Zugriff verweigert</AlertTitle>
          <AlertDescription>
            Deine aktuelle Rolle darf Berichte und Exporte nicht einsehen. Es
            wurden keine Berichts-, Bank- oder Steuerdaten abgefragt.
          </AlertDescription>
        </Alert>
      </>
    );
  }

  const params = await searchParams;
  const currentYear = new Date().getFullYear();
  const year = safeYear(params.year, currentYear);
  const start = `${year}-01-01`;
  const end = `${year + 1}-01-01`;
  const supabase = await createClient();
  const canAccessSensitiveData = canAccessSensitiveReportData(viewer.role);

  const [
    taxYearsResult,
    propertiesResult,
    unitsResult,
    taxProfileResult,
  ] = await Promise.all([
    canAccessSensitiveData
      ? fetchAllRows(
          (from, to) =>
            supabase
              .from("tax_years")
              .select("id, year, status, locked_at")
              .eq("organization_id", viewer.organizationId)
              .order("year", { ascending: false })
              .order("id")
              .range(from, to),
          { label: "Steuerjahre" },
        )
      : Promise.resolve({ data: [], error: null }),
    fetchAllRows(
      (from, to) =>
        supabase
          .from("properties")
          .select("id, name, city")
          .eq("organization_id", viewer.organizationId)
          .eq("property_mode", "existing")
          .is("archived_at", null)
          .order("name")
          .order("id")
          .range(from, to),
      { label: "Immobilien" },
    ),
    fetchAllRows(
      (from, to) =>
        supabase
          .from("units")
          .select("id, property_id, unit_number")
          .eq("organization_id", viewer.organizationId)
          .is("archived_at", null)
          .order("unit_number")
          .order("id")
          .range(from, to),
      { label: "Einheiten" },
    ),
    canAccessSensitiveData
      ? supabase
          .from("tax_profiles")
          .select("effective_tax_rate, marginal_tax_rate, calculations_enabled")
          .eq("organization_id", viewer.organizationId)
          .eq("user_id", viewer.userId)
          .eq("calculations_enabled", true)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const initialLoadFailed = Boolean(
    propertiesResult.error || unitsResult.error || taxYearsResult.error,
  );
  const reportPropertyIds = new Set(
    (propertiesResult.data ?? []).map((property) => property.id),
  );
  const reportUnits = (unitsResult.data ?? []).filter((unit) =>
    reportPropertyIds.has(unit.property_id),
  );
  const scopeResolution = resolveReportScope({
    propertyParam: params.property,
    unitParam: params.unit,
    properties: propertiesResult.data ?? [],
    units: reportUnits,
  });
  if (initialLoadFailed || !scopeResolution.scope) {
    return (
      <>
        <PageHeader
          eyebrow="Nachvollziehbare Jahresmappe"
          title="Berichte & Exporte"
          description="Einnahmen, Ausgaben und Beleglage organisationssicher auswerten."
        />
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Berichtsfilter nicht verfügbar</AlertTitle>
          <AlertDescription>
            {initialLoadFailed
              ? "Immobilien oder Einheiten konnten nicht vollständig geladen werden."
              : scopeResolution.error}
          </AlertDescription>
          <Button asChild variant="outline" className="mt-4">
            <Link href={`/app/berichte?year=${year}`}>Filter zurücksetzen</Link>
          </Button>
        </Alert>
      </>
    );
  }
  const scope = scopeResolution.scope;
  const propertyId = scope.propertyId;
  const unitId = scope.unitId;
  const scopeUnitIds = reportUnits
    .filter(
      (unit) =>
        (!propertyId || unit.property_id === propertyId) &&
        (!unitId || unit.id === unitId),
    )
    .map((unit) => unit.id);
  const rentLeaseResult = scopeUnitIds.length
    ? await fetchAllRows(
        (from, to) =>
          supabase
            .from("leases")
            .select("id")
            .eq("organization_id", viewer.organizationId)
            .in("unit_id", scopeUnitIds)
            .is("archived_at", null)
            .order("id")
            .range(from, to),
        { label: "Mietverhältnisse für Mietzahlungen" },
      )
    : { data: [], error: null };
  const rentLeaseIds = (rentLeaseResult.data ?? []).map((lease) => lease.id);
  const rentClaimResult = rentLeaseIds.length
    ? await fetchAllRows(
        (from, to) =>
          supabase
            .from("rent_claims")
            .select("id")
            .eq("organization_id", viewer.organizationId)
            .in("lease_id", rentLeaseIds)
            .order("id")
            .range(from, to),
        { label: "Mietforderungen für Mietzahlungen" },
      )
    : { data: [], error: null };
  const rentClaimIds = (rentClaimResult.data ?? []).map((claim) => claim.id);
  const rentPaymentResult = rentClaimIds.length
    ? await fetchAllRows(
        (from, to) =>
          supabase
            .from("rent_payments")
            .select("amount_cents, bank_transaction_id")
            .eq("organization_id", viewer.organizationId)
            .in("rent_claim_id", rentClaimIds)
            .eq("allocation_status", "confirmed")
            .gte("paid_on", start)
            .lt("paid_on", end)
            .order("paid_on")
            .order("id")
            .range(from, to),
        { label: "Bestätigte Mietzahlungen" },
      )
    : { data: [], error: null };

  const selectedTaxYear = (taxYearsResult.data ?? []).find(
    (taxYear) => taxYear.year === year,
  );
  const [
    incomeResult,
    expenseResult,
    documentsResult,
    bankResult,
    assumptionsCountResult,
    unconfirmedAssumptionsCountResult,
  ] = await Promise.all([
    fetchAllRows(
      (from, to) => {
        let query = supabase
          .from("income_entries")
          .select("amount_cents, payment_status, bank_transaction_id")
          .eq("organization_id", viewer.organizationId)
          .is("archived_at", null)
          .gte("entry_date", start)
          .lt("entry_date", end);
        if (propertyId) query = query.eq("property_id", propertyId);
        if (unitId) query = query.eq("unit_id", unitId);
        return query.order("entry_date").order("id").range(from, to);
      },
      { label: "Einnahmen" },
    ),
    fetchAllRows(
      (from, to) => {
        let query = supabase
          .from("expense_entries")
          .select("amount_cents, payment_status, document_status")
          .eq("organization_id", viewer.organizationId)
          .is("archived_at", null)
          .gte("entry_date", start)
          .lt("entry_date", end);
        if (propertyId) query = query.eq("property_id", propertyId);
        if (unitId) query = query.eq("unit_id", unitId);
        return query.order("entry_date").order("id").range(from, to);
      },
      { label: "Ausgaben" },
    ),
    fetchAllRows(
      (from, to) => {
        let query = supabase
          .from("documents")
          .select("id, review_status, document_type")
          .eq("organization_id", viewer.organizationId)
          .is("archived_at", null)
          .gte("created_at", `${start}T00:00:00.000Z`)
          .lt("created_at", `${end}T00:00:00.000Z`);
        if (propertyId) query = query.eq("property_id", propertyId);
        if (unitId) query = query.eq("unit_id", unitId);
        return query.order("created_at").order("id").range(from, to);
      },
      { label: "Dokumente" },
    ),
    canAccessSensitiveData && !scope.hasObjectFilter
      ? supabase
          .from("bank_transactions")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", viewer.organizationId)
          .eq("is_ignored", false)
          .in("match_status", ["unmatched", "suggested"])
          .gte("booked_on", start)
          .lt("booked_on", end)
      : Promise.resolve({ data: null, error: null, count: null }),
    selectedTaxYear && canAccessSensitiveData
      ? (() => {
          let query = supabase
            .from("tax_assumptions")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", viewer.organizationId)
            .eq("tax_year_id", selectedTaxYear.id);
          if (propertyId) {
            query = query.or(
              `property_id.is.null,property_id.eq.${propertyId}`,
            );
          }
          return query;
        })()
      : Promise.resolve({ data: null, error: null, count: null }),
    selectedTaxYear && canAccessSensitiveData
      ? (() => {
          let query = supabase
            .from("tax_assumptions")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", viewer.organizationId)
            .eq("tax_year_id", selectedTaxYear.id)
            .eq("is_user_confirmed", false);
          if (propertyId) {
            query = query.or(
              `property_id.is.null,property_id.eq.${propertyId}`,
            );
          }
          return query;
        })()
      : Promise.resolve({ data: null, error: null, count: null }),
  ]);

  const failed = [
    taxProfileResult,
    rentLeaseResult,
    rentClaimResult,
    rentPaymentResult,
    incomeResult,
    expenseResult,
    documentsResult,
    bankResult,
    assumptionsCountResult,
    unconfirmedAssumptionsCountResult,
  ].some((result) => result.error);
  const income = incomeResult.data ?? [];
  const expenses = expenseResult.data ?? [];
  const documents = documentsResult.data ?? [];
  const rentPayments = rentPaymentResult.data ?? [];
  const rentPaymentBankIds = new Set(
    rentPayments
      .map((payment) => payment.bank_transaction_id)
      .filter((value): value is string => Boolean(value)),
  );
  const paidIncomeCents =
    rentPayments.reduce(
      (sum, payment) => sum + Number(payment.amount_cents),
      0,
    ) +
    income
      .filter(
        (entry) =>
          entry.payment_status === "paid" &&
          (!entry.bank_transaction_id ||
            !rentPaymentBankIds.has(entry.bank_transaction_id)),
      )
      .reduce((sum, entry) => sum + Number(entry.amount_cents), 0);
  const paidExpenseCents = expenses
    .filter((entry) => entry.payment_status === "paid")
    .reduce((sum, entry) => sum + Number(entry.amount_cents), 0);
  const missingReceipts = expenses.filter((entry) =>
    documentStatusRequiresAttention(entry.document_status),
  ).length;
  const reviewDocuments = documents.filter(
    (document) =>
      !["complete", "reviewed"].includes(document.review_status),
  ).length;
  const assumedRate = taxProfileResult.data
    ? Number(
        taxProfileResult.data.effective_tax_rate ??
          taxProfileResult.data.marginal_tax_rate,
      )
    : null;
  const validRate =
    assumedRate !== null && Number.isFinite(assumedRate) ? assumedRate : null;
  const estimatedTaxEffectCents =
    validRate === null
      ? null
      : Math.round(
          Math.max(0, paidIncomeCents - paidExpenseCents) * validRate,
        );
  const availableYears = Array.from(
    new Set([
      currentYear,
      year,
      ...(taxYearsResult.data ?? []).map((taxYear) => taxYear.year),
    ]),
  ).sort((a, b) => b - a);
  const filteredUnits = reportUnits.filter(
    (unit) => !propertyId || unit.property_id === propertyId,
  );
  const exportQuery = reportScopeSearchParams(year, scope);
  const bankPositionCount = bankResult.count;
  const assumptionCount = assumptionsCountResult.count;
  const unconfirmedAssumptionCount =
    unconfirmedAssumptionsCountResult.count;
  const dataQualityRows = [
    {
      label: "Ausgaben ohne vollständigen Beleg",
      value: number.format(missingReceipts),
      hasIssue: missingReceipts > 0,
    },
    {
      label: "Dokumente noch zu prüfen",
      value: number.format(reviewDocuments),
      hasIssue: reviewDocuments > 0,
    },
    {
      label: "Ungeklärte Bankpositionen",
      value: !canAccessSensitiveData
        ? "Rollenbedingt nicht verfügbar"
        : scope.hasObjectFilter
          ? "Nicht objektbezogen"
          : bankPositionCount === null
            ? "Nicht verfügbar"
            : number.format(bankPositionCount),
      hasIssue:
        !scope.hasObjectFilter &&
        bankPositionCount !== null &&
        bankPositionCount > 0,
    },
    {
      label: "Unbestätigte Steuerannahmen",
      value: !canAccessSensitiveData
        ? "Rollenbedingt nicht verfügbar"
        : !selectedTaxYear
          ? "Kein Steuerjahr"
          : unconfirmedAssumptionCount === null
            ? "Nicht verfügbar"
            : number.format(unconfirmedAssumptionCount),
      hasIssue:
        unconfirmedAssumptionCount !== null &&
        unconfirmedAssumptionCount > 0,
    },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Nachvollziehbare Jahresmappe"
        title="Berichte & Exporte"
        description="Einnahmen, Ausgaben, Beleglage, ungeklärte Positionen und verwendete Annahmen als Vorbereitung zusammenführen."
        actions={
          canExport ? (
            <>
              <Button asChild variant="outline">
                <Link href={`/api/exports/csv?resource=annual&${exportQuery}`}>
                  <Download />
                  Jahres-CSV
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/api/exports/pdf?${exportQuery}`}>
                  <FileText />
                  Jahres-PDF
                </Link>
              </Button>
            </>
          ) : undefined
        }
      />

      <TaxDisclaimer compact />

      <Card className="my-6">
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Filter className="size-4" />
              Auswertung filtern
            </CardTitle>
            <Badge variant="outline">Bereich: {scope.label}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4 md:grid-cols-[1fr_1.5fr_1.5fr_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="year">Steuerjahr</Label>
              <select
                id="year"
                name="year"
                defaultValue={year}
                className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              >
                {availableYears.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="property">Immobilie</Label>
              <select
                id="property"
                name="property"
                defaultValue={propertyId ?? ""}
                className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              >
                <option value="">Alle Immobilien</option>
                {(propertiesResult.data ?? []).map((property) => (
                  <option key={property.id} value={property.id}>
                    {property.name}
                    {property.city ? ` · ${property.city}` : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="unit">Einheit</Label>
              <select
                id="unit"
                name="unit"
                defaultValue={unitId ?? ""}
                className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
              >
                <option value="">Alle Einheiten</option>
                {filteredUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.unit_number}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit">Anwenden</Button>
          </form>
        </CardContent>
      </Card>

      {!canAccessSensitiveData ? (
        <Alert className="mb-6">
          <CircleAlert />
          <AlertTitle>Bank- und Steuerdaten rollenbedingt geschützt</AlertTitle>
          <AlertDescription>
            Der Bericht enthält für diese Rolle Einnahmen, Ausgaben und Belege.
            Persönliche Steuerannahmen und Bankpositionen werden weder abgefragt
            noch als Nullwerte ausgegeben.
          </AlertDescription>
        </Alert>
      ) : scope.hasObjectFilter ? (
        <Alert className="mb-6">
          <CircleAlert />
          <AlertTitle>Objektbezogene Auswertung</AlertTitle>
          <AlertDescription>
            Ungeklärte Bankpositionen sind noch keinem Objekt zugeordnet und
            deshalb aus diesem Filter ausgeschlossen. Steuerannahmen umfassen
            organisationsweite sowie für die zugehörige Immobilie hinterlegte
            Annahmen.
          </AlertDescription>
        </Alert>
      ) : null}

      {failed ? (
        <Alert variant="destructive" className="mb-6">
          <CircleAlert />
          <AlertTitle>Auswertung unvollständig</AlertTitle>
          <AlertDescription>
            Mindestens ein Datenbereich konnte nicht geladen werden. Exporte
            wurden nicht durch Ersatzdaten ergänzt.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Bezahlte Einnahmen inkl. Miete", money(paidIncomeCents)],
          ["Bezahlte Ausgaben", money(paidExpenseCents)],
          ["Saldo vor Steuerwirkung", money(paidIncomeCents - paidExpenseCents)],
          [
            "Geschätzte Steuerwirkung",
            !canAccessSensitiveData
              ? "Rollenbedingt nicht verfügbar"
              : estimatedTaxEffectCents === null
                ? "Keine Annahme"
              : money(estimatedTaxEffectCents),
          ],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-semibold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Datenqualität {year}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {dataQualityRows.map((item) => (
              <div
                key={item.label}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <span className="text-sm">{item.label}</span>
                <Badge variant={item.hasIssue ? "destructive" : "secondary"}>
                  {item.value}
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Verwendete Annahmen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-4 rounded-lg border px-4 py-3">
              <span>Persönlicher Steuersatz</span>
              <strong>
                {!canAccessSensitiveData
                  ? "Rollenbedingt nicht verfügbar"
                  : validRate === null
                  ? "Nicht hinterlegt"
                  : `${number.format(validRate * 100)} %`}
              </strong>
            </div>
            <div className="flex justify-between gap-4 rounded-lg border px-4 py-3">
              <span>Steuerjahr-Status</span>
              <strong>
                {!canAccessSensitiveData
                  ? "Rollenbedingt nicht verfügbar"
                  : selectedTaxYear?.status ?? "Noch nicht angelegt"}
              </strong>
            </div>
            <div className="flex justify-between gap-4 rounded-lg border px-4 py-3">
              <span>Dokumentierte Detailannahmen</span>
              <strong>
                {!canAccessSensitiveData
                  ? "Rollenbedingt nicht verfügbar"
                  : !selectedTaxYear
                    ? "Kein Steuerjahr"
                    : assumptionCount === null
                      ? "Nicht verfügbar"
                      : number.format(assumptionCount)}
              </strong>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Diese Ansicht und ihre Exporte sind eine Arbeitsvorbereitung,
              keine Steuererklärung und keine Steuerberatung.
            </p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
