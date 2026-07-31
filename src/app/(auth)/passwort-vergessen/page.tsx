import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AuthForm } from "@/components/auth/auth-form";
import { forgotPasswordAction } from "@/app/(auth)/actions";

export const metadata: Metadata = { title: "Passwort vergessen" };

export default function ForgotPasswordPage() {
  return (
    <div>
      <Link
        href="/login"
        className="mb-8 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Zurück zur Anmeldung
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">
        Passwort zurücksetzen
      </h1>
      <p className="mb-8 mt-3 text-muted-foreground">
        Wir senden dir einen sicheren Link an deine E-Mail-Adresse.
      </p>
      <AuthForm
        action={forgotPasswordAction}
        fields={[
          {
            name: "email",
            label: "E-Mail-Adresse",
            type: "email",
            autoComplete: "email",
            placeholder: "name@beispiel.de",
          },
        ]}
        submitLabel="Link anfordern"
        pendingLabel="Link wird angefordert"
      />
    </div>
  );
}
