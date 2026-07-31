import type { Metadata } from "next";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InvitationForm } from "@/components/auth/invitation-form";
import { getViewer } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Einladung annehmen" };

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const viewer = await getViewer();

  return (
    <div>
      <div className="mb-7 grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
        <MailCheck className="size-6" />
      </div>
      <h1 className="text-3xl font-semibold tracking-tight">
        Einladung zu Estate Brain
      </h1>
      <p className="mb-8 mt-3 text-muted-foreground">
        Nimm die Einladung an, um der Immobilienverwaltung mit der vorgesehenen
        Rolle beizutreten.
      </p>
      <Card>
        <CardContent className="pt-6">
          {viewer ? (
            <InvitationForm token={token} />
          ) : (
            <div className="space-y-3">
              <Button asChild className="w-full" size="lg">
                <Link href={`/login?next=/einladung/${encodeURIComponent(token)}`}>
                  Anmelden und annehmen
                </Link>
              </Button>
              <Button asChild className="w-full" size="lg" variant="outline">
                <Link
                  href={`/registrieren?invite=${encodeURIComponent(token)}`}
                >
                  Konto erstellen
                </Link>
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
