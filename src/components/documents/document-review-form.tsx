"use client";

import { startTransition, useActionState, useEffect, useMemo, useState } from "react";
import { RenovationSelect, type RenovationOption } from "@/components/documents/renovation-select";
import { useRouter } from "next/navigation";
import { CircleAlert, Loader2, Save, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  reviewDocumentAction,
  type DocumentReviewState,
} from "@/app/app/belege/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type PropertyOption = {
  id: string;
  name: string;
};

type UnitOption = {
  id: string;
  propertyId: string;
  name: string;
};

type LeaseOption = {
  id: string;
  unitId: string;
  label: string;
};

type CategoryOption = {
  id: string;
  name: string;
  isCashEffectiveDefault: boolean;
  isTaxRelevantDefault: boolean;
  isCapitalizableDefault: boolean;
  isRecoverableDefault: boolean;
};

export type ReviewFormDocument = {
  id: string;
  title: string | null;
  documentType: string;
  documentDate: string | null;
  renovationProjectId?: string | null;
  paymentStatus: string | null;
  propertyId: string | null;
  unitId: string | null;
  leaseId: string | null;
  tenantVisible: boolean;
  extraction: {
    vendorName: string | null;
    invoiceNumber: string | null;
    invoiceDate: string | null;
    serviceDate: string | null;
    grossAmountCents: number | null;
    netAmountCents: number | null;
    taxAmountCents: number | null;
    currency: string | null;
    recognizedAddress: string | null;
  } | null;
  expense: {
    categoryId: string | null;
    entryDate: string;
    serviceDate: string | null;
    amountCents: number;
    netAmountCents: number | null;
    taxAmountCents: number | null;
    currency: string;
    description: string;
    paymentStatus: string;
    isCashEffective: boolean;
    isTaxRelevant: boolean | null;
    isInterest: boolean;
    isPrincipal: boolean;
    isCapitalizable: boolean;
    isDeductible: boolean | null;
    isRecoverable: boolean;
    notes: string | null;
  } | null;
};

const initialState: DocumentReviewState = { status: "idle" };

const documentTypes = [
  ["invoice", "Rechnung"],
  ["receipt", "Beleg"],
  ["contract", "Vertrag"],
  ["lease", "Mietvertrag"],
  ["bank_statement", "Kontoauszug"],
  ["tax", "Steuerunterlage"],
  ["insurance", "Versicherung"],
  ["handover", "Übergabeprotokoll"],
  ["correspondence", "Korrespondenz"],
  ["other", "Sonstiges"],
] as const;

function moneyInput(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return "";
  return (cents / 100).toFixed(2).replace(".", ",");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export function DocumentReviewForm({
  document,
  properties,
  units,
  leases,
  renovations,
  categories,
}: {
  document: ReviewFormDocument;
  properties: PropertyOption[];
  units: UnitOption[];
  leases: LeaseOption[];
  renovations: RenovationOption[];
  categories: CategoryOption[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    reviewDocumentAction,
    initialState,
  );
  const [propertyId, setPropertyId] = useState(document.propertyId ?? "");
  const [unitId, setUnitId] = useState(document.unitId ?? "");
  const [leaseId, setLeaseId] = useState(document.leaseId ?? "");
  const [categoryId, setCategoryId] = useState(
    document.expense?.categoryId ?? categories[0]?.id ?? "",
  );
  const [tenantVisible, setTenantVisible] = useState(document.tenantVisible);
  const availableUnits = useMemo(
    () => units.filter((unit) => unit.propertyId === propertyId),
    [propertyId, units],
  );
  const availableLeases = useMemo(
    () => leases.filter((lease) => lease.unitId === unitId),
    [leases, unitId],
  );
  const category = categories.find((option) => option.id === categoryId);
  const extraction = document.extraction;
  const expense = document.expense;

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
      router.refresh();
    }
  }, [router, state.message, state.status]);

  function error(name: string) {
    return state.errors?.[name]?.[0];
  }

  const defaultEntryDate =
    expense?.entryDate ??
    extraction?.invoiceDate ??
    document.documentDate ??
    today();
  const defaultServiceDate =
    expense?.serviceDate ?? extraction?.serviceDate ?? "";
  const defaultGrossAmount =
    expense?.amountCents ?? extraction?.grossAmountCents;
  const defaultNetAmount =
    expense?.netAmountCents ?? extraction?.netAmountCents;
  const defaultTaxAmount =
    expense?.taxAmountCents ?? extraction?.taxAmountCents;

  return (
    <form onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);startTransition(()=>formAction(data));}} className="space-y-6">
      <input type="hidden" name="documentId" value={document.id} />

      {state.status === "error" ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <section className="space-y-4">
        <div>
          <h3 className="font-medium">Manuell erkannte Rechnungsdaten</h3>
          <p className="text-sm text-muted-foreground">
            Diese Werte ersetzen keine automatische Erkennung, sondern werden
            als bestätigte manuelle Extraktion protokolliert.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`vendorName-${document.id}`}>
              Rechnungssteller *
            </Label>
            <Input
              id={`vendorName-${document.id}`}
              name="vendorName"
              defaultValue={extraction?.vendorName ?? ""}
              maxLength={160}
              required
              aria-invalid={Boolean(error("vendorName"))}
            />
            {error("vendorName") ? (
              <p className="text-xs text-destructive">{error("vendorName")}</p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`invoiceNumber-${document.id}`}>
              Rechnungsnummer
            </Label>
            <Input
              id={`invoiceNumber-${document.id}`}
              name="invoiceNumber"
              defaultValue={extraction?.invoiceNumber ?? ""}
              maxLength={100}
              aria-invalid={Boolean(error("invoiceNumber"))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`invoiceDate-${document.id}`}>
              Rechnungsdatum
            </Label>
            <Input
              id={`invoiceDate-${document.id}`}
              name="invoiceDate"
              type="date"
              defaultValue={
                extraction?.invoiceDate ?? document.documentDate ?? ""
              }
              aria-invalid={Boolean(error("invoiceDate"))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`serviceDate-${document.id}`}>
              Leistungsdatum
            </Label>
            <Input
              id={`serviceDate-${document.id}`}
              name="serviceDate"
              type="date"
              defaultValue={defaultServiceDate}
              aria-invalid={Boolean(error("serviceDate"))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`recognizedAddress-${document.id}`}>
              Erkannte Adresse
            </Label>
            <Input
              id={`recognizedAddress-${document.id}`}
              name="recognizedAddress"
              defaultValue={extraction?.recognizedAddress ?? ""}
              maxLength={500}
              placeholder="Straße, Hausnummer, PLZ und Ort"
              aria-invalid={Boolean(error("recognizedAddress"))}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor={`grossAmount-${document.id}`}>Brutto * </Label>
            <Input
              id={`grossAmount-${document.id}`}
              name="grossAmount"
              inputMode="decimal"
              defaultValue={moneyInput(defaultGrossAmount)}
              placeholder="0,00"
              required
              aria-invalid={Boolean(error("grossAmountCents"))}
            />
            {error("grossAmountCents") ? (
              <p className="text-xs text-destructive">
                {error("grossAmountCents")}
              </p>
            ) : null}
          </div>
          <div className="space-y-2">
            <Label htmlFor={`netAmount-${document.id}`}>Netto</Label>
            <Input
              id={`netAmount-${document.id}`}
              name="netAmount"
              inputMode="decimal"
              defaultValue={moneyInput(defaultNetAmount)}
              placeholder="optional"
              aria-invalid={Boolean(error("netAmountCents"))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`taxAmount-${document.id}`}>Steuer</Label>
            <Input
              id={`taxAmount-${document.id}`}
              name="taxAmount"
              inputMode="decimal"
              defaultValue={moneyInput(defaultTaxAmount)}
              placeholder="optional"
              aria-invalid={Boolean(error("taxAmountCents"))}
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`title-${document.id}`}>Dokumenttitel</Label>
            <Input
              id={`title-${document.id}`}
              name="title"
              defaultValue={document.title ?? ""}
              maxLength={160}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`currency-${document.id}`}>Währung *</Label>
            <Input
              id={`currency-${document.id}`}
              name="currency"
              defaultValue={expense?.currency ?? extraction?.currency ?? "EUR"}
              minLength={3}
              maxLength={3}
              required
              aria-invalid={Boolean(error("currency"))}
            />
          </div>
          <div className="space-y-2 sm:col-span-3">
            <Label htmlFor={`documentType-${document.id}`}>
              Dokumenttyp *
            </Label>
            <select
              id={`documentType-${document.id}`}
              name="documentType"
              defaultValue={document.documentType}
              required
              className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2"
            >
              {documentTypes.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <Separator />

      <section className="space-y-4">
        <div>
          <h3 className="font-medium">Zuordnung</h3>
          <p className="text-sm text-muted-foreground">
            Einheit und Mietverhältnis werden abhängig von der übergeordneten
            Auswahl gefiltert.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor={`propertyId-${document.id}`}>Immobilie *</Label>
            <select
              id={`propertyId-${document.id}`}
              name="propertyId"
              value={propertyId}
              required
              onChange={(event) => {
                setPropertyId(event.target.value);
                setUnitId("");
                setLeaseId("");
                setTenantVisible(false);
              }}
              aria-invalid={Boolean(error("propertyId"))}
              className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2"
            >
              <option value="">Bitte auswählen</option>
              {properties.map((property) => (
                <option key={property.id} value={property.id}>
                  {property.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`unitId-${document.id}`}>Einheit</Label>
            <select
              id={`unitId-${document.id}`}
              name="unitId"
              value={unitId}
              disabled={!propertyId}
              onChange={(event) => {
                setUnitId(event.target.value);
                setLeaseId("");
                setTenantVisible(false);
              }}
              aria-invalid={Boolean(error("unitId"))}
              className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2"
            >
              <option value="">Keine Einheit</option>
              {availableUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`leaseId-${document.id}`}>Mietverhältnis</Label>
            <select
              id={`leaseId-${document.id}`}
              name="leaseId"
              value={leaseId}
              disabled={!unitId}
              onChange={(event) => {
                setLeaseId(event.target.value);
                if (!event.target.value) setTenantVisible(false);
              }}
              aria-invalid={Boolean(error("leaseId"))}
              className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2"
            >
              <option value="">Kein Mietverhältnis</option>
              {availableLeases.map((lease) => (
                <option key={lease.id} value={lease.id}>
                  {lease.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-lg border p-4">
          <div>
            <Label htmlFor={`tenantVisible-${document.id}`}>
              Im Mieterportal sichtbar
            </Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Die Freigabe ist nur für das konkret gewählte Mietverhältnis
              möglich.
            </p>
          </div>
          <input
            type="hidden"
            name="tenantVisible"
            value={tenantVisible ? "true" : "false"}
          />
          <Switch
            id={`tenantVisible-${document.id}`}
            checked={tenantVisible}
            onCheckedChange={setTenantVisible}
            disabled={!leaseId}
          />
        </div>
      </section>

      <RenovationSelect propertyId={propertyId} renovations={renovations} defaultValue={document.renovationProjectId}/>
      <Separator />

      <section className="space-y-4">
        <div>
          <h3 className="font-medium">Ausgabe vorbereiten</h3>
          <p className="text-sm text-muted-foreground">
            Beim Bestätigen wird die vorhandene verknüpfte Ausgabe aktualisiert
            oder neu angelegt.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`categoryId-${document.id}`}>Kategorie *</Label>
            <select
              id={`categoryId-${document.id}`}
              name="categoryId"
              value={categoryId}
              required
              onChange={(event) => setCategoryId(event.target.value)}
              aria-invalid={Boolean(error("categoryId"))}
              className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2"
            >
              <option value="">Bitte auswählen</option>
              {categories.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor={`entryDate-${document.id}`}>Buchungsdatum *</Label>
            <Input
              id={`entryDate-${document.id}`}
              name="entryDate"
              type="date"
              defaultValue={defaultEntryDate}
              required
              aria-invalid={Boolean(error("entryDate"))}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`description-${document.id}`}>
              Beschreibung *
            </Label>
            <Input
              id={`description-${document.id}`}
              name="description"
              defaultValue={
                expense?.description ??
                extraction?.vendorName ??
                document.title ??
                ""
              }
              minLength={2}
              maxLength={500}
              required
              aria-invalid={Boolean(error("description"))}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor={`paymentStatus-${document.id}`}>
              Zahlungsstatus *
            </Label>
            <select
              id={`paymentStatus-${document.id}`}
              name="paymentStatus"
              defaultValue={
                expense?.paymentStatus ?? document.paymentStatus ?? "open"
              }
              required
              className="border-input bg-background ring-offset-background focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs outline-none focus-visible:ring-2"
            >
              <option value="open">Offen</option>
              <option value="partial">Teilweise bezahlt</option>
              <option value="paid">Bezahlt</option>
              <option value="overpaid">Überzahlt</option>
              <option value="cancelled">Storniert</option>
            </select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor={`notes-${document.id}`}>Notiz</Label>
            <Textarea
              id={`notes-${document.id}`}
              name="notes"
              defaultValue={expense?.notes ?? ""}
              maxLength={2000}
              rows={3}
              aria-invalid={Boolean(error("notes"))}
            />
          </div>
        </div>

        <div className="grid gap-3 rounded-lg border p-4 sm:grid-cols-2">
          {[
            [
              "isCashEffective",
              "Liquiditätswirksam",
              expense?.isCashEffective ??
                category?.isCashEffectiveDefault ??
                true,
            ],
            [
              "isTaxRelevant",
              "Steuerlich relevant (Nutzereingabe)",
              expense?.isTaxRelevant ??
                category?.isTaxRelevantDefault ??
                false,
            ],
            ["isInterest", "Darlehenszins", expense?.isInterest ?? false],
            ["isPrincipal", "Tilgung", expense?.isPrincipal ?? false],
            [
              "isCapitalizable",
              "Aktivierbare Kosten",
              expense?.isCapitalizable ??
                category?.isCapitalizableDefault ??
                false,
            ],
            [
              "isDeductible",
              "Als abzugsfähig eingeordnet",
              expense?.isDeductible ?? false,
            ],
            [
              "isRecoverable",
              "Umlagefähig",
              expense?.isRecoverable ??
                category?.isRecoverableDefault ??
                false,
            ],
          ].map(([name, label, checked]) => (
            <label
              key={String(name)}
              className="flex items-start gap-3 text-sm"
            >
              <input
                type="checkbox"
                name={String(name)}
                defaultChecked={Boolean(checked)}
                className="mt-0.5 size-4 rounded border-input accent-primary"
              />
              <span>{String(label)}</span>
            </label>
          ))}
        </div>

        <Alert>
          <ShieldCheck />
          <AlertDescription>
            Steuerliche Einordnungen sind unverbindliche Nutzereingaben und
            ersetzen keine Beratung durch einen Steuerberater.
          </AlertDescription>
        </Alert>
      </section>

      <Button type="submit" disabled={pending || categories.length === 0}>
        {pending ? <Loader2 className="animate-spin" /> : <Save />}
        {pending ? "Prüfung wird gespeichert …" : "Prüfung bestätigen"}
      </Button>
    </form>
  );
}
