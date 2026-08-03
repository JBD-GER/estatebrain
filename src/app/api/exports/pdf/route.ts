import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { createPortfolioReportPdf } from "@/lib/exports/pdf";
import {
  canAccessSensitiveReportData,
  resolveReportScope,
} from "@/lib/reports/scope";
import { documentStatusRequiresAttention } from "@/lib/documents/status";
import { fetchAllRows } from "@/lib/supabase/pagination";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0",
  "X-Content-Type-Options": "nosniff",
};

function berlinDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  return Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value]),
  ) as Record<"year" | "month" | "day", string>;
}

function sum(
  rows: Array<Record<string, unknown>>,
  key: string,
) {
  return rows.reduce((total, row) => {
    const value = Number(row[key]);
    return Number.isFinite(value) ? total + value : total;
  }, 0);
}

function reportingYearFrom(request: NextRequest, fallback: number) {
  const raw = request.nextUrl.searchParams.get("year");
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100
    ? parsed
    : null;
}

export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Bitte zuerst anmelden." },
      { status: 401, headers: noStoreHeaders },
    );
  }
  if (!viewer.organizationId || !viewer.role) {
    return NextResponse.json(
      { error: "Keine aktive Organisation ausgewählt." },
      { status: 403, headers: noStoreHeaders },
    );
  }
  if (!hasPermission(viewer.role, "reports.export")) {
    return NextResponse.json(
      { error: "Keine Berechtigung für PDF-Berichte." },
      { status: 403, headers: noStoreHeaders },
    );
  }
  const organizationId = viewer.organizationId;

  const now = new Date();
  const dateParts = berlinDateParts(now);
  const reportingYear = reportingYearFrom(request, Number(dateParts.year));
  if (reportingYear === null) {
    return NextResponse.json(
      { error: "Ungültiges Berichtsjahr." },
      { status: 400, headers: noStoreHeaders },
    );
  }
  const yearStart = `${reportingYear}-01-01`;
  const nextYearStart = `${reportingYear + 1}-01-01`;
  const supabase = await createClient();
  const canAccessSensitiveData = canAccessSensitiveReportData(viewer.role);

  const [propertiesResult, unitsResult] = await Promise.all([
    fetchAllRows(
      (from, to) =>
        supabase
          .from("properties")
          .select(
            "id, name, city, status, current_market_value_cents, purchase_price_cents",
          )
          .eq("organization_id", organizationId)
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
          .select("id, property_id, unit_number, status")
          .eq("organization_id", organizationId)
          .is("archived_at", null)
          .order("unit_number")
          .order("id")
          .range(from, to),
      { label: "Einheiten" },
    ),
  ]);
  if (propertiesResult.error || unitsResult.error) {
    return NextResponse.json(
      { error: "Der Objektbestand konnte nicht vollständig geladen werden." },
      { status: 502, headers: noStoreHeaders },
    );
  }

  const reportPropertyIds = new Set(
    (propertiesResult.data ?? []).map((property) => property.id),
  );
  const reportUnits = (unitsResult.data ?? []).filter((unit) =>
    reportPropertyIds.has(unit.property_id),
  );
  const scopeResolution = resolveReportScope({
    propertyParam: request.nextUrl.searchParams.get("property"),
    unitParam: request.nextUrl.searchParams.get("unit"),
    properties: propertiesResult.data ?? [],
    units: reportUnits,
  });
  if (!scopeResolution.scope) {
    return NextResponse.json(
      { error: scopeResolution.error },
      { status: 400, headers: noStoreHeaders },
    );
  }
  const scope = scopeResolution.scope;
  const properties = (propertiesResult.data ?? []).filter(
    (property) => !scope.propertyId || property.id === scope.propertyId,
  );
  const units = reportUnits.filter(
    (unit) =>
      (!scope.propertyId || unit.property_id === scope.propertyId) &&
      (!scope.unitId || unit.id === scope.unitId),
  );
  const scopedUnitIds = new Set(units.map((unit) => unit.id));

  const [
    leasesResult,
    loansResult,
    incomeResult,
    expensesResult,
    rentClaimsResult,
    taxProfileResult,
    unresolvedTransactionsResult,
  ] = await Promise.all([
    fetchAllRows(
      (from, to) =>
        supabase
          .from("leases")
          .select("id, unit_id, status")
          .eq("organization_id", organizationId)
          .is("archived_at", null)
          .order("id")
          .range(from, to),
      { label: "Mietverhältnisse" },
    ),
    canAccessSensitiveData
      ? fetchAllRows(
          (from, to) => {
            let query = supabase
              .from("loans")
              .select("current_balance_cents, property_id, status")
              .eq("organization_id", organizationId)
              .is("archived_at", null)
              .eq("status", "active");
            if (scope.propertyId) {
              query = query.eq("property_id", scope.propertyId);
            }
            return query.order("id").range(from, to);
          },
          { label: "Finanzierungen" },
        )
      : Promise.resolve({ data: [], error: null }),
    fetchAllRows(
      (from, to) => {
        let query = supabase
          .from("income_entries")
          .select("amount_cents, payment_status, bank_transaction_id")
          .eq("organization_id", organizationId)
          .is("archived_at", null)
          .gte("entry_date", yearStart)
          .lt("entry_date", nextYearStart);
        if (scope.propertyId) {
          query = query.eq("property_id", scope.propertyId);
        }
        if (scope.unitId) query = query.eq("unit_id", scope.unitId);
        return query.order("entry_date").order("id").range(from, to);
      },
      { label: "Einnahmen" },
    ),
    fetchAllRows(
      (from, to) => {
        let query = supabase
          .from("expense_entries")
          .select("amount_cents, payment_status, document_status")
          .eq("organization_id", organizationId)
          .is("archived_at", null)
          .gte("entry_date", yearStart)
          .lt("entry_date", nextYearStart);
        if (scope.propertyId) {
          query = query.eq("property_id", scope.propertyId);
        }
        if (scope.unitId) query = query.eq("unit_id", scope.unitId);
        return query.order("entry_date").order("id").range(from, to);
      },
      { label: "Ausgaben" },
    ),
    fetchAllRows(
      (from, to) =>
        supabase
          .from("rent_claims")
          .select("lease_id, amount_cents, paid_cents, status")
          .eq("organization_id", organizationId)
          .gte("claim_month", yearStart)
          .lt("claim_month", nextYearStart)
          .in("status", ["open", "partial"])
          .order("claim_month")
          .order("id")
          .range(from, to),
      { label: "Mietforderungen" },
    ),
    canAccessSensitiveData
      ? supabase
          .from("tax_profiles")
          .select("effective_tax_rate, marginal_tax_rate")
          .eq("organization_id", organizationId)
          .eq("user_id", viewer.userId)
          .eq("calculations_enabled", true)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    canAccessSensitiveData && !scope.hasObjectFilter
      ? supabase
          .from("bank_transactions")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", organizationId)
          .eq("is_ignored", false)
          .in("match_status", ["unmatched", "suggested"])
          .gte("booked_on", yearStart)
          .lt("booked_on", nextYearStart)
      : Promise.resolve({ data: null, error: null, count: null }),
  ]);

  const results = [
    leasesResult,
    loansResult,
    incomeResult,
    expensesResult,
    rentClaimsResult,
    taxProfileResult,
    unresolvedTransactionsResult,
  ];
  if (results.some((result) => result.error)) {
    return NextResponse.json(
      { error: "Der PDF-Bericht konnte nicht vollständig erstellt werden." },
      { status: 502, headers: noStoreHeaders },
    );
  }

  const leases = (leasesResult.data ?? []).filter(
    (lease) => !scope.hasObjectFilter || scopedUnitIds.has(lease.unit_id),
  );
  const scopedLeaseIds = new Set(leases.map((lease) => lease.id));
  const rentPaymentClaimResult = scopedLeaseIds.size
    ? await fetchAllRows(
        (from, to) =>
          supabase
            .from("rent_claims")
            .select("id")
            .eq("organization_id", organizationId)
            .in("lease_id", [...scopedLeaseIds])
            .order("id")
            .range(from, to),
        { label: "Mietforderungen für Zahlungen" },
      )
    : { data: [], error: null };
  const rentPaymentClaimIds = (rentPaymentClaimResult.data ?? []).map(
    (claim) => claim.id,
  );
  const confirmedRentPaymentsResult = rentPaymentClaimIds.length
    ? await fetchAllRows(
        (from, to) =>
          supabase
            .from("rent_payments")
            .select("amount_cents, bank_transaction_id")
            .eq("organization_id", organizationId)
            .in("rent_claim_id", rentPaymentClaimIds)
            .eq("allocation_status", "confirmed")
            .gte("paid_on", yearStart)
            .lt("paid_on", nextYearStart)
            .order("paid_on")
            .order("id")
            .range(from, to),
        { label: "Bestätigte Mietzahlungen" },
      )
    : { data: [], error: null };
  if (rentPaymentClaimResult.error || confirmedRentPaymentsResult.error) {
    return NextResponse.json(
      { error: "Die bestätigten Mietzahlungen konnten nicht geladen werden." },
      { status: 502, headers: noStoreHeaders },
    );
  }
  const loans = loansResult.data ?? [];
  const income = incomeResult.data ?? [];
  const expenses = expensesResult.data ?? [];
  const rentClaims = (rentClaimsResult.data ?? []).filter(
    (claim) =>
      !scope.hasObjectFilter || scopedLeaseIds.has(claim.lease_id),
  );
  const confirmedRentPayments = confirmedRentPaymentsResult.data ?? [];
  const rentPaymentBankIds = new Set(
    confirmedRentPayments
      .map((payment) => payment.bank_transaction_id)
      .filter((value): value is string => Boolean(value)),
  );
  const paidIncome = income.filter(
    (entry) =>
      entry.payment_status === "paid" &&
      (!entry.bank_transaction_id ||
        !rentPaymentBankIds.has(entry.bank_transaction_id)),
  );
  const paidExpenses = expenses.filter(
    (entry) => entry.payment_status === "paid",
  );
  const paidIncomeCents =
    sum(
      paidIncome as unknown as Array<Record<string, unknown>>,
      "amount_cents",
    ) +
    sum(
      confirmedRentPayments as unknown as Array<Record<string, unknown>>,
      "amount_cents",
    );
  const paidExpenseCents = sum(
    paidExpenses as unknown as Array<Record<string, unknown>>,
    "amount_cents",
  );
  const assumedTaxRate = taxProfileResult.data
    ? Number(
        taxProfileResult.data.effective_tax_rate ??
          taxProfileResult.data.marginal_tax_rate,
      )
    : null;
  const validTaxRate =
    assumedTaxRate !== null && Number.isFinite(assumedTaxRate)
      ? assumedTaxRate
      : null;
  const openRentCents = rentClaims.reduce(
    (total, claim) =>
      total + Math.max(0, Number(claim.amount_cents) - Number(claim.paid_cents)),
    0,
  );

  const pdf = createPortfolioReportPdf({
    organizationName: viewer.organizationName ?? "Meine Verwaltung",
    generatedAt: now,
    reportingYear,
    scopeLabel: scope.label,
    sensitiveDataAvailable: canAccessSensitiveData,
    metrics: {
      propertyCount: properties.length,
      unitCount: units.length,
      occupiedUnitCount: units.filter((unit) => unit.status === "rented").length,
      activeLeaseCount: leases.filter((lease) =>
        ["active", "notice_given"].includes(lease.status),
      ).length,
      marketValueCents: properties.reduce(
        (total, property) =>
          total +
          Number(
            property.current_market_value_cents ??
              property.purchase_price_cents ??
              0,
          ),
        0,
      ),
      loanBalanceCents: canAccessSensitiveData
        ? sum(
            loans as unknown as Array<Record<string, unknown>>,
            "current_balance_cents",
          )
        : null,
      paidIncomeCents,
      paidExpenseCents,
      openRentCents,
      missingReceiptCount: expenses.filter((entry) =>
        documentStatusRequiresAttention(entry.document_status),
      ).length,
      unresolvedTransactionCount: unresolvedTransactionsResult.count,
      assumedTaxRate: validTaxRate,
      estimatedTaxEffectCents:
        validTaxRate === null
          ? null
          : Math.round(
              Math.max(0, paidIncomeCents - paidExpenseCents) * validTaxRate,
            ),
    },
    properties: properties.map((property) => ({
      name: property.name,
      city: property.city,
      status: property.status,
      marketValueCents: Number(property.current_market_value_cents ?? 0),
      purchasePriceCents: Number(property.purchase_price_cents ?? 0),
    })),
  });
  const fileDate = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      ...noStoreHeaders,
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="estate-brain-jahresauswertung-${reportingYear}-${fileDate}.pdf"`,
      "Content-Length": String(pdf.byteLength),
    },
  });
}
