"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import type { AuthActionState } from "@/app/(auth)/actions";

type AuthField = {
  name: string;
  label: string;
  type?: "text" | "email" | "password";
  autoComplete?: string;
  placeholder?: string;
};

const initialState: AuthActionState = { status: "idle" };

export function AuthForm({
  action,
  fields,
  submitLabel,
  pendingLabel,
  next,
  footer,
}: {
  action: (
    state: AuthActionState,
    formData: FormData,
  ) => Promise<AuthActionState>;
  fields: AuthField[];
  submitLabel: string;
  pendingLabel: string;
  next?: string;
  footer?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {state.message ? (
        <Alert variant={state.status === "error" ? "destructive" : "default"}>
          {state.status === "error" ? (
            <AlertCircle aria-hidden="true" />
          ) : (
            <CheckCircle2 aria-hidden="true" />
          )}
          <AlertDescription>{state.message}</AlertDescription>
        </Alert>
      ) : null}

      {fields.map((field) => {
        const error = state.errors?.[field.name]?.[0];
        return (
          <div className="space-y-2" key={field.name}>
            <Label htmlFor={field.name}>{field.label}</Label>
            <Input
              id={field.name}
              name={field.name}
              type={field.type ?? "text"}
              autoComplete={field.autoComplete}
              placeholder={field.placeholder}
              required
              aria-invalid={Boolean(error)}
              aria-describedby={error ? `${field.name}-error` : undefined}
            />
            {error ? (
              <p
                id={`${field.name}-error`}
                className="text-sm text-destructive"
              >
                {error}
              </p>
            ) : null}
          </div>
        );
      })}

      <Button type="submit" className="w-full" size="lg" disabled={pending}>
        {pending ? (
          <>
            <Loader2 className="animate-spin" aria-hidden="true" />
            {pendingLabel}
          </>
        ) : (
          submitLabel
        )}
      </Button>

      {footer}
    </form>
  );
}

export function AuthLegalNote() {
  return (
    <p className="text-center text-xs leading-5 text-muted-foreground">
      Mit der Nutzung akzeptierst du unsere{" "}
      <Link className="underline underline-offset-2" href="/nutzungsbedingungen">
        Nutzungsbedingungen
      </Link>{" "}
      und{" "}
      <Link className="underline underline-offset-2" href="/datenschutz">
        Datenschutzhinweise
      </Link>
      .
    </p>
  );
}
