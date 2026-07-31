import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { resetPasswordAction } from "@/app/(auth)/actions";

export const metadata: Metadata = { title: "Neues Passwort setzen" };

export default function ResetPasswordPage() {
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-tight">
        Neues Passwort festlegen
      </h1>
      <p className="mb-8 mt-3 text-muted-foreground">
        Verwende mindestens acht Zeichen, einen Buchstaben und eine Zahl.
      </p>
      <AuthForm
        action={resetPasswordAction}
        fields={[
          {
            name: "password",
            label: "Neues Passwort",
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
        submitLabel="Passwort speichern"
        pendingLabel="Passwort wird gespeichert"
        footer={
          <Link
            className="block text-center text-sm text-primary hover:underline"
            href="/app"
          >
            Danach zu Estate Brain
          </Link>
        }
      />
    </div>
  );
}
