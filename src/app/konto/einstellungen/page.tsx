import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  CircleAlert,
  FileArchive,
  FileText,
  KeyRound,
  LockKeyhole,
  MailCheck,
  ShieldCheck,
  UserRoundX,
} from "lucide-react";
import {
  cancelAccountDeletionAction,
  requestAccountDeletionAction,
  updateConsentPreferencesAction,
  updatePasswordAction,
  updateProfileAction,
} from "@/app/app/einstellungen/actions";
import { PageHeader } from "@/components/app/page-header";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireViewer } from "@/lib/auth/dal";
import {
  readAccountDeletionRequest,
  readConsentPreferences,
} from "@/lib/settings/privacy";
import { createClient } from "@/lib/supabase/server";

const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});

const savedMessages: Record<string, string> = {
  profile: "Dein Profil wurde gespeichert.",
  password: "Dein Passwort wurde aktualisiert.",
  consents: "Deine freiwilligen Einwilligungen wurden gespeichert.",
  "account-deletion":
    "Deine persönliche Vorbereitung zur Kontolöschung wurde gespeichert. Sie ist noch keine administrativ eingereichte Löschanfrage.",
  "account-deletion-cancelled":
    "Die persönliche Löschvorbereitung wurde verworfen.",
};

const errorMessages: Record<string, string> = {
  profile: "Das Profil konnte nicht gespeichert werden.",
  password:
    "Das Passwort konnte nicht geändert werden. Prüfe dein aktuelles Passwort und die neuen Angaben.",
  consents: "Die Einwilligungen konnten nicht gespeichert werden.",
  "account-deletion":
    "Die Löschvorbereitung konnte nicht gespeichert werden. Prüfe die Bestätigung und versuche es erneut.",
};

function formatDateTime(value: string | null) {
  if (!value) return "Kein Zeitpunkt hinterlegt";
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? "Zeitpunkt nicht verfügbar"
    : dateTimeFormatter.format(date);
}

export default async function PersonalSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const [profileResult, userResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, phone, email")
      .eq("id", viewer.userId)
      .maybeSingle(),
    supabase.auth.getUser(),
  ]);
  const params = await searchParams;
  const profile = profileResult.data;
  const user = userResult.data.user;
  const ready = !profileResult.error && Boolean(profile) && !userResult.error && Boolean(user);
  const consentPreferences = readConsentPreferences(user?.user_metadata);
  const accountDeletionRequest = readAccountDeletionRequest(
    user?.user_metadata,
  );
  const backHref =
    viewer.role === "tenant"
      ? "/portal"
      : viewer.organizationId
        ? "/app"
        : "/onboarding";
  const successMessage = params.saved
    ? savedMessages[params.saved]
    : undefined;
  const errorMessage = params.error
    ? errorMessages[params.error]
    : undefined;

  return (
    <main className="mx-auto min-h-dvh w-full max-w-5xl px-4 py-8 sm:px-6">
      <div className="mb-5">
        <Button asChild variant="outline" size="sm">
          <Link href={backHref}>
            <ArrowLeft />
            Zurück
          </Link>
        </Button>
      </div>
      <PageHeader
        eyebrow="Persönlicher Kontobereich"
        title="Profil & Datenschutz"
        description="Persönliche Angaben, Passwort, Einwilligungen und die Vorbereitung einer Kontolöschung verwalten."
      />

      {successMessage ? (
        <Alert className="mb-5">
          <CheckCircle2 />
          <AlertDescription>{successMessage}</AlertDescription>
        </Alert>
      ) : null}
      {errorMessage ? (
        <Alert variant="destructive" className="mb-5">
          <LockKeyhole />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}
      {!ready ? (
        <Alert variant="destructive" className="mb-5">
          <CircleAlert />
          <AlertTitle>Kontoeinstellungen nicht vollständig geladen</AlertTitle>
          <AlertDescription>
            Die Formulare bleiben gesperrt, damit keine bestehenden Werte mit
            leeren Ersatzdaten überschrieben werden. Bitte lade die Seite
            erneut.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              Persönliches Profil
            </CardTitle>
            <CardDescription>
              Nur die für Anmeldung, Zusammenarbeit und Kontakt nötigen
              Angaben.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updateProfileAction} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="personalEmail">E-Mail-Adresse</Label>
                <Input
                  id="personalEmail"
                  value={profile?.email ?? viewer.email ?? ""}
                  disabled
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="personalFullName">Name</Label>
                <Input
                  id="personalFullName"
                  name="fullName"
                  required
                  defaultValue={profile?.full_name ?? ""}
                  disabled={!ready}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="personalPhone">Telefon</Label>
                <Input
                  id="personalPhone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  defaultValue={profile?.phone ?? ""}
                  disabled={!ready}
                />
              </div>
              <Button type="submit" className="w-fit" disabled={!ready}>
                Profil speichern
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <KeyRound className="size-4 text-primary" />
              Passwort ändern
            </CardTitle>
            <CardDescription>
              Vor der Änderung wird dein aktuelles Passwort erneut geprüft.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={updatePasswordAction} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="personalCurrentPassword">
                  Aktuelles Passwort
                </Label>
                <Input
                  id="personalCurrentPassword"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                  disabled={!ready}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="personalPassword">Neues Passwort</Label>
                <Input
                  id="personalPassword"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  required
                  disabled={!ready}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="personalPasswordConfirmation">
                  Passwort wiederholen
                </Label>
                <Input
                  id="personalPasswordConfirmation"
                  name="passwordConfirmation"
                  type="password"
                  autoComplete="new-password"
                  minLength={12}
                  required
                  disabled={!ready}
                />
              </div>
              <Button type="submit" className="w-fit" disabled={!ready}>
                Passwort aktualisieren
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card id="einwilligungen" className="scroll-mt-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MailCheck className="size-4 text-primary" />
              Einwilligungen
            </CardTitle>
            <CardDescription>
              Freiwillige Verarbeitungen jederzeit ändern oder widerrufen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form
              action={updateConsentPreferencesAction}
              className="space-y-4"
            >
              <div className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">Erforderliche Verarbeitung</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Anmeldung, Sicherheit und angeforderte Produktfunktionen.
                      Dies ist keine freiwillige Einwilligung.
                    </p>
                  </div>
                  <Badge variant="secondary">Erforderlich</Badge>
                </div>
              </div>
              <label className="flex items-start gap-3 rounded-xl border p-4">
                <input
                  type="checkbox"
                  name="productUpdates"
                  value="accepted"
                  defaultChecked={consentPreferences.productUpdates}
                  disabled={!ready}
                  className="mt-1 size-4 shrink-0 accent-primary"
                />
                <span>
                  <span className="block font-medium">
                    Produktneuigkeiten per E-Mail
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    Freiwillig. Versand erfolgt nur mit konfiguriertem
                    E-Mail-Anbieter; Abwählen widerruft die Einwilligung für
                    künftige Nachrichten.
                  </span>
                </span>
              </label>
              <div className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">Nutzungsanalyse</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Kein optionaler Analytics-Tracker aktiv; daher wird keine
                      vorsorgliche Einwilligung eingeholt.
                    </p>
                  </div>
                  <Badge variant="outline">Nicht eingesetzt</Badge>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={!ready}>
                  Einwilligungen speichern
                </Button>
                <span className="text-xs text-muted-foreground">
                  Letzte Änderung:{" "}
                  {formatDateTime(consentPreferences.updatedAt)}
                </span>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileArchive className="size-4 text-primary" />
              Datenschutz & Vorbereitung
            </CardTitle>
            <CardDescription>
              Was vor einer administrativen Löschung erledigt werden muss.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ol className="grid gap-3 text-sm">
              <li className="flex gap-3">
                <Badge variant="outline">1</Badge>
                Benötigte Dokumente und freigegebene Daten herunterladen.
              </li>
              <li className="flex gap-3">
                <Badge variant="outline">2</Badge>
                Eigentümerschaft, Mitgliedschaften und laufende Vorgänge
                klären.
              </li>
              <li className="flex gap-3">
                <Badge variant="outline">3</Badge>
                Eine administrative Löschung erst nach Prüfung gesetzlicher
                Aufbewahrungspflichten ausführen lassen.
              </li>
            </ol>
            <Button asChild variant="outline">
              <Link href="/datenschutz">
                <FileText />
                Datenschutzhinweise öffnen
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card
        id="konto-loeschen"
        className="mt-5 scroll-mt-8 border border-destructive/30"
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <UserRoundX className="size-4" />
            Kontolöschung vorbereiten
          </CardTitle>
          <CardDescription>
            Ein selbst verwalteter Entwurf – keine eingereichte oder
            auditierte Löschanfrage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!ready ? (
            <Alert variant="destructive">
              <CircleAlert />
              <AlertDescription>
                Der Kontostatus ist nicht vollständig geladen. Die
                Löschvorbereitung bleibt gesperrt.
              </AlertDescription>
            </Alert>
          ) : accountDeletionRequest.status === "requested" ? (
            <>
              <Alert>
                <CircleAlert />
                <AlertTitle>Persönlicher Löschentwurf gespeichert</AlertTitle>
                <AlertDescription>
                  Gespeichert am{" "}
                  {formatDateTime(accountDeletionRequest.requestedAt)}. Dieser
                  Status benachrichtigt keine Support- oder
                  Administrationsstelle. Dein Konto bleibt aktiv und es wurden
                  keine Daten gelöscht.
                </AlertDescription>
              </Alert>
              <form action={cancelAccountDeletionAction}>
                <Button type="submit" variant="outline">
                  Löschvorbereitung verwerfen
                </Button>
              </form>
            </>
          ) : (
            <form
              action={requestAccountDeletionAction}
              className="grid gap-4"
            >
              {viewer.role === "owner" ? (
                <Alert>
                  <Building2 />
                  <AlertDescription>
                    Vor einer Kontolöschung muss die Eigentümerschaft
                    übertragen oder die Organisation separat geprüft werden.
                  </AlertDescription>
                </Alert>
              ) : null}
              <div className="grid gap-2">
                <Label htmlFor="personalDeletionReason">
                  Eigene Notiz (optional)
                </Label>
                <Textarea
                  id="personalDeletionReason"
                  name="reason"
                  maxLength={1000}
                  placeholder="Optionaler Hinweis für deine Vorbereitung"
                />
              </div>
              <label className="flex items-start gap-3 text-sm">
                <input
                  type="checkbox"
                  name="acknowledgement"
                  value="confirm"
                  required
                  className="mt-1 size-4 shrink-0 accent-destructive"
                />
                <span>
                  Ich verstehe, dass dies nur einen persönlichen Entwurf
                  speichert, keine Stelle benachrichtigt und keine Daten
                  löscht.
                </span>
              </label>
              <Button
                type="submit"
                variant="destructive"
                className="w-fit"
              >
                <UserRoundX />
                Löschvorbereitung speichern
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
