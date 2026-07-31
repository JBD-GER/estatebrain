"use client";

import { useActionState, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  CircleDollarSign,
  Loader2,
} from "lucide-react";
import {
  recordManualRentPaymentAction,
  type ManualRentPaymentState,
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
import { Textarea } from "@/components/ui/textarea";

export type OpenRentClaimOption = {
  value: string;
  label: string;
  outstandingCents: number;
};

const initialState: ManualRentPaymentState = { status: "idle" };
const selectClassName =
  "border-input bg-background h-8 w-full rounded-lg border px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

function eurosFromCents(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

export function RecordRentPaymentForm({
  claims,
  defaultPaidOn,
}: {
  claims: OpenRentClaimOption[];
  defaultPaidOn: string;
}) {
  const [state, action, pending] = useActionState(
    recordManualRentPaymentAction,
    initialState,
  );
  const [selectedClaimId, setSelectedClaimId] = useState(
    claims[0]?.value ?? "",
  );
  const [amount, setAmount] = useState(
    claims[0] ? eurosFromCents(claims[0].outstandingCents) : "",
  );

  function selectClaim(claimId: string) {
    setSelectedClaimId(claimId);
    const claim = claims.find((candidate) => candidate.value === claimId);
    setAmount(claim ? eurosFromCents(claim.outstandingCents) : "");
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" disabled={claims.length === 0}>
          <CircleDollarSign aria-hidden="true" />
          Zahlung verbuchen
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Mietzahlung verbuchen</DialogTitle>
          <DialogDescription>
            Ordne einen manuellen Zahlungseingang einer offenen Sollstellung
            zu. Teil- und Überzahlungen werden automatisch ausgewiesen.
          </DialogDescription>
        </DialogHeader>

        <form action={action} className="grid gap-5" noValidate>
          {state.message ? (
            <Alert
              variant={state.status === "error" ? "destructive" : "default"}
            >
              {state.status === "success" ? (
                <CheckCircle2 aria-hidden="true" />
              ) : (
                <CircleAlert aria-hidden="true" />
              )}
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}

          <div className="grid gap-2">
            <Label htmlFor="rentClaimId">Offene Sollstellung *</Label>
            <select
              id="rentClaimId"
              name="rentClaimId"
              value={selectedClaimId}
              onChange={(event) => selectClaim(event.target.value)}
              className={selectClassName}
              required
              aria-invalid={Boolean(state.errors?.rentClaimId)}
            >
              {claims.map((claim) => (
                <option key={claim.value} value={claim.value}>
                  {claim.label}
                </option>
              ))}
            </select>
            {state.errors?.rentClaimId?.[0] ? (
              <p className="text-xs text-destructive">
                {state.errors.rentClaimId[0]}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="paidOn">Eingangsdatum *</Label>
              <Input
                id="paidOn"
                name="paidOn"
                type="date"
                defaultValue={defaultPaidOn}
                required
                aria-invalid={Boolean(state.errors?.paidOn)}
              />
              {state.errors?.paidOn?.[0] ? (
                <p className="text-xs text-destructive">
                  {state.errors.paidOn[0]}
                </p>
              ) : null}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="amount">Betrag in Euro *</Label>
              <Input
                id="amount"
                name="amount"
                inputMode="decimal"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                required
                aria-invalid={Boolean(state.errors?.amountCents)}
              />
              {state.errors?.amountCents?.[0] ? (
                <p className="text-xs text-destructive">
                  {state.errors.amountCents[0]}
                </p>
              ) : null}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="paymentNotes">Notiz</Label>
            <Textarea
              id="paymentNotes"
              name="notes"
              maxLength={1_000}
              placeholder="z. B. Zahlung laut Kontoauszug"
              aria-invalid={Boolean(state.errors?.notes)}
            />
            {state.errors?.notes?.[0] ? (
              <p className="text-xs text-destructive">
                {state.errors.notes[0]}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="submit" disabled={pending || claims.length === 0}>
              {pending ? (
                <Loader2 className="animate-spin" aria-hidden="true" />
              ) : (
                <CircleDollarSign aria-hidden="true" />
              )}
              Zahlung speichern
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
