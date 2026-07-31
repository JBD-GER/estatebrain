import type { Metadata } from "next";
import Link from "next/link";
import {
  AuthForm,
  AuthLegalNote,
} from "@/components/auth/auth-form";
import { registrationAction } from "@/app/(auth)/actions";

export const metadata: Metadata = { title: "Kostenlos registrieren" };

export default async function RegistrationPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; invite?: string }>;
}) {
  const params = await searchParams;
  const next = params.invite
    ? `/einladung/${encodeURIComponent(params.invite)}`
    : params.next;

  return (
    <div>
      <div className="mb-8">
        <p className="text-sm font-medium text-primary">
          In wenigen Minuten startklar
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight">
          Kostenloses Konto erstellen
        </h1>
        <p className="mt-3 text-muted-foreground">
          Bereits registriert?{" "}
          <Link className="font-medium text-primary hover:underline" href="/login">
            Jetzt anmelden
          </Link>
        </p>
      </div>

      <AuthForm
        action={registrationAction}
        next={next}
        fields={[
          {
            name: "fullName",
            label: "Vollständiger Name",
            autoComplete: "name",
            placeholder: "Max Mustermann",
          },
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
            autoComplete: "new-password",
          },
          {
            name: "passwordConfirmation",
            label: "Passwort wiederholen",
            type: "password",
            autoComplete: "new-password",
          },
        ]}
        submitLabel="Konto erstellen"
        pendingLabel="Konto wird erstellt"
        footer={<AuthLegalNote />}
      />
    </div>
  );
}
