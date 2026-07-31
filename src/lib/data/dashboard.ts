import "server-only";

import {
  calculateDepreciation,
  roundHalfAwayFromZero,
  sumCents,
} from "@/lib/domain";
import { requireOrganization } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { buildDashboardSnapshot } from "@/lib/dashboard/snapshot";
import type {
  DashboardExpenseSource,
  DashboardIncomeSource,
  DashboardLeaseSource,
  DashboardLoanSource,
  DashboardPropertySource,
  DashboardRenovationSource,
  DashboardRentClaimSource,
  DashboardRentPaymentSource,
  DashboardTaskSource,
  DashboardUnitSource,
} from "@/lib/dashboard/snapshot";
import { fetchAllRows } from "@/lib/supabase/pagination";
import { createClient } from "@/lib/supabase/server";

type UnknownRow = Record<string, unknown>;
const RENT_INCOME_CATEGORIES = new Set([
  "rent",
  "base_rent",
  "cold_rent",
  "service_charge",
  "ancillary",
  "parking",
  "other_rent",
]);

type QueryResult = {
  data: unknown;
  error: { message?: string } | null;
};

function dateInBerlin(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function firstDashboardMonth(anchorDate: string) {
  const [year, month] = anchorDate.slice(0, 7).split("-").map(Number);
  return new Date(Date.UTC(year, month - 12, 1)).toISOString().slice(0, 10);
}

function asRows(data: unknown): UnknownRow[] {
  return Array.isArray(data)
    ? data.filter(
        (row): row is UnknownRow =>
          typeof row === "object" && row !== null && !Array.isArray(row),
      )
    : [];
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function optionalText(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function boolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function finiteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (
    typeof value === "string" &&
    value.trim() !== "" &&
    Number.isFinite(Number(value))
  ) {
    return Number(value);
  }
  return null;
}

function cents(
  value: unknown,
  issues: Set<string>,
  options: { optional?: boolean } = {},
) {
  if (value === null || value === undefined) {
    return options.optional ? null : 0;
  }
  const parsed = finiteNumber(value);
  if (
    parsed === null ||
    parsed < 0 ||
    !Number.isSafeInteger(parsed)
  ) {
    issues.add(
      "Mindestens ein Geldbetrag konnte nicht sicher verarbeitet werden und wurde in der Kennzahl ausgelassen.",
    );
    return options.optional ? null : 0;
  }
  return parsed;
}

function rate(value: unknown, issues: Set<string>) {
  if (value === null || value === undefined) return null;
  const parsed = finiteNumber(value);
  if (parsed === null || parsed < 0 || parsed > 1) {
    issues.add(
      "Mindestens eine Prozentannahme war ungültig und wurde nicht verwendet.",
    );
    return null;
  }
  return parsed;
}

function priority(
  value: unknown,
): "low" | "medium" | "high" | "urgent" {
  return value === "low" ||
    value === "high" ||
    value === "urgent" ||
    value === "medium"
    ? value
    : "medium";
}

function queryIssue(
  result: QueryResult,
  label: string,
  issues: Set<string>,
) {
  if (result.error) {
    issues.add(`${label} konnten nicht vollständig geladen werden.`);
  }
}

export async function getLiveDashboardSnapshot() {
  const viewer = await requireOrganization();
  const supabase = await createClient();
  const asOfDate = dateInBerlin();
  const historyStart = firstDashboardMonth(asOfDate);
  const bookkeepingAvailable = hasPermission(
    viewer.role,
    "bookkeeping.read",
  );
  const loansAvailable = hasPermission(viewer.role, "financing.read");
  const taxDataAvailable = hasPermission(viewer.role, "tax.read");
  const results = await Promise.all([
    fetchAllRows(
      (from, to) =>
        supabase
          .from("properties")
          .select(
            "id,name,purchase_price_cents,acquisition_costs_cents,building_value_cents,current_market_value_cents,purchase_date,status",
          )
          .eq("organization_id", viewer.organizationId)
          .is("archived_at", null)
          .order("id")
          .range(from, to),
      { label: "Immobilien" },
    ),
    fetchAllRows(
      (from, to) =>
        supabase
          .from("units")
          .select("id,property_id,unit_number,area_sqm,status")
          .eq("organization_id", viewer.organizationId)
          .is("archived_at", null)
          .order("id")
          .range(from, to),
      { label: "Einheiten" },
    ),
    fetchAllRows(
      (from, to) =>
        supabase
          .from("leases")
          .select(
            "id,unit_id,starts_on,ends_on,cold_rent_cents,ancillary_prepayment_cents,parking_rent_cents,other_rent_cents,status",
          )
          .eq("organization_id", viewer.organizationId)
          .is("archived_at", null)
          .order("id")
          .range(from, to),
      { label: "Mietverhältnisse" },
    ),
    fetchAllRows(
      (from, to) =>
        supabase
          .from("rent_claims")
          .select(
            "id,lease_id,claim_month,due_date,amount_cents,paid_cents,status",
          )
          .eq("organization_id", viewer.organizationId)
          .neq("status", "cancelled")
          .order("id")
          .range(from, to),
      { label: "Mietforderungen" },
    ),
    fetchAllRows(
      (from, to) =>
        supabase
          .from("rent_payments")
          .select("paid_on,amount_cents,bank_transaction_id,allocation_status")
          .eq("organization_id", viewer.organizationId)
          .gte("paid_on", historyStart)
          .eq("allocation_status", "confirmed")
          .order("id")
          .range(from, to),
      { label: "Mietzahlungen" },
    ),
    bookkeepingAvailable
      ? fetchAllRows(
          (from, to) =>
            supabase
              .from("income_entries")
              .select(
                "property_id,entry_date,amount_cents,category,payment_status,bank_transaction_id",
              )
              .eq("organization_id", viewer.organizationId)
              .gte("entry_date", historyStart)
              .is("archived_at", null)
              .in("payment_status", ["paid", "partial", "overpaid"])
              .order("id")
              .range(from, to),
          { label: "Einnahmen" },
        )
      : Promise.resolve({ data: [], error: null }),
    bookkeepingAvailable
      ? fetchAllRows(
          (from, to) =>
            supabase
              .from("expense_entries")
              .select(
                "property_id,entry_date,amount_cents,is_cash_effective,is_interest,is_principal,is_capitalizable,is_deductible,payment_status",
              )
              .eq("organization_id", viewer.organizationId)
              .gte("entry_date", historyStart)
              .is("archived_at", null)
              .eq("is_cash_effective", true)
              .in("payment_status", ["paid", "partial", "overpaid"])
              .order("id")
              .range(from, to),
          { label: "Ausgaben" },
        )
      : Promise.resolve({ data: [], error: null }),
    loansAvailable
      ? fetchAllRows(
          (from, to) =>
            supabase
              .from("loans")
              .select(
                "id,property_id,current_balance_cents,monthly_payment_cents,fixed_rate_until,status",
              )
              .eq("organization_id", viewer.organizationId)
              .is("archived_at", null)
              .in("status", ["active", "refinancing_due"])
              .order("id")
              .range(from, to),
          { label: "Finanzierungen" },
        )
      : Promise.resolve({ data: [], error: null }),
    fetchAllRows(
      (from, to) =>
        supabase
          .from("documents")
          .select("id,review_status")
          .eq("organization_id", viewer.organizationId)
          .is("archived_at", null)
          .order("id")
          .range(from, to),
      { label: "Belege" },
    ),
    fetchAllRows(
      (from, to) =>
        supabase
          .from("tasks")
          .select("id,property_id,title,priority,status,due_at")
          .eq("organization_id", viewer.organizationId)
          .is("archived_at", null)
          .order("id")
          .range(from, to),
      { label: "Aufgaben" },
    ),
    fetchAllRows(
      (from, to) =>
        supabase
          .from("renovation_projects")
          .select(
            "id,property_id,name,estimated_cost_cents,planned_start_date,priority,status",
          )
          .eq("organization_id", viewer.organizationId)
          .is("archived_at", null)
          .order("id")
          .range(from, to),
      { label: "Sanierungen" },
    ),
    taxDataAvailable
      ? supabase
          .from("tax_profiles")
          .select("marginal_tax_rate,calculations_enabled")
          .eq("organization_id", viewer.organizationId)
          .eq("user_id", viewer.userId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    taxDataAvailable
      ? fetchAllRows(
          (from, to) =>
            supabase
              .from("depreciation_assets")
              .select(
                "depreciable_basis_cents,use_start_date,annual_rate,manual_adjustment_cents",
              )
              .eq("organization_id", viewer.organizationId)
              .is("archived_at", null)
              .order("id")
              .range(from, to),
          { label: "AfA-Daten" },
        )
      : Promise.resolve({ data: [], error: null }),
  ]);

  const [
    propertiesResult,
    unitsResult,
    leasesResult,
    claimsResult,
    paymentsResult,
    incomeResult,
    expensesResult,
    loansResult,
    documentsResult,
    tasksResult,
    renovationsResult,
    taxProfileResult,
    depreciationResult,
  ] = results as QueryResult[];
  const issues = new Set<string>();
  if (!loansAvailable) {
    issues.add(
      "Finanzierungsdaten sind für deine aktuelle Rolle nicht verfügbar; Restschuld, Eigenkapital, LTV und Zinsbindungsende werden deshalb nicht berechnet.",
    );
  }
  if (!bookkeepingAvailable) {
    issues.add(
      "Einnahmen und Ausgaben sind für deine aktuelle Rolle nicht verfügbar; Buchhaltungskennzahlen werden deshalb nicht berechnet.",
    );
  }
  if (!taxDataAvailable) {
    issues.add(
      "Persönliche Steuerannahmen und AfA-Daten sind für deine aktuelle Rolle nicht verfügbar; die geschätzte Steuerwirkung wird deshalb nicht berechnet.",
    );
  }

  [
    [propertiesResult, "Immobilien"],
    [unitsResult, "Einheiten"],
    [leasesResult, "Mietverhältnisse"],
    [claimsResult, "Mietforderungen"],
    [paymentsResult, "Mietzahlungen"],
    [incomeResult, "Einnahmen"],
    [expensesResult, "Ausgaben"],
    [loansResult, "Finanzierungen"],
    [documentsResult, "Belege"],
    [tasksResult, "Aufgaben"],
    [renovationsResult, "Sanierungen"],
    [taxProfileResult, "Steuerannahmen"],
    [depreciationResult, "AfA-Daten"],
  ].forEach(([result, label]) =>
    queryIssue(result as QueryResult, label as string, issues),
  );

  const properties: DashboardPropertySource[] = asRows(
    propertiesResult.data,
  ).map((row) => ({
    id: text(row.id),
    name: text(row.name, "Unbenannte Immobilie"),
    purchasePriceCents: cents(row.purchase_price_cents, issues, {
      optional: true,
    }),
    acquisitionCostsCents:
      cents(row.acquisition_costs_cents, issues) ?? 0,
    buildingValueCents: cents(row.building_value_cents, issues, {
      optional: true,
    }),
    currentMarketValueCents: cents(
      row.current_market_value_cents,
      issues,
      { optional: true },
    ),
    purchaseDate: optionalText(row.purchase_date),
  }));
  const units: DashboardUnitSource[] = asRows(unitsResult.data).map(
    (row) => ({
      id: text(row.id),
      propertyId: text(row.property_id),
      label: text(row.unit_number, "Einheit"),
      areaSquareMeters: finiteNumber(row.area_sqm),
      status: text(row.status),
    }),
  );
  const leases: DashboardLeaseSource[] = asRows(leasesResult.data).map(
    (row) => ({
      id: text(row.id),
      unitId: text(row.unit_id),
      startsOn: text(row.starts_on),
      endsOn: optionalText(row.ends_on),
      coldRentCents: cents(row.cold_rent_cents, issues) ?? 0,
      ancillaryCents:
        cents(row.ancillary_prepayment_cents, issues) ?? 0,
      parkingCents: cents(row.parking_rent_cents, issues) ?? 0,
      otherCents: cents(row.other_rent_cents, issues) ?? 0,
      status: text(row.status),
    }),
  );
  const rentClaims: DashboardRentClaimSource[] = asRows(
    claimsResult.data,
  ).map((row) => ({
    id: text(row.id),
    leaseId: text(row.lease_id),
    claimMonth: text(row.claim_month),
    dueDate: text(row.due_date),
    amountCents: cents(row.amount_cents, issues) ?? 0,
    paidCents: cents(row.paid_cents, issues) ?? 0,
    status: text(row.status),
  }));
  const currentMonth = asOfDate.slice(0, 7);
  const currentClaims = new Set(
    rentClaims
      .filter((claim) => claim.claimMonth.slice(0, 7) === currentMonth)
      .map((claim) => claim.leaseId),
  );
  const currentLeases = leases.filter(
    (lease) =>
      !["draft", "cancelled", "ended"].includes(lease.status) &&
      lease.startsOn <= asOfDate &&
      (lease.endsOn === null || lease.endsOn >= `${currentMonth}-01`),
  );
  if (
    currentClaims.size > 0 &&
    currentLeases.some((lease) => !currentClaims.has(lease.id))
  ) {
    issues.add(
      "Für mindestens ein laufendes Mietverhältnis fehlt die aktuelle Monatsforderung; die Sollmiete ist deshalb unvollständig.",
    );
  }
  const rentPayments: DashboardRentPaymentSource[] = asRows(
    paymentsResult.data,
  ).map((row) => ({
    paidOn: text(row.paid_on),
    amountCents: cents(row.amount_cents, issues) ?? 0,
    bankTransactionId: optionalText(row.bank_transaction_id),
  }));
  const income: DashboardIncomeSource[] = asRows(incomeResult.data).map(
    (row) => ({
      propertyId: optionalText(row.property_id),
      entryDate: text(row.entry_date),
      amountCents: cents(row.amount_cents, issues) ?? 0,
      category: text(row.category),
      bankTransactionId: optionalText(row.bank_transaction_id),
    }),
  );
  const confirmedPaymentMonths = new Set(
    rentPayments.map((payment) => payment.paidOn.slice(0, 7)),
  );
  if (
    income.some(
      (entry) =>
        RENT_INCOME_CATEGORIES.has(entry.category) &&
        entry.bankTransactionId === null &&
        confirmedPaymentMonths.has(entry.entryDate.slice(0, 7)),
    )
  ) {
    issues.add(
      "Unverknüpfte manuelle Mieteinnahmen wurden in Monaten mit bestätigten Mietzahlungen nicht zusätzlich gezählt, um eine mögliche Doppelzählung zu vermeiden.",
    );
  }
  const expenses: DashboardExpenseSource[] = asRows(
    expensesResult.data,
  ).map((row) => ({
    propertyId: optionalText(row.property_id),
    entryDate: text(row.entry_date),
    amountCents: cents(row.amount_cents, issues) ?? 0,
    cashEffective: boolean(row.is_cash_effective),
    isInterest: boolean(row.is_interest),
    isPrincipal: boolean(row.is_principal),
    isCapitalizable: boolean(row.is_capitalizable),
    isDeductible: boolean(row.is_deductible),
  }));
  const loans: DashboardLoanSource[] = asRows(loansResult.data).map(
    (row) => ({
      id: text(row.id),
      propertyId: text(row.property_id),
      currentBalanceCents:
        cents(row.current_balance_cents, issues) ?? 0,
      monthlyPaymentCents:
        cents(row.monthly_payment_cents, issues) ?? 0,
      fixedRateUntil: optionalText(row.fixed_rate_until),
      status: text(row.status),
    }),
  );
  const documents = asRows(documentsResult.data);
  const tasks: DashboardTaskSource[] = asRows(tasksResult.data).map(
    (row) => ({
      id: text(row.id),
      propertyId: optionalText(row.property_id),
      title: text(row.title, "Offene Aufgabe"),
      priority: priority(row.priority),
      status: text(row.status),
      dueDate: optionalText(row.due_at)?.slice(0, 10) ?? null,
    }),
  );
  const renovations: DashboardRenovationSource[] = asRows(
    renovationsResult.data,
  ).map((row) => ({
    id: text(row.id),
    propertyId: text(row.property_id),
    name: text(row.name, "Sanierungsvorhaben"),
    estimatedCostCents:
      cents(row.estimated_cost_cents, issues) ?? 0,
    plannedStartDate: optionalText(row.planned_start_date),
    priority: priority(row.priority),
    status: text(row.status),
  }));
  const taxProfile = asRows(
    taxProfileResult.data ? [taxProfileResult.data] : [],
  )[0];
  const taxRate =
    taxProfile && boolean(taxProfile.calculations_enabled, true)
      ? rate(taxProfile.marginal_tax_rate, issues)
      : null;
  const depreciationRows = asRows(depreciationResult.data);
  const monthlyDepreciationCents = sumCents(
    depreciationRows.map((row) => {
      const basis = cents(row.depreciable_basis_cents, issues) ?? 0;
      const annualRate = rate(row.annual_rate, issues);
      const startDate = text(row.use_start_date);
      if (annualRate === null || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
        return 0;
      }
      try {
        const annual = calculateDepreciation({
          taxYear: Number(asOfDate.slice(0, 4)),
          buildingBasisCents: basis,
          placedInServiceDate: startDate,
          annualRate,
          manualAdjustmentCents:
            cents(row.manual_adjustment_cents, issues) ?? 0,
        }).depreciationCents;
        return roundHalfAwayFromZero(annual / 12);
      } catch {
        issues.add(
          "Mindestens eine AfA-Anlage war unvollständig und wurde nicht in die Schätzung einbezogen.",
        );
        return 0;
      }
    }),
  );

  const sourceState =
    issues.size > 0 ? "partial" : properties.length === 0 ? "empty" : "ready";

  return buildDashboardSnapshot({
    mode: "live",
    organizationName: viewer.organizationName,
    asOfDate,
    sourceState,
    issues: Array.from(issues),
    properties,
    units,
    leases,
    rentClaims,
    rentPayments,
    income,
    expenses,
    loans,
    loansAvailable,
    unresolvedDocuments: documents.filter(
      (document) =>
        document.review_status !== "complete" &&
        document.review_status !== "reviewed",
    ).length,
    tasks,
    renovations,
    taxRate,
    monthlyDepreciationCents,
    additionalAssumptions:
      taxRate !== null && depreciationRows.length === 0
        ? [
            "Es ist keine AfA-Anlage hinterlegt; die vorläufige Steuerhochrechnung enthält deshalb keine Abschreibung.",
          ]
        : [],
  });
}
