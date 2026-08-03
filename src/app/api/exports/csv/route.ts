import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { rowsToCsv } from "@/lib/exports/csv";
import { propertyTypeLabel } from "@/lib/domain";
import {
  canAccessSensitiveReportData,
  resolveReportScope,
} from "@/lib/reports/scope";
import { fetchAllRows } from "@/lib/supabase/pagination";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const exportDefinitions = {
  properties: {
    fileName: "immobilien",
    table: "properties",
    columns: [
      { key: "id", label: "ID" },
      { key: "name", label: "Immobilie" },
      { key: "property_mode", label: "Objektmodus" },
      { key: "property_type", label: "Typ" },
      { key: "street", label: "Straße" },
      { key: "house_number", label: "Hausnummer" },
      { key: "postal_code", label: "PLZ" },
      { key: "city", label: "Ort" },
      { key: "purchase_date", label: "Kaufdatum" },
      { key: "purchase_price_cents", label: "Kaufpreis (Cent)" },
      { key: "current_market_value_cents", label: "Marktwert (Cent)" },
      { key: "rentable_area_sqm", label: "Vermietbare Fläche (m²)" },
      { key: "status", label: "Status" },
    ],
  },
  units: {
    fileName: "einheiten",
    table: "units",
    columns: [
      { key: "id", label: "ID" },
      { key: "property_id", label: "Immobilien-ID" },
      { key: "unit_number", label: "Einheit" },
      { key: "floor", label: "Etage" },
      { key: "area_sqm", label: "Fläche (m²)" },
      { key: "rooms", label: "Zimmer" },
      {
        key: "target_cold_rent_cents",
        label: "Markt-/SOLL-Kaltmiete (mtl., Cent)",
      },
      { key: "ancillary_prepayment_cents", label: "Nebenkosten (mtl., Cent)" },
      { key: "ancillary_charge_type", label: "Nebenkostenart" },
      { key: "status", label: "Status" },
    ],
  },
  leases: {
    fileName: "mietverhaeltnisse",
    table: "leases",
    columns: [
      { key: "id", label: "ID" },
      { key: "unit_id", label: "Einheiten-ID" },
      { key: "lease_number", label: "Vertragsnummer" },
      { key: "starts_on", label: "Mietbeginn" },
      { key: "ends_on", label: "Mietende" },
      {
        key: "cold_rent_cents",
        label: "Vertrags-/IST-Kaltmiete (mtl., Cent)",
      },
      { key: "ancillary_prepayment_cents", label: "Nebenkosten (mtl., Cent)" },
      { key: "ancillary_charge_type", label: "Nebenkostenart" },
      { key: "deposit_cents", label: "Kaution (Cent)" },
      { key: "status", label: "Status" },
    ],
  },
  income: {
    fileName: "einnahmen",
    table: "income_entries",
    columns: [
      { key: "id", label: "ID" },
      { key: "property_id", label: "Immobilien-ID" },
      { key: "unit_id", label: "Einheiten-ID" },
      { key: "entry_date", label: "Datum" },
      { key: "description", label: "Beschreibung" },
      { key: "category", label: "Kategorie" },
      { key: "amount_cents", label: "Betrag (Cent)" },
      { key: "payment_status", label: "Zahlungsstatus" },
    ],
  },
  expenses: {
    fileName: "ausgaben",
    table: "expense_entries",
    columns: [
      { key: "id", label: "ID" },
      { key: "property_id", label: "Immobilien-ID" },
      { key: "unit_id", label: "Einheiten-ID" },
      { key: "entry_date", label: "Datum" },
      { key: "description", label: "Beschreibung" },
      { key: "amount_cents", label: "Betrag (Cent)" },
      { key: "payment_status", label: "Zahlungsstatus" },
      { key: "document_status", label: "Belegstatus" },
    ],
  },
  documents: {
    fileName: "dokumente",
    table: "documents",
    columns: [
      { key: "id", label: "ID" },
      { key: "property_id", label: "Immobilien-ID" },
      { key: "original_file_name", label: "Dateiname" },
      { key: "title", label: "Titel" },
      { key: "document_type", label: "Dokumenttyp" },
      { key: "document_date", label: "Dokumentdatum" },
      { key: "review_status", label: "Prüfstatus" },
      { key: "created_at", label: "Hochgeladen am" },
    ],
  },
  tasks: {
    fileName: "aufgaben",
    table: "tasks",
    columns: [
      { key: "id", label: "ID" },
      { key: "property_id", label: "Immobilien-ID" },
      { key: "title", label: "Titel" },
      { key: "category", label: "Kategorie" },
      { key: "priority", label: "Priorität" },
      { key: "status", label: "Status" },
      { key: "due_at", label: "Fällig am" },
    ],
  },
} as const;

type ExportResource = keyof typeof exportDefinitions;

function isExportResource(value: string | null): value is ExportResource {
  return Boolean(value && value in exportDefinitions);
}

function parseYear(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 2000 && parsed <= 2100
    ? parsed
    : null;
}

export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Bitte zuerst anmelden." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!viewer.organizationId || !viewer.role) {
    return NextResponse.json(
      { error: "Keine aktive Organisation ausgewählt." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!hasPermission(viewer.role, "reports.export")) {
    return NextResponse.json(
      { error: "Keine Berechtigung für Datenexporte." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  const organizationId = viewer.organizationId;

  const resource = request.nextUrl.searchParams.get("resource");
  if (resource === "annual") {
    const year = parseYear(
      request.nextUrl.searchParams.get("year"),
      new Date().getFullYear(),
    );
    if (year === null) {
      return NextResponse.json(
        { error: "Ungültiges Berichtsjahr." },
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }

    const yearStart = `${year}-01-01`;
    const nextYearStart = `${year + 1}-01-01`;
    const supabase = await createClient();
    const canAccessSensitiveData = canAccessSensitiveReportData(viewer.role);
    const [propertiesResult, unitsResult, taxYearResult] = await Promise.all([
      fetchAllRows(
        (from, to) =>
          supabase
            .from("properties")
            .select("id, name")
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
            .select("id, property_id, unit_number")
            .eq("organization_id", organizationId)
            .is("archived_at", null)
            .order("unit_number")
            .order("id")
            .range(from, to),
        { label: "Einheiten" },
      ),
      canAccessSensitiveData
        ? supabase
            .from("tax_years")
            .select("id")
            .eq("organization_id", organizationId)
            .eq("year", year)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
    ]);

    if (
      propertiesResult.error ||
      unitsResult.error ||
      taxYearResult.error
    ) {
      return NextResponse.json(
        { error: "Die Jahresauswertung konnte nicht erstellt werden." },
        { status: 502, headers: { "Cache-Control": "no-store" } },
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
        { status: 400, headers: { "Cache-Control": "no-store" } },
      );
    }
    const scope = scopeResolution.scope;
    const scopedUnits = reportUnits.filter(
      (unit) =>
        (!scope.propertyId || unit.property_id === scope.propertyId) &&
        (!scope.unitId || unit.id === scope.unitId),
    );
    const scopedUnitIds = scopedUnits.map((unit) => unit.id);
    const rentLeasesResult = scopedUnitIds.length
      ? await fetchAllRows(
          (from, to) =>
            supabase
              .from("leases")
              .select("id, unit_id")
              .eq("organization_id", organizationId)
              .in("unit_id", scopedUnitIds)
              .is("archived_at", null)
              .order("id")
              .range(from, to),
          { label: "Mietverhältnisse für Mietzahlungen" },
        )
      : { data: [], error: null };
    const rentLeaseIds = (rentLeasesResult.data ?? []).map(
      (lease) => lease.id,
    );
    const rentClaimsResult = rentLeaseIds.length
      ? await fetchAllRows(
          (from, to) =>
            supabase
              .from("rent_claims")
              .select("id, lease_id")
              .eq("organization_id", organizationId)
              .in("lease_id", rentLeaseIds)
              .order("id")
              .range(from, to),
          { label: "Mietforderungen für Mietzahlungen" },
        )
      : { data: [], error: null };
    const rentClaimIds = (rentClaimsResult.data ?? []).map(
      (claim) => claim.id,
    );
    const rentPaymentsResult = rentClaimIds.length
      ? await fetchAllRows(
          (from, to) =>
            supabase
              .from("rent_payments")
              .select(
                "rent_claim_id, paid_on, amount_cents, bank_transaction_id",
              )
              .eq("organization_id", organizationId)
              .in("rent_claim_id", rentClaimIds)
              .eq("allocation_status", "confirmed")
              .gte("paid_on", yearStart)
              .lt("paid_on", nextYearStart)
              .order("paid_on")
              .order("id")
              .range(from, to),
          { label: "Bestätigte Mietzahlungen" },
        )
      : { data: [], error: null };

    const [incomeResult, expensesResult, bankResult] = await Promise.all([
      fetchAllRows(
        (from, to) => {
          let query = supabase
            .from("income_entries")
            .select(
              "entry_date, description, category, amount_cents, payment_status, property_id, unit_id, bank_transaction_id",
            )
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
            .select(
              "entry_date, description, amount_cents, payment_status, document_status, property_id, unit_id",
            )
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
      canAccessSensitiveData && !scope.hasObjectFilter
        ? fetchAllRows(
            (from, to) =>
              supabase
                .from("bank_transactions")
                .select(
                  "booked_on, counterparty_name, remittance_information, amount_cents, match_status",
                )
                .eq("organization_id", organizationId)
                .eq("is_ignored", false)
                .in("match_status", ["unmatched", "suggested"])
                .gte("booked_on", yearStart)
                .lt("booked_on", nextYearStart)
                .order("booked_on")
                .order("id")
                .range(from, to),
            { label: "Bankpositionen" },
          )
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (
      incomeResult.error ||
      expensesResult.error ||
      bankResult.error ||
      rentLeasesResult.error ||
      rentClaimsResult.error ||
      rentPaymentsResult.error
    ) {
      return NextResponse.json(
        {
          error:
            incomeResult.error?.message ??
            expensesResult.error?.message ??
            bankResult.error?.message ??
            "Die Jahresauswertung konnte nicht erstellt werden.",
        },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const taxYearId = taxYearResult.data?.id ?? null;
    const taxAssumptionsResult =
      taxYearId && canAccessSensitiveData
        ? await fetchAllRows(
            (from, to) => {
              let query = supabase
                .from("tax_assumptions")
                .select(
                  "assumption_key, numeric_value, amount_cents, text_value, boolean_value, unit, explanation, source, is_user_confirmed, property_id",
                )
                .eq("organization_id", organizationId)
                .eq("tax_year_id", taxYearId);
              if (scope.propertyId) {
                query = query.or(
                  `property_id.is.null,property_id.eq.${scope.propertyId}`,
                );
              }
              return query.order("assumption_key").order("id").range(from, to);
            },
            { label: "Steuerannahmen" },
          )
        : { data: [], error: null };

    if (taxAssumptionsResult.error) {
      return NextResponse.json(
        { error: taxAssumptionsResult.error.message },
        { status: 502, headers: { "Cache-Control": "no-store" } },
      );
    }

    const income = incomeResult.data ?? [];
    const expenses = expensesResult.data ?? [];
    const rentPayments = rentPaymentsResult.data ?? [];
    const rentPaymentBankIds = new Set(
      rentPayments
        .map((payment) => payment.bank_transaction_id)
        .filter((value): value is string => Boolean(value)),
    );
    const deduplicatedIncome = income.filter(
      (row) =>
        !row.bank_transaction_id ||
        !rentPaymentBankIds.has(row.bank_transaction_id),
    );
    const paidIncomeCents =
      rentPayments.reduce(
        (sum, row) => sum + Number(row.amount_cents),
        0,
      ) +
      deduplicatedIncome
        .filter((row) => row.payment_status === "paid")
        .reduce((sum, row) => sum + Number(row.amount_cents), 0);
    const leaseById = new Map(
      (rentLeasesResult.data ?? []).map((lease) => [lease.id, lease]),
    );
    const claimById = new Map(
      (rentClaimsResult.data ?? []).map((claim) => [claim.id, claim]),
    );
    const unitById = new Map(scopedUnits.map((unit) => [unit.id, unit]));
    const rows: Array<Record<string, unknown>> = [
      {
        area: "Zusammenfassung",
        date_or_key: String(year),
        description: `Bezahlte Einnahmen · ${scope.label}`,
        amount_cents: paidIncomeCents,
        status: "Vorbereitung",
        property_id: scope.propertyId ?? "",
        unit_id: scope.unitId ?? "",
        receipt_status: "",
        assumption: "",
        scope: scope.label,
      },
      {
        area: "Zusammenfassung",
        date_or_key: String(year),
        description: `Bezahlte Ausgaben · ${scope.label}`,
        amount_cents: expenses
          .filter((row) => row.payment_status === "paid")
          .reduce((sum, row) => sum + Number(row.amount_cents), 0),
        status: "Vorbereitung",
        property_id: scope.propertyId ?? "",
        unit_id: scope.unitId ?? "",
        receipt_status: "",
        assumption: "",
        scope: scope.label,
      },
      ...(!canAccessSensitiveData
        ? [
            {
              area: "Hinweis",
              date_or_key: String(year),
              description:
                "Bankpositionen und persönliche Steuerannahmen sind für diese Rolle nicht verfügbar und wurden nicht abgefragt.",
              amount_cents: "",
              status: "Rollenbedingt nicht verfügbar",
              property_id: scope.propertyId ?? "",
              unit_id: scope.unitId ?? "",
              receipt_status: "",
              assumption: "",
              scope: scope.label,
            },
          ]
        : scope.hasObjectFilter
          ? [
              {
                area: "Hinweis",
                date_or_key: String(year),
                description:
                  "Ungeklärte Bankpositionen sind noch keinem Objekt zugeordnet und deshalb aus dem Objektfilter ausgeschlossen.",
                amount_cents: "",
                status: "Nicht objektbezogen",
                property_id: scope.propertyId ?? "",
                unit_id: scope.unitId ?? "",
                receipt_status: "",
                assumption: "",
                scope: scope.label,
              },
            ]
          : []),
      ...rentPayments.map((row) => {
        const claim = claimById.get(row.rent_claim_id);
        const lease = claim ? leaseById.get(claim.lease_id) : undefined;
        const unit = lease ? unitById.get(lease.unit_id) : undefined;
        return {
          area: "Mieteingang",
          date_or_key: row.paid_on,
          description: "Bestätigter Zahlungseingang aus Mietforderung",
          amount_cents: row.amount_cents,
          status: "bestätigt",
          property_id: unit?.property_id ?? "",
          unit_id: unit?.id ?? "",
          receipt_status: "",
          assumption: "",
          scope: scope.label,
        };
      }),
      ...deduplicatedIncome.map((row) => ({
        area: "Einnahme",
        date_or_key: row.entry_date,
        description: `${row.category}: ${row.description}`,
        amount_cents: row.amount_cents,
        status: row.payment_status,
        property_id: row.property_id,
        unit_id: row.unit_id ?? "",
        receipt_status: "",
        assumption: "",
        scope: scope.label,
      })),
      ...expenses.map((row) => ({
        area: "Ausgabe",
        date_or_key: row.entry_date,
        description: row.description,
        amount_cents: row.amount_cents,
        status: row.payment_status,
        property_id: row.property_id,
        unit_id: row.unit_id ?? "",
        receipt_status: row.document_status,
        assumption: "",
        scope: scope.label,
      })),
      ...(bankResult.data ?? []).map((row) => ({
        area: "Ungeklärte Bankposition",
        date_or_key: row.booked_on,
        description:
          [row.counterparty_name, row.remittance_information]
            .filter(Boolean)
            .join(" · ") || "Ohne Beschreibung",
        amount_cents: row.amount_cents,
        status: row.match_status,
        property_id: "",
        unit_id: "",
        receipt_status: "",
        assumption: "",
        scope: "Gesamtportfolio",
      })),
      ...(taxAssumptionsResult.data ?? []).map((row) => ({
        area: "Steuerannahme",
        date_or_key: row.assumption_key,
        description: row.explanation,
        amount_cents: row.amount_cents,
        status: row.is_user_confirmed ? "bestätigt" : "unbestätigt",
        property_id: row.property_id ?? "",
        unit_id: "",
        receipt_status: "",
        assumption: JSON.stringify({
          numeric_value: row.numeric_value,
          text_value: row.text_value,
          boolean_value: row.boolean_value,
          unit: row.unit,
          source: row.source,
        }),
        scope: row.property_id
          ? "Immobilienspezifisch"
          : "Organisationsweit",
      })),
    ];
    const csv = rowsToCsv({
      columns: [
        { key: "area", label: "Bereich" },
        { key: "date_or_key", label: "Datum oder Schlüssel" },
        { key: "description", label: "Beschreibung" },
        { key: "amount_cents", label: "Betrag (Cent)" },
        { key: "status", label: "Status" },
        { key: "property_id", label: "Immobilien-ID" },
        { key: "unit_id", label: "Einheiten-ID" },
        { key: "receipt_status", label: "Belegstatus" },
        { key: "assumption", label: "Annahme und Quelle" },
        { key: "scope", label: "Geltungsbereich" },
      ],
      rows,
    });

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="estate-brain-jahresauswertung-${year}.csv"`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  if (!isExportResource(resource)) {
    return NextResponse.json(
      { error: "Unbekannter Exportbereich." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const definition = exportDefinitions[resource];
  const supabase = await createClient();
  const columnKeys = definition.columns.map((column) => column.key).join(",");
  const { data, error } = await fetchAllRows(
    (from, to) =>
      supabase
        .from(definition.table)
        .select(columnKeys)
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to),
    { label: `Export ${definition.fileName}` },
  );

  if (error) {
    return NextResponse.json(
      { error: error.message || "Der Export konnte nicht erstellt werden." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }

  const exportRows = (data ?? []) as unknown as Array<
    Record<string, unknown>
  >;
  const csv = rowsToCsv({
    columns: definition.columns,
    rows:
      resource === "properties"
        ? exportRows.map((row) => ({
            ...row,
            property_type: propertyTypeLabel(row.property_type),
          }))
        : exportRows,
  });
  const date = new Date().toISOString().slice(0, 10);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="estate-brain-${definition.fileName}-${date}.csv"`,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
