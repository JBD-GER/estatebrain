"use client";

import { useActionState } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import {
  acceptInvitationAction,
  type AuthActionState,
} from "@/app/(auth)/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export function InvitationForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<
    AuthActionState,
    FormData
  >(acceptInvitationAction, { status: "idle" });

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state.message ? (
        <Alert variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}
      <Button className="w-full" size="lg" disabled={pending}>
        {pending ? <Loader2 className="animate-spin" /> : null}
        Einladung annehmen
      </Button>
    </form>
  );
}
