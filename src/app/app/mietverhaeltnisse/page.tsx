import { CalendarPlus, CheckCircle2, CircleAlert } from "lucide-react";
import { generateCurrentMonthRentClaimsAction } from "@/app/app/mietverhaeltnisse/actions";
import { ModuleWorkspace } from "@/components/app/module-workspace";
import {
  CreateTenantLeaseForm,
  type LeaseCreationProperty,
} from "@/components/leases/create-tenant-lease-form";
import {
  RecordRentPaymentForm,
  type OpenRentClaimOption,
} from "@/components/leases/record-rent-payment-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { hasPermission } from "@/lib/auth/permissions";
import { getModulePageData } from "@/lib/data/modules";
import { createClient } from "@/lib/supabase/server";

const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

function currentMonthLabel() {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

function currentBerlinDate() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function monthLabel(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export default async function RentPage({
  searchParams,
}: {
  searchParams: Promise<{
    result?: string | string[];
    count?: string | string[];
  }>;
}) {
  const data = await getModulePageData("mietverhaeltnisse");
  if (!data) return null;

  const params = await searchParams;
  const result = typeof params.result === "string" ? params.result : null;
  const rawCount = typeof params.count === "string" ? params.count : "0";
  const parsedCount = Number.parseInt(rawCount, 10);
  const count =
    Number.isSafeInteger(parsedCount) && parsedCount >= 0 ? parsedCount : 0;
  const canGenerate =
    hasPermission(data.viewer.role, "portfolio.write") ||
    hasPermission(data.viewer.role, "bookkeeping.write");
  const canCreate = hasPermission(data.viewer.role, "portfolio.write");
  const canRecordPayment = hasPermission(
    data.viewer.role,
    "bookkeeping.write",
  );

  const supabase = await createClient();
  const [creationResults, claimsResult] = await Promise.all([
    canCreate
      ? Promise.all([
          supabase
            .from("properties")
            .select("id, name, street, house_number, postal_code, city")
            .eq("organization_id", data.viewer.organizationId)
            .eq("property_mode", "existing")
            .eq("status", "active")
            .is("archived_at", null)
            .order("name"),
          supabase
            .from("units")
            .select(
              "id, property_id, unit_number, status, target_cold_rent_cents",
            )
            .eq("organization_id", data.viewer.organizationId)
            .in("status", ["vacant", "reserved"])
            .is("archived_at", null)
            .order("unit_number"),
        ])
      : Promise.resolve(null),
    canRecordPayment
      ? supabase
          .from("rent_claims")
          .select("id, lease_id, claim_month, amount_cents, paid_cents")
          .eq("organization_id", data.viewer.organizationId)
          .in("status", ["open", "partial"])
          .order("due_date")
          .limit(100)
      : Promise.resolve(null),
  ]);

  let creationProperties: LeaseCreationProperty[] = [];
  let creationOptionsFailed = false;
  if (creationResults) {
    const [
      { data: properties, error: propertiesError },
      { data: units, error: unitsError },
    ] = creationResults;
    creationOptionsFailed = Boolean(propertiesError || unitsError);
    const unitsByProperty = new Map<
      string,
      LeaseCreationProperty["units"]
    >();
    for (const unit of units ?? []) {
      const propertyId = String(unit.property_id);
      const propertyUnits = unitsByProperty.get(propertyId) ?? [];
      propertyUnits.push({
        value: String(unit.id),
        label: `${unit.unit_number || "Einheit"} · ${
          unit.status === "reserved" ? "reserviert" : "frei"
        } · Markt-/SOLL-Kaltmiete (mtl.) ${euro.format(
          Number(unit.target_cold_rent_cents) / 100,
        )}`,
      });
      unitsByProperty.set(propertyId, propertyUnits);
    }

    creationProperties = (properties ?? [])
      .map((property) => ({
        value: String(property.id),
        label: property.name || "Immobilie",
        address: [
          [property.street, property.house_number].filter(Boolean).join(" "),
          [property.postal_code, property.city].filter(Boolean).join(" "),
        ]
          .filter(Boolean)
          .join(", "),
        units: unitsByProperty.get(String(property.id)) ?? [],
      }))
      .filter((property) => property.units.length > 0);
  }

  let openRentClaims: OpenRentClaimOption[] = [];
  let paymentOptionsFailed = false;
  if (claimsResult) {
    paymentOptionsFailed = Boolean(claimsResult.error);

    const leaseLabels = new Map(
      data.rows.map((row) => [
        String(row.id ?? ""),
        String(row.tenant_name ?? row.unit_name ?? "Mietverhältnis"),
      ]),
    );
    openRentClaims = (claimsResult.data ?? [])
      .map((claim) => {
        const outstandingCents = Math.max(
          0,
          Number(claim.amount_cents) - Number(claim.paid_cents),
        );
        return {
          value: String(claim.id),
          label: `${monthLabel(claim.claim_month)} · ${
            leaseLabels.get(String(claim.lease_id)) ?? "Mietverhältnis"
          } · offen ${euro.format(outstandingCents / 100)}`,
          outstandingCents,
        };
      })
      .filter((claim) => claim.outstandingCents > 0);
  }

  const rentClaimNotice =
    result === "generated" ? (
      <Alert>
        <CheckCircle2 />
        <AlertTitle>Sollstellungen verarbeitet</AlertTitle>
        <AlertDescription>
          {count === 0
            ? `Für ${currentMonthLabel()} waren bereits alle Sollstellungen vorhanden oder es gibt keine passenden aktiven Mietpläne.`
            : `${count} ${
                count === 1 ? "Sollstellung wurde" : "Sollstellungen wurden"
              } für ${currentMonthLabel()} neu angelegt.`}
        </AlertDescription>
      </Alert>
    ) : result === "forbidden" ? (
      <Alert variant="destructive">
        <CircleAlert />
        <AlertTitle>Keine Schreibberechtigung</AlertTitle>
        <AlertDescription>
          Deine Rolle darf keine monatlichen Sollstellungen erzeugen.
        </AlertDescription>
      </Alert>
    ) : result === "failed" ? (
      <Alert variant="destructive">
        <CircleAlert />
        <AlertTitle>Sollstellungen nicht erzeugt</AlertTitle>
        <AlertDescription>
          Die Verarbeitung wurde abgebrochen. Bestehende Sollstellungen blieben
          unverändert.
        </AlertDescription>
      </Alert>
    ) : null;
  const creationNotice =
    canCreate && creationOptionsFailed ? (
      <Alert variant="destructive">
        <CircleAlert />
        <AlertTitle>Auswahl nicht verfügbar</AlertTitle>
        <AlertDescription>
          Immobilien und freie Einheiten konnten nicht geladen werden. Bitte
          aktualisiere die Seite, bevor du einen Vertrag anlegst.
        </AlertDescription>
      </Alert>
    ) : canCreate && creationProperties.length === 0 ? (
      <Alert>
        <CircleAlert />
        <AlertTitle>Keine freie Einheit</AlertTitle>
        <AlertDescription>
          Lege zuerst eine aktive Immobilie mit einer freien oder reservierten
          Einheit an.
        </AlertDescription>
      </Alert>
    ) : null;
  const paymentNotice =
    canRecordPayment && paymentOptionsFailed ? (
      <Alert variant="destructive">
        <CircleAlert />
        <AlertTitle>Offene Sollstellungen nicht verfügbar</AlertTitle>
        <AlertDescription>
          Mietzahlungen können erst verbucht werden, nachdem die offenen
          Sollstellungen wieder geladen werden konnten.
        </AlertDescription>
      </Alert>
    ) : null;
  const notice =
    rentClaimNotice || creationNotice || paymentNotice ? (
      <div className="grid gap-3">
        {rentClaimNotice}
        {creationNotice}
        {paymentNotice}
      </div>
    ) : null;
  const creationOptionsKey = creationProperties
    .flatMap((property) => property.units.map((unit) => unit.value))
    .join(":");
  const paymentOptionsKey = openRentClaims
    .map((claim) => `${claim.value}:${claim.outstandingCents}`)
    .join(":");

  return (
    <ModuleWorkspace
      definition={data.definition}
      rows={data.rows}
      relations={data.relations}
      relationErrors={data.relationErrors}
      error={data.error}
      forbidden={data.forbidden}
      canCreate={data.canCreate}
      notice={notice}
      headerActions={
        canCreate || canGenerate || canRecordPayment ? (
          <>
            {canCreate ? (
              <CreateTenantLeaseForm
                key={creationOptionsKey}
                properties={creationProperties}
              />
            ) : null}
            {canRecordPayment ? (
              <RecordRentPaymentForm
                key={paymentOptionsKey}
                claims={openRentClaims}
                defaultPaidOn={currentBerlinDate()}
              />
            ) : null}
            {canGenerate ? (
              <form action={generateCurrentMonthRentClaimsAction}>
                <Button type="submit" variant="outline">
                  <CalendarPlus />
                  Sollstellungen {currentMonthLabel()}
                </Button>
              </form>
            ) : null}
          </>
        ) : undefined
      }
    />
  );
}
