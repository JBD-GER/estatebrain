"use client";

import { useActionState } from "react";
import { CheckCircle2, Clipboard, Loader2, UserPlus } from "lucide-react";
import {
  inviteMemberAction,
  type InviteMemberState,
} from "@/app/app/team/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const initialState: InviteMemberState = { status: "idle" };

export function InviteMemberForm({
  tenants,
}: {
  tenants: Array<{ id: string; name: string }>;
}) {
  const [state, action, pending] = useActionState(
    inviteMemberAction,
    initialState,
  );

  return (
    <form action={action} className="grid gap-4">
      {state.message ? (
        <Alert variant={state.status === "error" ? "destructive" : "default"}>
          {state.status === "success" ? <CheckCircle2 /> : <UserPlus />}
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor="invite-email">E-Mail-Adresse</Label>
        <Input
          id="invite-email"
          name="email"
          type="email"
          autoComplete="email"
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="invite-role">Rolle</Label>
        <select
          id="invite-role"
          name="role"
          required
          defaultValue="employee"
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option value="admin">Administrator</option>
          <option value="property_manager">Immobilienmanager</option>
          <option value="accounting">Buchhaltung / Steuerberater</option>
          <option value="employee">Mitarbeiter</option>
          <option value="tenant">Mieterportal</option>
        </select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="invite-tenant">Mieterzuordnung (nur Mieterportal)</Label>
        <select
          id="invite-tenant"
          name="tenantId"
          defaultValue=""
          className="border-input bg-background h-9 rounded-md border px-3 text-sm"
        >
          <option value="">Keine Mieterzuordnung</option>
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.name}
            </option>
          ))}
        </select>
      </div>

      {state.invitationUrl ? (
        <div className="rounded-lg border bg-muted/50 p-3">
          <p className="mb-2 text-xs font-medium">Einladungslink</p>
          <div className="flex gap-2">
            <Input value={state.invitationUrl} readOnly aria-label="Einladungslink" />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => navigator.clipboard.writeText(state.invitationUrl ?? "")}
              aria-label="Einladungslink kopieren"
            >
              <Clipboard />
            </Button>
          </div>
        </div>
      ) : null}

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? <Loader2 className="animate-spin" /> : <UserPlus />}
        Einladung erstellen
      </Button>
    </form>
  );
}
