import Link from "next/link";
import {
  CheckCircle2,
  CircleAlert,
  Download,
  FileSearch,
  LockKeyhole,
  Upload,
} from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import {
  DocumentReviewForm,
  type ReviewFormDocument,
} from "@/components/documents/document-review-form";
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
import { requireOrganization } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";
import { cn } from "@/lib/utils";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const statusLabels: Record<string, string> = {
  complete: "Vollständig",
  missing: "Beleg fehlt",
  unreadable: "Unleserlich",
  unclear_assignment: "Zuordnung unklar",
  review_required: "Prüfung erforderlich",
  reviewed: "Geprüft",
  pending: "Ausstehend",
  running: "In Verarbeitung",
  succeeded: "Erfasst",
  failed: "Fehlgeschlagen",
  partial: "Teilweise",
};

const germanDate = new Intl.DateTimeFormat("de-DE");

function statusLabel(status: string) {
  return statusLabels[status] ?? status.replaceAll("_", " ");
}

function dateLabel(value: string | null) {
  if (!value) return "ohne Datum";
  const valueAsDate = new Date(value);
  return Number.isNaN(valueAsDate.valueOf())
    ? "ohne Datum"
    : germanDate.format(valueAsDate);
}

function rawAddress(value: Json | null) {
  if (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    typeof value.raw === "string"
  ) {
    return value.raw;
  }
  return null;
}

function isOpenReview(document: {
  review_status: string;
  ocr_status: string;
}) {
  return (
    ["review_required", "unreadable", "unclear_assignment"].includes(
      document.review_status,
    ) ||
    ["pending", "partial", "failed"].includes(document.ocr_status)
  );
}

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{
    review?: string | string[];
    uploaded?: string | string[];
  }>;
}) {
  const viewer = await requireOrganization();
  const canRead = hasPermission(viewer.role, "documents.read");
  const canUpload = hasPermission(viewer.role, "documents.write");
  const canReview = canUpload && viewer.role !== "employee";

  if (!canRead) {
    return (
      <>
        <PageHeader
          eyebrow="Rechnungen & Belege"
          title="Dokumentenprüfung"
          description="Dokumente sind nur für freigegebene Rollen sichtbar."
        />
        <Alert variant="destructive">
          <LockKeyhole />
          <AlertTitle>Keine Leseberechtigung</AlertTitle>
          <AlertDescription>
            Deine Rolle darf die Dokumente dieser Organisation nicht öffnen.
          </AlertDescription>
        </Alert>
      </>
    );
  }

  const supabase = await createClient();
  const [
    documentsResult,
    propertiesResult,
    unitsResult,
    leasesResult,
    categoriesResult,
  ] = await Promise.all([
    supabase
      .from("documents")
      .select(
        "id, original_file_name, title, document_type, document_date, review_status, ocr_status, payment_status, property_id, unit_id, lease_id, tenant_visible, created_at",
      )
      .eq("organization_id", viewer.organizationId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("properties")
      .select("id, name")
      .eq("organization_id", viewer.organizationId)
      .is("archived_at", null)
      .order("name"),
    supabase
      .from("units")
      .select("id, property_id, unit_number")
      .eq("organization_id", viewer.organizationId)
      .is("archived_at", null)
      .order("unit_number"),
    supabase
      .from("leases")
      .select("id, unit_id, starts_on, ends_on, status")
      .eq("organization_id", viewer.organizationId)
      .is("archived_at", null)
      .order("starts_on", { ascending: false }),
    supabase
      .from("expense_categories")
      .select(
        "id, name, is_cash_effective_default, is_tax_relevant_default, is_capitalizable_default, is_recoverable_default",
      )
      .eq("organization_id", viewer.organizationId)
      .is("archived_at", null)
      .order("sort_order")
      .order("name"),
  ]);

  const documents = documentsResult.data ?? [];
  const documentIds = documents.map((document) => document.id);
  const [extractionsResult, linksResult] =
    documentIds.length > 0
      ? await Promise.all([
          supabase
            .from("document_extractions")
            .select(
              "document_id, provider, extracted_vendor_name, extracted_invoice_number, extracted_invoice_date, extracted_service_date, gross_amount_cents, net_amount_cents, tax_amount_cents, extracted_currency, extracted_address, created_at",
            )
            .eq("organization_id", viewer.organizationId)
            .in("document_id", documentIds)
            .order("created_at", { ascending: false }),
          supabase
            .from("document_links")
            .select("document_id, expense_entry_id, created_at")
            .eq("organization_id", viewer.organizationId)
            .eq("link_type", "expense_receipt")
            .in("document_id", documentIds)
            .not("expense_entry_id", "is", null)
            .order("created_at", { ascending: false }),
        ])
      : [
          { data: [], error: null },
          { data: [], error: null },
        ];

  const extractionByDocument = new Map<
    string,
    NonNullable<typeof extractionsResult.data>[number]
  >();
  for (const extraction of extractionsResult.data ?? []) {
    const current = extractionByDocument.get(extraction.document_id);
    if (
      !current ||
      (extraction.provider === "manual" && current.provider !== "manual")
    ) {
      extractionByDocument.set(extraction.document_id, extraction);
    }
  }

  const expenseIdByDocument = new Map<string, string>();
  for (const link of linksResult.data ?? []) {
    if (
      link.expense_entry_id &&
      !expenseIdByDocument.has(link.document_id)
    ) {
      expenseIdByDocument.set(link.document_id, link.expense_entry_id);
    }
  }

  const expenseIds = [...new Set(expenseIdByDocument.values())];
  const expensesResult =
    expenseIds.length > 0
      ? await supabase
          .from("expense_entries")
          .select(
            "id, category_id, entry_date, service_date, amount_cents, net_amount_cents, tax_amount_cents, currency, description, payment_status, is_cash_effective, is_tax_relevant, is_interest, is_principal, is_capitalizable, is_deductible, is_recoverable, notes",
          )
          .eq("organization_id", viewer.organizationId)
          .in("id", expenseIds)
          .is("archived_at", null)
      : { data: [], error: null };
  const expenseById = new Map(
    (expensesResult.data ?? []).map((expense) => [expense.id, expense]),
  );

  const openDocuments = documents.filter(isOpenReview);
  const recentReviewedDocuments = documents.filter(
    (document) => !isOpenReview(document),
  );
  const params = await searchParams;
  const requestedValue =
    typeof params.review === "string"
      ? params.review
      : typeof params.uploaded === "string"
        ? params.uploaded
        : null;
  const requestedId =
    requestedValue && uuidPattern.test(requestedValue) ? requestedValue : null;
  const selected =
    (requestedId
      ? documents.find((document) => document.id === requestedId)
      : null) ??
    openDocuments[0] ??
    null;

  const extraction = selected
    ? extractionByDocument.get(selected.id) ?? null
    : null;
  const expense = selected
    ? expenseById.get(expenseIdByDocument.get(selected.id) ?? "") ?? null
    : null;
  const selectedDocument: ReviewFormDocument | null = selected
    ? {
        id: selected.id,
        title: selected.title,
        documentType: selected.document_type,
        documentDate: selected.document_date,
        paymentStatus: selected.payment_status,
        propertyId: selected.property_id,
        unitId: selected.unit_id,
        leaseId: selected.lease_id,
        tenantVisible: selected.tenant_visible,
        extraction: extraction
          ? {
              vendorName: extraction.extracted_vendor_name,
              invoiceNumber: extraction.extracted_invoice_number,
              invoiceDate: extraction.extracted_invoice_date,
              serviceDate: extraction.extracted_service_date,
              grossAmountCents: extraction.gross_amount_cents,
              netAmountCents: extraction.net_amount_cents,
              taxAmountCents: extraction.tax_amount_cents,
              currency: extraction.extracted_currency,
              recognizedAddress: rawAddress(extraction.extracted_address),
            }
          : null,
        expense: expense
          ? {
              categoryId: expense.category_id,
              entryDate: expense.entry_date,
              serviceDate: expense.service_date,
              amountCents: expense.amount_cents,
              netAmountCents: expense.net_amount_cents,
              taxAmountCents: expense.tax_amount_cents,
              currency: expense.currency,
              description: expense.description,
              paymentStatus: expense.payment_status,
              isCashEffective: expense.is_cash_effective,
              isTaxRelevant: expense.is_tax_relevant,
              isInterest: expense.is_interest,
              isPrincipal: expense.is_principal,
              isCapitalizable: expense.is_capitalizable,
              isDeductible: expense.is_deductible,
              isRecoverable: expense.is_recoverable,
              notes: expense.notes,
            }
          : null,
      }
    : null;

  const queryFailed = Boolean(
    documentsResult.error ||
      propertiesResult.error ||
      unitsResult.error ||
      leasesResult.error ||
      categoriesResult.error ||
      extractionsResult.error ||
      linksResult.error ||
      expensesResult.error,
  );

  return (
    <>
      <PageHeader
        eyebrow="Rechnungen & Belege"
        title="Dokumentenprüfung"
        description="Rechnungsdaten korrigieren, sicher zuordnen und als vollständige Ausgabe vorbereiten."
        actions={
          canUpload ? (
            <Button asChild>
              <Link href="/app/belege/upload">
                <Upload />
                Dokument hochladen
              </Link>
            </Button>
          ) : null
        }
      />

      {queryFailed ? (
        <Alert variant="destructive" className="mb-5">
          <CircleAlert />
          <AlertTitle>Daten nicht vollständig geladen</AlertTitle>
          <AlertDescription>
            Bitte lade die Seite neu. Es wurden keine Änderungen vorgenommen.
          </AlertDescription>
        </Alert>
      ) : null}

      {!canReview ? (
        <Alert className="mb-5">
          <LockKeyhole />
          <AlertTitle>Nur Lesezugriff</AlertTitle>
          <AlertDescription>
            Du kannst Dokumente öffnen und herunterladen. Die verbindliche
            Prüfung mit Buchung ist einer Buchhaltungsrolle vorbehalten.
          </AlertDescription>
        </Alert>
      ) : null}

      {documents.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Noch keine Dokumente</CardTitle>
            <CardDescription>
              Lade eine Rechnung hoch, um die manuelle Prüfung zu starten.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="grid items-start gap-6 xl:grid-cols-[22rem_minmax(0,1fr)]">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Prüfwarteschlange</CardTitle>
                <CardDescription>
                  {openDocuments.length} Dokument
                  {openDocuments.length === 1 ? "" : "e"} offen
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {openDocuments.length === 0 ? (
                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                    <CheckCircle2 className="mb-2 size-5 text-primary" />
                    Alle Dokumente sind geprüft.
                  </div>
                ) : (
                  openDocuments.map((document) => (
                    <Link
                      key={document.id}
                      href={`/app/belege?review=${document.id}`}
                      className={cn(
                        "block rounded-lg border p-3 transition-colors hover:bg-muted/60",
                        selected?.id === document.id &&
                          "border-primary bg-primary/5",
                      )}
                    >
                      <p className="truncate font-medium">
                        {document.title || document.original_file_name}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {dateLabel(document.document_date)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge
                          variant={
                            document.review_status === "unreadable"
                              ? "destructive"
                              : "secondary"
                          }
                        >
                          {statusLabel(document.review_status)}
                        </Badge>
                        <Badge variant="outline">
                          {statusLabel(document.ocr_status)}
                        </Badge>
                      </div>
                    </Link>
                  ))
                )}
              </CardContent>
            </Card>

            {recentReviewedDocuments.length > 0 ? (
              <Card>
                <CardHeader>
                  <CardTitle>Zuletzt geprüft</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {recentReviewedDocuments.slice(0, 10).map((document) => (
                    <div
                      key={document.id}
                      className="rounded-lg border p-3 text-sm"
                    >
                      <p className="truncate font-medium">
                        {document.title || document.original_file_name}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {canReview ? (
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/app/belege?review=${document.id}`}>
                              Korrigieren
                            </Link>
                          </Button>
                        ) : null}
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/api/documents/${document.id}/download`}>
                            <Download />
                            Download
                          </Link>
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ) : null}
          </div>

          {selected ? (
            <Card>
              <CardHeader className="border-b">
                <CardTitle>
                  {selected.title || selected.original_file_name}
                </CardTitle>
                <CardDescription>
                  Hochgeladen am {dateLabel(selected.created_at)}
                </CardDescription>
                <CardAction>
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/api/documents/${selected.id}/download`}>
                      <Download />
                      Download
                    </Link>
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                {canReview && selectedDocument ? (
                  <DocumentReviewForm
                    key={selectedDocument.id}
                    document={selectedDocument}
                    properties={(propertiesResult.data ?? []).map(
                      (property) => ({
                        id: property.id,
                        name: property.name,
                      }),
                    )}
                    units={(unitsResult.data ?? []).map((unit) => ({
                      id: unit.id,
                      propertyId: unit.property_id,
                      name: unit.unit_number,
                    }))}
                    leases={(leasesResult.data ?? []).map((lease) => ({
                      id: lease.id,
                      unitId: lease.unit_id,
                      label: `${dateLabel(lease.starts_on)} – ${
                        lease.ends_on ? dateLabel(lease.ends_on) : "offen"
                      } · ${lease.status}`,
                    }))}
                    categories={(categoriesResult.data ?? []).map(
                      (category) => ({
                        id: category.id,
                        name: category.name,
                        isCashEffectiveDefault:
                          category.is_cash_effective_default,
                        isTaxRelevantDefault:
                          category.is_tax_relevant_default,
                        isCapitalizableDefault:
                          category.is_capitalizable_default,
                        isRecoverableDefault:
                          category.is_recoverable_default,
                      }),
                    )}
                  />
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    <FileSearch className="mx-auto mb-3 size-8" />
                    <p>Dieses Dokument kann mit deiner Rolle gelesen werden.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      )}
    </>
  );
}
