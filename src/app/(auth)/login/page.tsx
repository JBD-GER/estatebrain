import type { Metadata } from "next";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { AuthForm } from "@/components/auth/auth-form";
import { loginAction } from "@/app/(auth)/actions";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { loginPageErrorMessage } from "@/lib/auth/errors";

export const metadata: Metadata = { title: "Anmelden" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const params = await searchParams;
  const pageError = loginPageErrorMessage(params.error);

  return (
    <div>
      <div className="mb-8">
        <p className="text-sm font-medium text-primary">Willkommen zurück</p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Bei Estate Brain anmelden
        </h1>
        <p className="mt-3 text-muted-foreground">
          Noch kein Konto?{" "}
          <Link className="font-medium text-primary hover:underline" href="/registrieren">
            Kostenlos starten
          </Link>
        </p>
      </div>

      {pageError ? (
        <Alert className="mb-5" variant="destructive">
          <AlertCircle aria-hidden="true" />
          <AlertDescription>{pageError}</AlertDescription>
        </Alert>
      ) : null}

      <AuthForm
        action={loginAction}
        next={params.next}
        fields={[
          {
            name: "email",
            label: "E-Mail-Adresse",
            type: "email",
            autoComplete: "email",
            placeholder: "name@beispiel.de",
          },
          {
            name: "password",
            label: "Passwort",
            type: "password",
            autoComplete: "current-password",
          },
        ]}
        submitLabel="Anmelden"
        pendingLabel="Anmeldung läuft"
        footer={
          <div className="flex items-center justify-between text-sm">
            <Link
              className="text-muted-foreground hover:text-foreground"
              href="/passwort-vergessen"
            >
              Passwort vergessen?
            </Link>
            <Link className="font-medium text-primary hover:underline" href="/demo">
              Demo öffnen
            </Link>
          </div>
        }
      />
    </div>
  );
}
