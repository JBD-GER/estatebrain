"use client";

import { startTransition, useActionState, useState } from "react";
import {
  Building2,
  CheckCircle2,
  CircleAlert,
  Loader2,
  Plus,
} from "lucide-react";
import {
  createTenantLeaseAction,
  type CreateTenantLeaseState,
} from "@/app/app/mietverhaeltnisse/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export type LeaseCreationProperty = {
  value: string;
  label: string;
  address: string;
  units: Array<{
    value: string;
    label: string;
  }>;
};

const initialState: CreateTenantLeaseState = { status: "idle" };
const selectClassName =
  "border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function FieldError({
  field,
  state,
}: {
  field: string;
  state: CreateTenantLeaseState;
}) {
  const error = state.errors?.[field]?.[0];
  return error ? (
    <p id={`${field}-error`} className="text-xs text-destructive">
      {error}
    </p>
  ) : null;
}

function describedBy(field: string, state: CreateTenantLeaseState) {
  return state.errors?.[field]?.length ? `${field}-error` : undefined;
}

export function CreateTenantLeaseForm({
  properties,
}: {
  properties: LeaseCreationProperty[];
}) {
  const [state, action, pending] = useActionState(
    createTenantLeaseAction,
    initialState,
  );
  const [tenantType, setTenantType] = useState<"person" | "company">("person");
  const [propertyId, setPropertyId] = useState(properties[0]?.value ?? "");
  const [unitId, setUnitId] = useState(properties[0]?.units[0]?.value ?? "");
  const selectedProperty =
    properties.find((property) => property.value === propertyId) ??
    properties[0];
  const availableUnits = selectedProperty?.units ?? [];
  const hasAvailableUnit = properties.some(
    (property) => property.units.length > 0,
  );

  function selectProperty(nextPropertyId: string) {
    const property = properties.find(
      (candidate) => candidate.value === nextPropertyId,
    );
    setPropertyId(nextPropertyId);
    setUnitId(property?.units[0]?.value ?? "");
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" disabled={!hasAvailableUnit}>
          <Plus />
          Mieter & Vertrag anlegen
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Mieter und Mietverhältnis anlegen</DialogTitle>
          <DialogDescription>
            Alle Datensätze werden gemeinsam gespeichert. Schlägt ein Schritt
            fehl, bleibt der Datenbestand unverändert.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={event=>{event.preventDefault();const data=new FormData(event.currentTarget);startTransition(()=>action(data));}} className="grid gap-6" noValidate>
          {state.message ? (
            <Alert
              variant={state.status === "error" ? "destructive" : "default"}
            >
              {state.status === "success" ? (
                <CheckCircle2 />
              ) : (
                <CircleAlert />
              )}
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}

          <fieldset className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
            <legend className="px-1 text-sm font-semibold">
              Immobilie & Einheit
            </legend>
            <div className="grid gap-2">
              <Label htmlFor="propertyId">Immobilie *</Label>
              <select
                id="propertyId"
                name="propertyId"
                value={propertyId}
                onChange={(event) => selectProperty(event.target.value)}
                className={selectClassName}
                required
                aria-invalid={Boolean(state.errors?.propertyId)}
                aria-describedby={describedBy("propertyId", state)}
              >
                {properties.map((property) => (
                  <option key={property.value} value={property.value}>
                    {property.label}
                  </option>
                ))}
              </select>
              <FieldError field="propertyId" state={state} />
              {selectedProperty?.address ? (
                <p className="text-xs text-muted-foreground">
                  {selectedProperty.address}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="unitId">Einheit *</Label>
              <select
                id="unitId"
                name="unitId"
                value={unitId}
                onChange={(event) => setUnitId(event.target.value)}
                className={selectClassName}
                required
                aria-invalid={Boolean(state.errors?.unitId)}
                aria-describedby={describedBy("unitId", state)}
              >
                {availableUnits.length ? (
                  availableUnits.map((unit) => (
                    <option key={unit.value} value={unit.value}>
                      {unit.label}
                    </option>
                  ))
                ) : (
                  <option value="">Keine freie Einheit</option>
                )}
              </select>
              <FieldError field="unitId" state={state} />
            </div>
          </fieldset>

          <fieldset className="grid gap-4 rounded-xl border p-4 sm:grid-cols-2">
            <legend className="px-1 text-sm font-semibold">Mieter</legend>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="tenantType">Mietertyp *</Label>
              <select
                id="tenantType"
                name="tenantType"
                value={tenantType}
                onChange={(event) =>
                  setTenantType(event.target.value as "person" | "company")
                }
                className={selectClassName}
                required
              >
                <option value="person">Privatperson</option>
                <option value="company">Firma</option>
              </select>
              <FieldError field="tenantType" state={state} />
            </div>

            {tenantType === "person" ? (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="firstName">Vorname *</Label>
                  <Input
                    id="firstName"
                    name="firstName"
                    autoComplete="given-name"
                    required
                    aria-invalid={Boolean(state.errors?.firstName)}
                    aria-describedby={describedBy("firstName", state)}
                  />
                  <FieldError field="firstName" state={state} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="lastName">Nachname *</Label>
                  <Input
                    id="lastName"
                    name="lastName"
                    autoComplete="family-name"
                    required
                    aria-invalid={Boolean(state.errors?.lastName)}
                    aria-describedby={describedBy("lastName", state)}
                  />
                  <FieldError field="lastName" state={state} />
                </div>
              </>
            ) : (
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="companyName">Firmenname *</Label>
                <Input
                  id="companyName"
                  name="companyName"
                  autoComplete="organization"
                  required
                  aria-invalid={Boolean(state.errors?.companyName)}
                  aria-describedby={describedBy("companyName", state)}
                />
                <FieldError field="companyName" state={state} />
              </div>
            )}

            <div className="grid gap-2">
              <Label htmlFor="email">E-Mail-Adresse</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                aria-invalid={Boolean(state.errors?.email)}
                aria-describedby={describedBy("email", state)}
              />
              <FieldError field="email" state={state} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                aria-invalid={Boolean(state.errors?.phone)}
                aria-describedby={describedBy("phone", state)}
              />
              <FieldError field="phone" state={state} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="street">Straße</Label>
              <Input
                id="street"
                name="street"
                autoComplete="street-address"
                aria-invalid={Boolean(state.errors?.street)}
                aria-describedby={describedBy("street", state)}
              />
              <FieldError field="street" state={state} />
            </div>
            <div className="grid grid-cols-[1fr_2fr] gap-3">
              <div className="grid gap-2">
                <Label htmlFor="houseNumber">Hausnr.</Label>
                <Input
                  id="houseNumber"
                  name="houseNumber"
                  aria-invalid={Boolean(state.errors?.houseNumber)}
                  aria-describedby={describedBy("houseNumber", state)}
                />
                <FieldError field="houseNumber" state={state} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="postalCode">PLZ</Label>
                <Input
                  id="postalCode"
                  name="postalCode"
                  autoComplete="postal-code"
                  aria-invalid={Boolean(state.errors?.postalCode)}
                  aria-describedby={describedBy("postalCode", state)}
                />
                <FieldError field="postalCode" state={state} />
              </div>
            </div>
            <div className="grid gap-2 sm:col-span-2">
              <Label htmlFor="city">Ort</Label>
              <Input
                id="city"
                name="city"
                autoComplete="address-level2"
                aria-invalid={Boolean(state.errors?.city)}
                aria-describedby={describedBy("city", state)}
              />
              <FieldError field="city" state={state} />
            </div>
          </fieldset>

          <fieldset className="grid gap-4 rounded-xl border p-4 sm:grid-cols-3">
            <legend className="px-1 text-sm font-semibold">
              Laufzeit & Fälligkeit
            </legend>
            <div className="grid gap-2">
              <Label htmlFor="leaseNumber">Vertragsnummer</Label>
              <Input
                id="leaseNumber"
                name="leaseNumber"
                aria-invalid={Boolean(state.errors?.leaseNumber)}
                aria-describedby={describedBy("leaseNumber", state)}
              />
              <FieldError field="leaseNumber" state={state} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="startsOn">Mietbeginn *</Label>
              <Input
                id="startsOn"
                name="startsOn"
                type="date"
                required
                aria-invalid={Boolean(state.errors?.startsOn)}
                aria-describedby={describedBy("startsOn", state)}
              />
              <FieldError field="startsOn" state={state} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="endsOn">Mietende</Label>
              <Input
                id="endsOn"
                name="endsOn"
                type="date"
                aria-invalid={Boolean(state.errors?.endsOn)}
                aria-describedby={describedBy("endsOn", state)}
              />
              <FieldError field="endsOn" state={state} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="noticePeriodMonths">Kündigungsfrist (Monate) *</Label>
              <Input
                id="noticePeriodMonths"
                name="noticePeriodMonths"
                type="number"
                min="0"
                max="120"
                step="1"
                defaultValue="3"
                required
                aria-invalid={Boolean(state.errors?.noticePeriodMonths)}
                aria-describedby={describedBy("noticePeriodMonths", state)}
              />
              <FieldError field="noticePeriodMonths" state={state} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="dueDay">Fälligkeitstag *</Label>
              <Input
                id="dueDay"
                name="dueDay"
                type="number"
                min="1"
                max="31"
                step="1"
                defaultValue="3"
                required
                aria-invalid={Boolean(state.errors?.dueDay)}
                aria-describedby={describedBy("dueDay", state)}
              />
              <FieldError field="dueDay" state={state} />
            </div>
          </fieldset>

          <fieldset className="grid gap-4 rounded-xl border p-4 sm:grid-cols-3">
            <legend className="px-1 text-sm font-semibold">
              Miete & Kaution
            </legend>
            <div className="grid gap-2">
              <Label htmlFor="coldRentCents">
                Vertrags-Kaltmiete (mtl.) *
              </Label>
              <Input
                id="coldRentCents"
                name="coldRentCents"
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                required
                aria-invalid={Boolean(state.errors?.coldRentCents)}
                aria-describedby={describedBy("coldRentCents", state)}
              />
              <FieldError field="coldRentCents" state={state} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ancillaryChargeType">Nebenkostenart *</Label>
              <select
                id="ancillaryChargeType"
                name="ancillaryChargeType"
                defaultValue="advance"
                className={selectClassName}
                required
                aria-invalid={Boolean(state.errors?.ancillaryChargeType)}
                aria-describedby={describedBy("ancillaryChargeType", state)}
              >
                <option value="advance">Vorauszahlung</option>
                <option value="flat_rate">Betriebskostenpauschale</option>
                <option value="none">Keine gesonderten Nebenkosten</option>
              </select>
              <FieldError field="ancillaryChargeType" state={state} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="ancillaryPrepaymentCents">
                Nebenkostenbetrag (mtl.) *
              </Label>
              <Input
                id="ancillaryPrepaymentCents"
                name="ancillaryPrepaymentCents"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                defaultValue="0.00"
                required
                aria-invalid={Boolean(state.errors?.ancillaryPrepaymentCents)}
                aria-describedby={describedBy(
                  "ancillaryPrepaymentCents",
                  state,
                )}
              />
              <FieldError field="ancillaryPrepaymentCents" state={state} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="parkingRentCents">
                Stellplatzmiete (mtl.) *
              </Label>
              <Input
                id="parkingRentCents"
                name="parkingRentCents"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                defaultValue="0.00"
                required
                aria-invalid={Boolean(state.errors?.parkingRentCents)}
                aria-describedby={describedBy("parkingRentCents", state)}
              />
              <FieldError field="parkingRentCents" state={state} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="otherRentCents">
                Sonstige Mietbestandteile (mtl.) *
              </Label>
              <Input
                id="otherRentCents"
                name="otherRentCents"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                defaultValue="0.00"
                required
                aria-invalid={Boolean(state.errors?.otherRentCents)}
                aria-describedby={describedBy("otherRentCents", state)}
              />
              <FieldError field="otherRentCents" state={state} />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="depositCents">Kaution *</Label>
              <Input
                id="depositCents"
                name="depositCents"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                defaultValue="0.00"
                required
                aria-invalid={Boolean(state.errors?.depositCents)}
                aria-describedby={describedBy("depositCents", state)}
              />
              <FieldError field="depositCents" state={state} />
            </div>
          </fieldset>

          <DialogFooter>
            <Button
              type="submit"
              disabled={
                pending || !unitId || state.status === "success"
              }
            >
              {pending ? <Loader2 className="animate-spin" /> : <Building2 />}
              {pending ? "Wird vollständig gespeichert …" : "Vertrag anlegen"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
