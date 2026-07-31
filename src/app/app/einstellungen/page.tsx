import Link from "next/link";
import {
  Archive,
  Building2,
  CheckCircle2,
  CircleAlert,
  DatabaseBackup,
  Download,
  FileArchive,
  FileText,
  KeyRound,
  LockKeyhole,
  MailCheck,
  Plug,
  ShieldCheck,
  Trash2,
  UserRoundX,
} from "lucide-react";
import {
  cancelAccountDeletionAction,
  cancelOrganizationDeletionAction,
  requestAccountDeletionAction,
  requestOrganizationDeletionAction,
  updateConsentPreferencesAction,
  updateOrganizationAction,
  updatePasswordAction,
  updateProfileAction,
  updateRetentionPolicyAction,
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
import { requireOrganization } from "@/lib/auth/dal";
import {
  canRequestOrganizationDeletion,
  hasPermission,
} from "@/lib/auth/permissions";
import {
  readAccountDeletionRequest,
  readConsentPreferences,
} from "@/lib/settings/privacy";
import { createClient } from "@/lib/supabase/server";

const savedMessages: Record<string, string> = {
  profile: "Dein Profil wurde gespeichert.",
  password: "Dein Passwort wurde aktualisiert.",
  organization: "Die Organisationsdaten wurden gespeichert.",
  retention: "Die Aufbewahrungsrichtlinie wurde gespeichert.",
  consents: "Deine freiwilligen Einwilligungen wurden gespeichert.",
  "account-deletion":
    "Deine persönliche Vorbereitung zur Kontolöschung wurde gespeichert. Sie ist noch keine administrativ eingereichte Löschanfrage.",
  "account-deletion-cancelled":
    "Die persönliche Löschvorbereitung wurde verworfen.",
  "organization-deletion":
    "Die Organisationslöschung wurde zur Prüfung vorgemerkt. Es wurden noch keine Daten gelöscht.",
  "organization-deletion-cancelled":
    "Die Organisationslöschanfrage wurde zurückgenommen.",
};

const errorMessages: Record<string, string> = {
  profile: "Das Profil konnte nicht gespeichert werden.",
  password:
    "Das Passwort konnte nicht geändert werden. Prüfe dein aktuelles Passwort und die neuen Angaben.",
  organization:
    "Die Organisationsdaten konnten nicht gespeichert werden.",
  retention:
    "Die Aufbewahrungsrichtlinie konnte nicht gespeichert werden. Zulässig sind 0, 30 bis 3.650 Tage oder ein leeres Feld.",
  consents: "Die Einwilligungen konnten nicht gespeichert werden.",
  "account-deletion":
    "Die Löschanfrage konnte nicht vorgemerkt werden. Prüfe die Bestätigung und versuche es erneut.",
  "organization-deletion":
    "Die Organisationslöschanfrage konnte nicht geändert werden. Prüfe bei einer neuen Anfrage Name und Bestätigung, lade den aktuellen Status neu und versuche es erneut.",
  permission:
    "Deine aktuelle Rolle darf diese Organisationseinstellung nicht ändern.",
};

const exportResources = [
  { resource: "properties", label: "Immobilien" },
  { resource: "units", label: "Einheiten" },
  { resource: "leases", label: "Mietverhältnisse" },
  { resource: "income", label: "Einnahmen" },
  { resource: "expenses", label: "Ausgaben" },
  { resource: "documents", label: "Dokument-Metadaten" },
  { resource: "tasks", label: "Aufgaben" },
] as const;

const integrationCatalog = [
  {
    key: "open-banking",
    label: "Open Banking",
    description: "Konten und Transaktionen über einen Bankprovider.",
    aliases: ["bank", "banking", "openbanking"],
  },
  {
    key: "ocr",
    label: "Dokumentenerkennung",
    description: "Beleg- und Dokumentdaten automatisiert auslesen.",
    aliases: ["ocr", "documentrecognition", "documentextraction"],
  },
  {
    key: "market-data",
    label: "Marktdaten",
    description: "Vergleichsmieten und Bewertungsdaten beziehen.",
    aliases: ["market", "marketdata", "immobilienscout24"],
  },
  {
    key: "email",
    label: "E-Mail-Versand",
    description: "Einladungen und Benachrichtigungen zustellen.",
    aliases: ["email", "mail", "resend"],
  },
  {
    key: "geocoding",
    label: "Geocoding",
    description: "Adressen für Karten- und Standortdaten auflösen.",
    aliases: ["geocoding", "geocode", "maps"],
  },
] as const;

const dateTimeFormatter = new Intl.DateTimeFormat("de-DE", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Europe/Berlin",
});

function normalizeIntegrationType(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function formatDateTime(value: string | null) {
  if (!value) return "Kein Zeitpunkt hinterlegt";
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) return "Zeitpunkt nicht verfügbar";
  return dateTimeFormatter.format(date);
}

function integrationStatusLabel(status: string | undefined) {
  switch (status) {
    case "active":
      return "Verbunden";
    case "pending":
      return "Einrichtung offen";
    case "reauthorization_required":
      return "Erneute Freigabe nötig";
    case "error":
      return "Fehler";
    case "revoked":
      return "Widerrufen";
    default:
      return "Nicht verbunden";
  }
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    error?: string;
  }>;
}) {
  const viewer = await requireOrganization();
  const canManageOrganization = hasPermission(
    viewer.role,
    "organization.manage",
  );
  const canExport = hasPermission(viewer.role, "reports.export");
  const canManageIntegrations = hasPermission(
    viewer.role,
    "integrations.manage",
  );
  const canRequestOrganizationRemoval =
    canRequestOrganizationDeletion(viewer.role);
  const supabase = await createClient();

  const [
    profileResult,
    organizationResult,
    userResult,
    integrationsResult,
    organizationDeletionResult,
  ] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, phone, email")
      .eq("id", viewer.userId)
      .maybeSingle(),
    supabase
      .from("organizations")
      .select(
        "name, kind, street, house_number, postal_code, city, default_currency, retention_days, archived_at",
      )
      .eq("id", viewer.organizationId)
      .maybeSingle(),
    supabase.auth.getUser(),
    canManageIntegrations
      ? supabase
          .from("integration_connections")
          .select(
            "id, integration_type, provider, mode, status, connected_at, last_synced_at, expires_at",
          )
          .eq("organization_id", viewer.organizationId)
          .order("integration_type")
      : Promise.resolve({ data: [], error: null }),
    canRequestOrganizationRemoval
      ? supabase
          .from("organization_deletion_requests")
          .select("id, status, requested_at, cancelled_at")
          .eq("organization_id", viewer.organizationId)
          .eq("status", "requested")
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const params = await searchParams;
  const profile = profileResult.data;
  const organization = organizationResult.data;
  const userMetadata = userResult.data.user?.user_metadata;
  const consentPreferences = readConsentPreferences(userMetadata);
  const accountDeletionRequest =
    readAccountDeletionRequest(userMetadata);
  const organizationDeletionRequest =
    organizationDeletionResult.data;
  const integrations = integrationsResult.data ?? [];
  const profileReady = !profileResult.error && Boolean(profile);
  const organizationReady =
    !organizationResult.error && Boolean(organization);
  const personalSettingsReady =
    !userResult.error && Boolean(userResult.data.user);
  const integrationsReady = !integrationsResult.error;
  const organizationDeletionReady =
    !organizationDeletionResult.error;
  const canEditPersonalSettings =
    profileReady && personalSettingsReady;
  const canEditOrganization =
    canManageOrganization && organizationReady;
  const dataLoadFailed = Boolean(
    !profileReady ||
      !organizationReady ||
      !personalSettingsReady ||
      !integrationsReady ||
      !organizationDeletionReady,
  );
  const successMessage = params.saved
    ? savedMessages[params.saved]
    : undefined;
  const errorMessage = params.error
    ? errorMessages[params.error]
    : undefined;
  const currentYear = new Date().getFullYear();

  return (
    <>
      <PageHeader
        eyebrow="Organisation & Datenschutz"
        title="Einstellungen"
        description="Profil, Sicherheit, Datenschutz, Aufbewahrung, Exporte und Löschanfragen zentral verwalten."
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
      {dataLoadFailed ? (
        <Alert variant="destructive" className="mb-5">
          <CircleAlert />
          <AlertDescription>
            Einzelne Einstellungsstände konnten nicht vollständig geladen
            werden. Betroffene Formulare bleiben gesperrt, damit keine
            bestehenden Werte mit leeren Ersatzdaten überschrieben werden.
          </AlertDescription>
        </Alert>
      ) : null}

      <nav
        aria-label="Einstellungsbereiche"
        className="mb-5 flex flex-wrap gap-2 rounded-xl border bg-card p-3"
      >
        {[
          ["profil", "Profil & Sicherheit"],
          ["organisation", "Organisation"],
          ["datenschutz", "Datenschutz"],
          ["datenexport", "Datenexport"],
          ["aufbewahrung", "Aufbewahrung"],
          ["einwilligungen", "Einwilligungen"],
          ["integrationen", "Integrationen"],
          ["konto-loeschen", "Kontolöschung"],
          ["organisation-loeschen", "Organisation löschen"],
        ].map(([id, label]) => (
          <Button key={id} asChild variant="outline" size="sm">
            <a href={`#${id}`}>{label}</a>
          </Button>
        ))}
      </nav>

      <section
        id="profil"
        aria-labelledby="profil-heading"
        className="scroll-mt-24"
      >
        <h2 id="profil-heading" className="sr-only">
          Profil und Sicherheit
        </h2>
        <div className="grid gap-5 xl:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-primary" />
                Persönliches Profil
              </CardTitle>
              <CardDescription>
                Nur die für Zusammenarbeit und Kontakt nötigen Angaben.
              </CardDescription>
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
                    disabled={!canEditPersonalSettings}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="phone">Telefon</Label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    autoComplete="tel"
                    defaultValue={profile?.phone ?? ""}
                    disabled={!canEditPersonalSettings}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-fit"
                  disabled={!canEditPersonalSettings}
                >
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
                  <Label htmlFor="currentPassword">
                    Aktuelles Passwort
                  </Label>
                  <Input
                    id="currentPassword"
                    name="currentPassword"
                    type="password"
                    autoComplete="current-password"
                    required
                    disabled={!personalSettingsReady}
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
                    disabled={!personalSettingsReady}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="passwordConfirmation">
                    Passwort wiederholen
                  </Label>
                  <Input
                    id="passwordConfirmation"
                    name="passwordConfirmation"
                    type="password"
                    autoComplete="new-password"
                    minLength={12}
                    required
                    disabled={!personalSettingsReady}
                  />
                </div>
                <Button
                  type="submit"
                  className="w-fit"
                  disabled={!personalSettingsReady}
                >
                  Passwort aktualisieren
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card
        id="organisation"
        className="mt-5 scroll-mt-24"
      >
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="size-4 text-primary" />
            Organisation
          </CardTitle>
          <CardDescription>
            Eigentümer und Administratoren verwalten hier die Stammdaten.
          </CardDescription>
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
                defaultValue={
                  organization?.name ?? viewer.organizationName
                }
                disabled={!canEditOrganization}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="street">Straße</Label>
              <Input
                id="street"
                name="street"
                autoComplete="street-address"
                defaultValue={organization?.street ?? ""}
                disabled={!canEditOrganization}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="houseNumber">Hausnummer</Label>
              <Input
                id="houseNumber"
                name="houseNumber"
                defaultValue={organization?.house_number ?? ""}
                disabled={!canEditOrganization}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="postalCode">Postleitzahl</Label>
              <Input
                id="postalCode"
                name="postalCode"
                autoComplete="postal-code"
                defaultValue={organization?.postal_code ?? ""}
                disabled={!canEditOrganization}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="city">Ort</Label>
              <Input
                id="city"
                name="city"
                autoComplete="address-level2"
                defaultValue={organization?.city ?? ""}
                disabled={!canEditOrganization}
              />
            </div>
            <div className="flex items-end sm:col-span-2">
              <Button type="submit" disabled={!canEditOrganization}>
                Organisation speichern
              </Button>
            </div>
          </form>
          {!canManageOrganization ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Deine Rolle darf Organisationsstammdaten lesen, aber nicht
              ändern.
            </p>
          ) : !organizationReady ? (
            <p className="mt-4 text-sm text-destructive">
              Die Organisationsdaten sind nicht vollständig geladen. Das
              Formular bleibt bis zum erneuten Laden gesperrt.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card id="datenschutz" className="scroll-mt-24">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-primary" />
              Datenschutz
            </CardTitle>
            <CardDescription>
              Technische Schutzmaßnahmen und transparente Verarbeitung.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="grid gap-3 text-sm">
              {[
                "Datenzugriffe sind auf die aktive Organisation und Rolle begrenzt.",
                "Dokumente liegen in privaten Storage-Buckets und werden nur über geprüfte Zugriffe ausgeliefert.",
                "Administrative Organisationsänderungen werden im unveränderbaren Audit-Protokoll erfasst.",
                "Formularwerte werden serverseitig validiert; Zugangsdaten erscheinen weder in der Oberfläche noch in Exporten.",
              ].map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2
                    className="mt-0.5 size-4 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Button asChild variant="outline">
              <Link href="/datenschutz">
                <FileText />
                Datenschutzhinweise öffnen
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card id="datenexport" className="scroll-mt-24">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DatabaseBackup className="size-4 text-primary" />
              Datenexport
            </CardTitle>
            <CardDescription>
              Organisationsgebundene Daten als CSV oder Jahresbericht
              herunterladen.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {canExport ? (
              <>
                <div className="flex flex-wrap gap-2">
                  {exportResources.map((item) => (
                    <Button
                      key={item.resource}
                      asChild
                      variant="outline"
                      size="sm"
                    >
                      <a
                        href={`/api/exports/csv?resource=${item.resource}`}
                      >
                        <Download />
                        {item.label}
                      </a>
                    </Button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-2 border-t pt-4">
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={`/api/exports/csv?resource=annual&year=${currentYear}`}
                    >
                      <FileArchive />
                      Jahresdaten {currentYear} · CSV
                    </a>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <a href={`/api/exports/pdf?year=${currentYear}`}>
                      <FileText />
                      Jahresbericht {currentYear} · PDF
                    </a>
                  </Button>
                  <Button asChild size="sm">
                    <Link href="/app/berichte">
                      Berichte mit Filtern öffnen
                    </Link>
                  </Button>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  CSV-Exporte enthalten strukturierte Datensätze. Der
                  Dokumentexport enthält Metadaten, nicht die gespeicherten
                  Originaldateien. Dateien werden für den Abruf erzeugt und
                  nicht als öffentlicher Download zwischengespeichert.
                </p>
              </>
            ) : (
              <Alert>
                <LockKeyhole />
                <AlertTitle>Export rollenbedingt gesperrt</AlertTitle>
                <AlertDescription>
                  Eigentümer, Administration, Immobilienmanagement und
                  Buchhaltung können die für ihre Rolle freigegebenen
                  Organisationsdaten exportieren.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      <Card id="aufbewahrung" className="mt-5 scroll-mt-24">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Archive className="size-4 text-primary" />
            Aufbewahrungsfristen & Archivierungsstatus
          </CardTitle>
          <CardDescription>
            Interne Zielvorgabe dokumentieren, ohne gesetzlich benötigte Daten
            automatisch zu entfernen.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)]">
          <form
            action={updateRetentionPolicyAction}
            className="grid content-start gap-3"
          >
            <Label htmlFor="retentionDays">
              Aufbewahrungsziel nach fachlicher Freigabe
            </Label>
            <div className="flex max-w-md flex-col gap-3 sm:flex-row">
              <Input
                id="retentionDays"
                name="retentionDays"
                type="number"
                inputMode="numeric"
                min={0}
                max={3650}
                placeholder="Nicht festgelegt"
                defaultValue={organization?.retention_days ?? ""}
                disabled={!canEditOrganization}
                aria-describedby="retention-description"
              />
              <Button
                type="submit"
                disabled={!canEditOrganization}
                className="sm:w-fit"
              >
                Richtlinie speichern
              </Button>
            </div>
            <p
              id="retention-description"
              className="max-w-3xl text-xs leading-5 text-muted-foreground"
            >
              0 steht für ausschließlich manuelle Prüfung, alternativ sind 30
              bis 3.650 Tage zulässig. Ein leeres Feld bedeutet, dass noch kein
              internes Löschziel festgelegt ist. Die Einstellung startet keine
              automatische Löschung; handels- und steuerrechtliche Pflichten
              sowie laufende Verträge müssen vor jeder Bereinigung geprüft
              werden.
            </p>
          </form>
          <div className="grid gap-3 rounded-xl border bg-muted/35 p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                Organisation
              </span>
              <Badge variant="outline">
                {organization?.archived_at ? "Archiviert" : "Aktiv"}
              </Badge>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                Aufbewahrungsziel
              </span>
              <span className="text-sm font-medium">
                {organization?.retention_days === 0
                  ? "Nur manuelle Prüfung"
                  : organization?.retention_days
                    ? `${organization.retention_days} Tage`
                    : "Nicht festgelegt"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-muted-foreground">
                Automatische Löschung
              </span>
              <Badge variant="secondary">Nicht aktiv</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card id="einwilligungen" className="scroll-mt-24">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MailCheck className="size-4 text-primary" />
              Einwilligungen
            </CardTitle>
            <CardDescription>
              Freiwillige Verarbeitungen einsehen und jederzeit widerrufen.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!personalSettingsReady ? (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>Einwilligungen nicht geladen</AlertTitle>
                <AlertDescription>
                  Der Kontostatus konnte nicht verlässlich gelesen werden.
                  Änderungen bleiben bis zum erneuten Laden gesperrt.
                </AlertDescription>
              </Alert>
            ) : (
              <form
                action={updateConsentPreferencesAction}
                className="space-y-4"
              >
              <div className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">Erforderliche Verarbeitung</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      Anmeldung, Organisationszugriff, Sicherheit und
                      angeforderte Produktfunktionen. Dies ist keine
                      freiwillige Einwilligung.
                    </p>
                  </div>
                  <Badge variant="secondary">Erforderlich</Badge>
                </div>
              </div>
              <label className="flex cursor-pointer items-start gap-3 rounded-xl border p-4">
                <input
                  type="checkbox"
                  name="productUpdates"
                  value="accepted"
                  defaultChecked={consentPreferences.productUpdates}
                  className="mt-1 size-4 shrink-0 accent-primary"
                />
                <span>
                  <span className="block font-medium">
                    Produktneuigkeiten per E-Mail
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-muted-foreground">
                    Freiwillig. Der Wunsch wird gespeichert; Versand erfolgt
                    nur, wenn ein E-Mail-Anbieter konfiguriert ist. Ein
                    Abwählen widerruft die Einwilligung für künftige
                    Nachrichten.
                  </span>
                </span>
              </label>
              <div className="rounded-xl border p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">Nutzungsanalyse</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">
                      In dieser Version ist kein optionaler Analytics-Tracker
                      aktiviert; deshalb wird hierfür keine vorsorgliche
                      Einwilligung eingeholt.
                    </p>
                  </div>
                  <Badge variant="outline">Nicht eingesetzt</Badge>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit">Einwilligungen speichern</Button>
                <span className="text-xs text-muted-foreground">
                  Letzte Änderung:{" "}
                  {formatDateTime(consentPreferences.updatedAt)}
                </span>
              </div>
              </form>
            )}
          </CardContent>
        </Card>

        <Card id="integrationen" className="scroll-mt-24">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Plug className="size-4 text-primary" />
              Integrationen
            </CardTitle>
            <CardDescription>
              Verbindungsstatus ohne Anzeige von Zugangsdaten oder Secrets.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {canManageIntegrations ? (
              integrationsReady ? (
                <>
                {integrationCatalog.map((item) => {
                  const connection = integrations.find((candidate) => {
                    const normalized = normalizeIntegrationType(
                      candidate.integration_type,
                    );
                    return item.aliases.some((alias) =>
                      normalized.includes(alias),
                    );
                  });
                  const status =
                    connection?.mode === "demo"
                      ? "Demo-Modus"
                      : integrationStatusLabel(connection?.status);

                  return (
                    <div
                      key={item.key}
                      className="flex items-start justify-between gap-4 rounded-xl border p-3"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{item.label}</p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          {connection
                            ? `${connection.provider} · ${
                                connection.mode === "provider"
                                  ? "Provider-Modus"
                                  : "Demo-Modus"
                              } · Letzte Synchronisierung: ${formatDateTime(
                                connection.last_synced_at,
                              )}`
                            : item.description}
                        </p>
                      </div>
                      <Badge
                        variant={
                          connection?.status === "active"
                            ? "default"
                            : connection?.status === "error"
                              ? "destructive"
                              : "outline"
                        }
                      >
                        {status}
                      </Badge>
                    </div>
                  );
                })}
                <Button asChild variant="outline">
                  <Link href="/app/integrationen">
                    <Plug />
                    Integrationsdetails öffnen
                  </Link>
                </Button>
                <p className="text-xs leading-5 text-muted-foreground">
                  Nicht verbundene Anbieter bleiben im manuellen oder klar
                  gekennzeichneten Demo-Modus. Provider-Zugangsdaten werden
                  nicht in dieser Oberfläche gespeichert.
                </p>
                </>
              ) : (
                <Alert variant="destructive">
                  <CircleAlert />
                  <AlertTitle>Integrationsstatus nicht verfügbar</AlertTitle>
                  <AlertDescription>
                    Verbindungen konnten nicht vollständig geladen werden und
                    werden deshalb nicht als „nicht verbunden“ dargestellt.
                  </AlertDescription>
                </Alert>
              )
            ) : (
              <Alert>
                <LockKeyhole />
                <AlertTitle>Nur für Eigentümer und Administration</AlertTitle>
                <AlertDescription>
                  Verbindungsstatus und Provider-Konfiguration sind auf Rollen
                  mit Organisations- und Integrationsverwaltung begrenzt.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Card
          id="konto-loeschen"
          className="scroll-mt-24 border border-destructive/30"
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <UserRoundX className="size-4" />
              Kontolöschung vorbereiten
            </CardTitle>
            <CardDescription>
              Persönlichen Entwurf speichern, bevor ein administrativer
              Löschprozess eingerichtet oder beauftragt wird.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!personalSettingsReady ? (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>Kontostatus nicht verfügbar</AlertTitle>
                <AlertDescription>
                  Eine Löschvorbereitung kann erst gespeichert werden, wenn der
                  persönliche Kontostatus vollständig geladen wurde.
                </AlertDescription>
              </Alert>
            ) : accountDeletionRequest.status === "requested" ? (
              <>
                <Alert>
                  <CircleAlert />
                  <AlertTitle>Persönlicher Löschentwurf gespeichert</AlertTitle>
                  <AlertDescription>
                    Gespeichert am{" "}
                    {formatDateTime(
                      accountDeletionRequest.requestedAt,
                    )}
                    . Dieser selbst verwaltete Kontostatus sendet noch keine
                    Anfrage an eine Support- oder Administrationsstelle und ist
                    kein Audit-Nachweis. Dein Konto bleibt vollständig aktiv;
                    es wurden keine Daten gelöscht.
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
                      Du bist Eigentümer der aktiven Organisation. Vor einer
                      Kontolöschung muss die Eigentümerschaft übertragen oder
                      die Organisation separat zur Löschung vorgemerkt werden.
                    </AlertDescription>
                  </Alert>
                ) : null}
                <div className="grid gap-2">
                  <Label htmlFor="accountDeletionReason">
                    Grund (optional)
                  </Label>
                  <Textarea
                    id="accountDeletionReason"
                    name="reason"
                    maxLength={1000}
                    placeholder="Optionaler Hinweis für die Prüfung"
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
                    Ich verstehe, dass dies nur einen persönlichen Entwurf in
                    meinem Kontoprofil speichert, keine Stelle benachrichtigt
                    und noch keine Daten löscht.
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

        <Card
          id="organisation-loeschen"
          className="scroll-mt-24 border border-destructive/30"
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-4" />
              Organisation löschen
            </CardTitle>
            <CardDescription>
              Eigentümer-only Vorbereitung mit Audit-Eintrag und interner
              Prüfaufgabe – keine technische Löschfreigabe.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!organizationReady || !organizationDeletionReady ? (
              <Alert variant="destructive">
                <CircleAlert />
                <AlertTitle>Organisation nicht vollständig geladen</AlertTitle>
                <AlertDescription>
                  Die Löschvorbereitung bleibt gesperrt, bis Name,
                  Eigentümerschaft und aktueller Status verlässlich geladen
                  wurden.
                </AlertDescription>
              </Alert>
            ) : !canRequestOrganizationRemoval ? (
              <Alert>
                <LockKeyhole />
                <AlertTitle>Nur die Eigentümerrolle</AlertTitle>
                <AlertDescription>
                  Administratoren und weitere Rollen dürfen eine Organisation
                  nicht zur Löschung vormerken. Bitte wende dich an die
                  Eigentümerin oder den Eigentümer.
                </AlertDescription>
              </Alert>
            ) : organizationDeletionRequest?.status === "requested" ? (
              <>
                <Alert>
                  <CircleAlert />
                  <AlertTitle>Organisationslöschung wird geprüft</AlertTitle>
                  <AlertDescription>
                    Vorgemerkt am{" "}
                    {formatDateTime(
                      organizationDeletionRequest.requested_at,
                    )}
                    . Die Owner-only Anfrage und ihre interne Prüfaufgabe
                    wurden atomar gespeichert und die administrative Änderung
                    wird protokolliert. Browser und öffentliche Data API haben
                    keine Berechtigung, eine Organisation hart zu löschen.
                    Eine spätere physische Löschung erfordert einen separaten,
                    privilegierten Prozess mit erneuter Authentifizierung,
                    Aufbewahrungsprüfung und Storage-Bereinigung. Es wurden
                    keine Daten gelöscht.
                  </AlertDescription>
                </Alert>
                <form action={cancelOrganizationDeletionAction}>
                  <input
                    type="hidden"
                    name="requestId"
                    value={organizationDeletionRequest.id}
                  />
                  <Button type="submit" variant="outline">
                    Organisationslöschanfrage zurücknehmen
                  </Button>
                </form>
              </>
            ) : (
              <form
                action={requestOrganizationDeletionAction}
                className="grid gap-4"
              >
                <Alert>
                  <FileArchive />
                  <AlertDescription>
                    Erstelle zuerst die benötigten Datenexporte. Die spätere
                    Löschung betrifft Mitglieder, Immobilien, Finanzen,
                    Dokumente und Integrationsverbindungen und kann nach
                    Durchführung nicht über diese Oberfläche rückgängig
                    gemacht werden.
                  </AlertDescription>
                </Alert>
                <div className="grid gap-2">
                  <Label htmlFor="organizationDeletionName">
                    Organisationsname zur Bestätigung
                  </Label>
                  <Input
                    id="organizationDeletionName"
                    name="organizationName"
                    autoComplete="off"
                    placeholder={organization?.name ?? "Organisationsname"}
                    required
                    aria-describedby="organization-deletion-description"
                  />
                  <p
                    id="organization-deletion-description"
                    className="text-xs text-muted-foreground"
                  >
                    Gib den Namen exakt ein:{" "}
                    <span className="font-medium text-foreground">
                      {organization?.name ?? viewer.organizationName}
                    </span>
                  </p>
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
                    Ich bestätige, dass dies nur eine operative
                    Prüfungsvorbereitung ist, keine technische
                    Löschberechtigung erteilt und noch keine Daten löscht.
                  </span>
                </label>
                <Button
                  type="submit"
                  variant="destructive"
                  className="w-fit"
                >
                  <Trash2 />
                  Organisationslöschung vormerken
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
