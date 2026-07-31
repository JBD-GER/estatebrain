import { CheckCircle2, Download, LockKeyhole, ShieldCheck } from "lucide-react";
import {
  updateOrganizationAction,
  updatePasswordAction,
  updateProfileAction,
} from "@/app/app/einstellungen/actions";
import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireOrganization } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const viewer = await requireOrganization();
  const supabase = await createClient();
  const [{ data: profile }, { data: organization }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, phone, email")
      .eq("id", viewer.userId)
      .maybeSingle(),
    supabase
      .from("organizations")
      .select(
        "name, kind, street, house_number, postal_code, city, default_currency, retention_days",
      )
      .eq("id", viewer.organizationId)
      .maybeSingle(),
  ]);
  const params = await searchParams;
  const canManageOrganization = hasPermission(
    viewer.role,
    "organization.manage",
  );

  return (
    <>
      <PageHeader
        eyebrow="Organisation & Datenschutz"
        title="Einstellungen"
        description="Profil, Sicherheit, Organisation und Datenexport zentral verwalten."
      />

      {params.saved ? (
        <Alert className="mb-5">
          <CheckCircle2 />
          <AlertDescription>Die Änderungen wurden gespeichert.</AlertDescription>
        </Alert>
      ) : null}
      {params.error ? (
        <Alert variant="destructive" className="mb-5">
          <LockKeyhole />
          <AlertDescription>
            Die Änderung konnte nicht gespeichert werden. Bitte prüfe deine
            Angaben und Berechtigung.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Persönliches Profil</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updateProfileAction} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">E-Mail-Adresse</Label>
                <Input
                  id="email"
                  value={profile?.email ?? viewer.email ?? ""}
                  disabled
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fullName">Name</Label>
                <Input
                  id="fullName"
                  name="fullName"
                  required
                  defaultValue={profile?.full_name ?? ""}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Telefon</Label>
                <Input
                  id="phone"
                  name="phone"
                  type="tel"
                  defaultValue={profile?.phone ?? ""}
                />
              </div>
              <Button type="submit" className="w-fit">Profil speichern</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Passwort ändern</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={updatePasswordAction} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="currentPassword">Aktuelles Passwort</Label>
                <Input
                  id="currentPassword"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Neues Passwort</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="passwordConfirmation">Passwort wiederholen</Label>
                <Input
                  id="passwordConfirmation"
                  name="passwordConfirmation"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  required
                />
              </div>
              <Button type="submit" className="w-fit">Passwort aktualisieren</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Organisation</CardTitle>
          </CardHeader>
          <CardContent>
            <form
              action={updateOrganizationAction}
              className="grid gap-4 sm:grid-cols-2"
            >
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  name="name"
                  required
                  defaultValue={organization?.name ?? viewer.organizationName}
                  disabled={!canManageOrganization}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="street">Straße</Label>
                <Input
                  id="street"
                  name="street"
                  defaultValue={organization?.street ?? ""}
                  disabled={!canManageOrganization}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="houseNumber">Hausnummer</Label>
                <Input
                  id="houseNumber"
                  name="houseNumber"
                  defaultValue={organization?.house_number ?? ""}
                  disabled={!canManageOrganization}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="postalCode">Postleitzahl</Label>
                <Input
                  id="postalCode"
                  name="postalCode"
                  defaultValue={organization?.postal_code ?? ""}
                  disabled={!canManageOrganization}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="city">Ort</Label>
                <Input
                  id="city"
                  name="city"
                  defaultValue={organization?.city ?? ""}
                  disabled={!canManageOrganization}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="retentionDays">Aufbewahrung in Tagen</Label>
                <Input
                  id="retentionDays"
                  name="retentionDays"
                  type="number"
                  min={0}
                  max={3650}
                  defaultValue={organization?.retention_days ?? ""}
                  disabled={!canManageOrganization}
                />
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={!canManageOrganization}>
                  Organisation speichern
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <ShieldCheck className="size-4 text-primary" />
              Datenschutz & Export
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Exporte enthalten ausschließlich Daten deiner aktiven
              Organisation und werden nicht zwischengespeichert.
            </p>
            <Button asChild variant="outline">
              <a href="/api/exports/csv?resource=properties">
                <Download />
                Immobilien exportieren
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
