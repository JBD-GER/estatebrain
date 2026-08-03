import { CircleAlert, CircleCheck, Undo2 } from "lucide-react";
import { cancelRentClaimAction } from "@/app/app/einnahmen/actions";
import { ModuleWorkspace } from "@/components/app/module-workspace";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { hasPermission } from "@/lib/auth/permissions";
import { getModulePageData } from "@/lib/data/modules";
import { createClient } from "@/lib/supabase/server";

const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});
const date = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: "UTC",
});

function formatDate(value: string) {
  return date.format(new Date(`${value.slice(0, 10)}T00:00:00.000Z`));
}

export default async function IncomePage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string | string[] }>;
}) {
  const data = await getModulePageData("einnahmen");
  if (!data) return null;
  const rawResult = (await searchParams).result;
  const result = typeof rawResult === "string" ? rawResult : null;
  const canCancel =
    hasPermission(data.viewer.role, "bookkeeping.write") ||
    hasPermission(data.viewer.role, "portfolio.write");
  const supabase = await createClient();
  const claimsResult = canCancel
    ? await supabase
        .from("rent_claims")
        .select("id, lease_id, claim_month, due_date, amount_cents, paid_cents, status")
        .eq("organization_id", data.viewer.organizationId)
        .in("status", ["open", "partial"])
        .eq("paid_cents", 0)
        .order("due_date", { ascending: false })
        .limit(100)
    : { data: [], error: null };
  const claims = claimsResult.data ?? [];
  const leaseIds = [...new Set(claims.map((claim) => claim.lease_id))];
  const leasesResult = leaseIds.length
    ? await supabase
        .from("leases")
        .select("id, unit_id, lease_number")
        .eq("organization_id", data.viewer.organizationId)
        .in("id", leaseIds)
    : { data: [] };
  const unitIds = [
    ...new Set((leasesResult.data ?? []).map((lease) => lease.unit_id)),
  ];
  const unitsResult = unitIds.length
    ? await supabase
        .from("units")
        .select("id, property_id, unit_number")
        .eq("organization_id", data.viewer.organizationId)
        .in("id", unitIds)
    : { data: [] };
  const propertyIds = [
    ...new Set((unitsResult.data ?? []).map((unit) => unit.property_id)),
  ];
  const propertiesResult = propertyIds.length
    ? await supabase
        .from("properties")
        .select("id, name")
        .eq("organization_id", data.viewer.organizationId)
        .in("id", propertyIds)
    : { data: [] };

  const leaseById = new Map(
    (leasesResult.data ?? []).map((lease) => [lease.id, lease]),
  );
  const unitById = new Map(
    (unitsResult.data ?? []).map((unit) => [unit.id, unit]),
  );
  const propertyById = new Map(
    (propertiesResult.data ?? []).map((property) => [property.id, property]),
  );

  const resultNotice =
    result === "cancelled" ? (
      <Alert>
        <CircleCheck />
        <AlertTitle>Sollstellung storniert</AlertTitle>
        <AlertDescription>
          Die Forderung bleibt mit Stornogrund im Audit-Verlauf erhalten und
          wird nicht mehr als Einnahmesoll gezählt.
        </AlertDescription>
      </Alert>
    ) : result ? (
      <Alert variant="destructive">
        <CircleAlert />
        <AlertTitle>Stornierung nicht durchgeführt</AlertTitle>
        <AlertDescription>
          Prüfe Berechtigung und Begründung. Forderungen mit bestätigter Zahlung
          müssen zuerst über den Zahlungsabgleich korrigiert werden.
        </AlertDescription>
      </Alert>
    ) : null;

  const cancellationPanel = canCancel ? (
    <div className="space-y-4">
      {resultNotice}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Undo2 className="size-4 text-primary" />
            Offene Miet-Sollstellungen stornieren
          </CardTitle>
          <CardDescription>
            Nur unbezahlte Forderungen können storniert werden. Bereits
            bestätigte Zahlungen bleiben geschützt.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {claims.map((claim) => {
            const lease = leaseById.get(claim.lease_id);
            const unit = lease ? unitById.get(lease.unit_id) : undefined;
            const property = unit
              ? propertyById.get(unit.property_id)
              : undefined;
            return (
              <form
                action={cancelRentClaimAction}
                className="grid gap-3 rounded-xl border p-4 lg:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_auto] lg:items-end"
                key={claim.id}
              >
                <input type="hidden" name="rentClaimId" value={claim.id} />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">
                      {property?.name ?? "Immobilie"} · {unit?.unit_number ?? "Einheit"}
                    </p>
                    <Badge variant="outline">
                      {euro.format(Number(claim.amount_cents ?? 0) / 100)}
                    </Badge>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Fällig {formatDate(claim.due_date)} · Mietmonat {formatDate(claim.claim_month)}
                  </p>
                </div>
                <Input
                  name="reason"
                  minLength={3}
                  maxLength={500}
                  required
                  aria-label={`Stornogrund für ${property?.name ?? "Immobilie"}`}
                  placeholder="Stornogrund, z. B. Vertragskorrektur"
                />
                <Button type="submit" variant="destructive">
                  <Undo2 />
                  Stornieren
                </Button>
              </form>
            );
          })}
          {claims.length === 0 ? (
            <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Keine unbezahlte offene Sollstellung zum Stornieren.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </div>
  ) : (
    resultNotice
  );

  return (
    <ModuleWorkspace
      definition={data.definition}
      rows={data.rows}
      relations={data.relations}
      relationErrors={data.relationErrors}
      error={data.error || (claimsResult.error ? "claims" : null)}
      forbidden={data.forbidden}
      canCreate={data.canCreate}
      notice={cancellationPanel}
    />
  );
}
