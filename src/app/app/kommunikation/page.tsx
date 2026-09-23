import { MessageActions } from "@/components/app/message-actions";
import { RecordActions } from "@/components/app/record-actions";
import {
  CheckCircle2,
  CircleAlert,
  LockKeyhole,
  MessageSquareText,
  Send,
} from "lucide-react";
import {
  createStaffConversationAction,
  replyStaffConversationAction,
} from "@/app/app/kommunikation/actions";
import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { requireOrganization } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { fetchAllRows } from "@/lib/supabase/pagination";
import { createClient } from "@/lib/supabase/server";

function tenantName(tenant: {
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
}) {
  return (
    tenant.company_name ||
    [tenant.first_name, tenant.last_name].filter(Boolean).join(" ") ||
    "Mieter"
  );
}

function messageDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

const resultMessages: Record<
  string,
  { title: string; description: string; error?: boolean }
> = {
  created: {
    title: "Unterhaltung eröffnet",
    description: "Die erste Nachricht ist im Mieterportal verfügbar.",
  },
  replied: {
    title: "Nachricht gespeichert",
    description: "Der Verlauf wurde aktualisiert.",
  },
  invalid: {
    title: "Eingaben prüfen",
    description: "Die Nachricht enthält ungültige oder fehlende Angaben.",
    error: true,
  },
  forbidden: {
    title: "Keine Berechtigung",
    description: "Deine Rolle darf keine Mieternachrichten verfassen.",
    error: true,
  },
  failed: {
    title: "Nachricht nicht gespeichert",
    description:
      "Die Datenbank hat den Vorgang vollständig abgebrochen. Bitte erneut versuchen.",
    error: true,
  },
};

export default async function CommunicationPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string | string[] }>;
}) {
  const viewer = await requireOrganization();
  const canWrite = hasPermission(viewer.role, "messages.write");

  if (!canWrite) {
    return (
      <>
        <PageHeader
          eyebrow="Vermieter & Mieter"
          title="Kommunikation"
          description="Nachrichten und Anliegen pro Mietverhältnis."
        />
        <Alert variant="destructive">
          <LockKeyhole />
          <AlertTitle>403 · Zugriff verweigert</AlertTitle>
          <AlertDescription>
            Deine aktuelle Rolle darf den Kommunikationsbereich nicht
            einsehen. Es wurden keine Unterhaltungen oder Nachrichten
            abgefragt.
          </AlertDescription>
        </Alert>
      </>
    );
  }

  const supabase = await createClient();
  const resultValue = (await searchParams).result;
  const result =
    typeof resultValue === "string" ? resultMessages[resultValue] : null;

  const [
    conversationsResult,
    leaseTenantsResult,
    leasesResult,
    unitsResult,
    propertiesResult,
    tenantsResult,
  ] = await Promise.all([
    supabase
      .from("conversations")
      .select(
        "id, lease_id, subject, category, priority, status, last_message_at, created_at, updated_at",
        { count: "exact" },
      )
      .eq("organization_id", viewer.organizationId)
      .eq("is_internal", false)
      .is("archived_at", null)
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .order("id")
      .limit(100),
    fetchAllRows(
      (from, to) =>
        supabase
          .from("lease_tenants")
          .select("lease_id, tenant_id, is_primary")
          .eq("organization_id", viewer.organizationId)
          .eq("is_primary", true)
          .order("id")
          .range(from, to),
      { label: "Mietzuordnungen" },
    ),
    fetchAllRows(
      (from, to) =>
        supabase
          .from("leases")
          .select("id, unit_id, lease_number, status, starts_on")
          .eq("organization_id", viewer.organizationId)
          .is("archived_at", null)
          .in("status", ["active", "notice_given"])
          .order("starts_on", { ascending: false })
          .order("id")
          .range(from, to),
      { label: "Mietverhältnisse" },
    ),
    fetchAllRows(
      (from, to) =>
        supabase
          .from("units")
          .select("id, property_id, unit_number")
          .eq("organization_id", viewer.organizationId)
          .is("archived_at", null)
          .order("id")
          .range(from, to),
      { label: "Einheiten" },
    ),
    fetchAllRows(
      (from, to) =>
        supabase
          .from("properties")
          .select("id, name")
          .eq("organization_id", viewer.organizationId)
          .is("archived_at", null)
          .order("id")
          .range(from, to),
      { label: "Immobilien" },
    ),
    fetchAllRows(
      (from, to) =>
        supabase
          .from("tenants")
          .select("id, first_name, last_name, company_name")
          .eq("organization_id", viewer.organizationId)
          .eq("status", "active")
          .is("archived_at", null)
          .order("id")
          .range(from, to),
      { label: "Mieter" },
    ),
  ]);

  const conversations = conversationsResult.data ?? [];
  const conversationIds = conversations.map((conversation) => conversation.id);
  const messagesResult = conversationIds.length
    ? await fetchAllRows(
        (from, to) =>
          supabase
            .from("messages")
            .select(
              "id, conversation_id, author_user_id, author_tenant_id, body, is_internal_note, sent_at, edited_at, updated_at",
            )
            .eq("organization_id", viewer.organizationId)
            .in("conversation_id", conversationIds)
            .is("deleted_at", null)
            .order("sent_at")
            .order("id")
            .range(from, to),
        { label: "Nachrichtenverläufe" },
      )
    : { data: [], error: null };
  const messages = messagesResult.data ?? [];
  const leaseTenants = leaseTenantsResult.data ?? [];
  const leases = leasesResult.data ?? [];
  const unitMap = new Map(
    (unitsResult.data ?? []).map((unit) => [unit.id, unit]),
  );
  const propertyMap = new Map(
    (propertiesResult.data ?? []).map((property) => [property.id, property]),
  );
  const tenantMap = new Map(
    (tenantsResult.data ?? []).map((tenant) => [tenant.id, tenant]),
  );
  const leaseTenantMap = new Map(
    leaseTenants.map((item) => [item.lease_id, item.tenant_id]),
  );
  const leaseMap = new Map(leases.map((lease) => [lease.id, lease]));
  const messagesByConversation = new Map<string, typeof messages>();
  for (const message of messages) {
    const current = messagesByConversation.get(message.conversation_id) ?? [];
    current.push(message);
    messagesByConversation.set(message.conversation_id, current);
  }
  const queryFailed = [
    conversationsResult,
    messagesResult,
    leaseTenantsResult,
    leasesResult,
    unitsResult,
    propertiesResult,
    tenantsResult,
  ].some((query) => query.error);
  const hiddenConversationCount = Math.max(
    0,
    (conversationsResult.count ?? conversations.length) -
      conversations.length,
  );

  const leaseOptions = leases.flatMap((lease) => {
    const tenant = tenantMap.get(leaseTenantMap.get(lease.id) ?? "");
    const unit = unitMap.get(lease.unit_id);
    const property = unit ? propertyMap.get(unit.property_id) : null;
    if (!tenant || !unit || !property) return [];
    return [
      {
        id: lease.id,
        label: `${tenantName(tenant)} · ${property.name} · ${unit.unit_number}`,
      },
    ];
  });

  return (
    <>
      <PageHeader
        eyebrow="Vermieter & Mieter"
        title="Kommunikation"
        description="Mietvertragsbezogene Nachrichten, Antworten und klar getrennte interne Notizen."
      />

      {result ? (
        <Alert
          className="mb-5"
          variant={result.error ? "destructive" : "default"}
        >
          {result.error ? <CircleAlert /> : <CheckCircle2 />}
          <AlertTitle>{result.title}</AlertTitle>
          <AlertDescription>{result.description}</AlertDescription>
        </Alert>
      ) : null}
      {queryFailed ? (
        <Alert variant="destructive" className="mb-5">
          <CircleAlert />
          <AlertTitle>Unterhaltungen unvollständig</AlertTitle>
          <AlertDescription>
            Mindestens ein Datenbereich konnte nicht geladen werden.
          </AlertDescription>
        </Alert>
      ) : null}
      {hiddenConversationCount > 0 ? (
        <Alert className="mb-5">
          <MessageSquareText />
          <AlertTitle>Neueste Unterhaltungen</AlertTitle>
          <AlertDescription>
            Angezeigt werden die 100 zuletzt aktiven Unterhaltungen mit ihrem
            vollständigen Nachrichtenverlauf. {hiddenConversationCount} ältere
            Unterhaltungen sind in dieser kompakten Ansicht ausgeblendet.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="space-y-5">
          {conversations.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center px-6 py-16 text-center">
                <MessageSquareText className="size-8 text-muted-foreground" />
                <h2 className="mt-4 font-semibold">Noch keine Unterhaltung</h2>
                <p className="mt-2 max-w-md text-sm text-muted-foreground">
                  Wähle rechts ein aktives Mietverhältnis und beginne einen
                  nachvollziehbaren Verlauf.
                </p>
              </CardContent>
            </Card>
          ) : (
            conversations.map((conversation) => {
              const thread = messagesByConversation.get(conversation.id) ?? [];
              const lease = conversation.lease_id
                ? leaseMap.get(conversation.lease_id)
                : null;
              const tenant = conversation.lease_id
                ? tenantMap.get(
                    leaseTenantMap.get(conversation.lease_id) ?? "",
                  )
                : null;
              return (
                <Card key={conversation.id}>
                  <CardHeader>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-base">
                          {conversation.subject}
                        </CardTitle>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {tenant ? tenantName(tenant) : "Mieter"} ·{" "}
                          {lease?.lease_number || "Mietverhältnis"}
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Badge variant="outline">{conversation.category}</Badge>
                        <Badge>{conversation.status}</Badge>
                        <RecordActions module="kommunikation" record={conversation}/>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="max-h-96 space-y-3 overflow-y-auto rounded-xl bg-muted/30 p-4">
                      {thread.map((message) => {
                        const fromTenant = Boolean(message.author_tenant_id);
                        return (
                          <div
                            key={message.id}
                            className={`rounded-lg border p-3 text-sm ${
                              message.is_internal_note
                                ? "border-amber-300 bg-amber-50 text-amber-950"
                                : fromTenant
                                  ? "mr-8 bg-background"
                                  : "ml-8 border-primary/20 bg-primary/5"
                            }`}
                          >
                            <div className="mb-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
                              <span>
                                {message.is_internal_note
                                  ? "Interne Notiz"
                                  : fromTenant
                                    ? "Mieter"
                                    : "Team"}
                              </span>
                              <span>{messageDate(message.sent_at)}</span>
                            </div>
                            <p className="whitespace-pre-wrap">{message.body}</p>
                            {message.edited_at ? <p className="mt-1 text-[10px] text-muted-foreground">Bearbeitet</p> : null}
                            {message.author_user_id === viewer.userId && !fromTenant ? <MessageActions message={message} /> : null}
                          </div>
                        );
                      })}
                    </div>
                    {canWrite ? (
                      <form
                        action={replyStaffConversationAction}
                        className="space-y-3"
                      >
                        <input
                          type="hidden"
                          name="conversationId"
                          value={conversation.id}
                        />
                        <Textarea
                          name="body"
                          minLength={1}
                          maxLength={20_000}
                          required
                          placeholder="Antwort verfassen …"
                        />
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <Label className="flex items-center gap-2 text-xs">
                            <input type="checkbox" name="internalNote" />
                            <LockKeyhole className="size-3.5" />
                            Nur als interne Notiz speichern
                          </Label>
                          <Button type="submit" size="sm">
                            <Send />
                            Speichern
                          </Button>
                        </div>
                      </form>
                    ) : null}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Neue Unterhaltung</CardTitle>
          </CardHeader>
          <CardContent>
            {canWrite && leaseOptions.length ? (
              <form
                action={createStaffConversationAction}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="leaseId">Mietverhältnis</Label>
                  <select
                    id="leaseId"
                    name="leaseId"
                    required
                    className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                  >
                    <option value="">Bitte auswählen</option>
                    {leaseOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="subject">Betreff</Label>
                  <Input
                    id="subject"
                    name="subject"
                    minLength={1}
                    maxLength={240}
                    required
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                  <div className="space-y-2">
                    <Label htmlFor="category">Kategorie</Label>
                    <select
                      id="category"
                      name="category"
                      defaultValue="general"
                      className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                    >
                      <option value="general">Allgemein</option>
                      <option value="repair">Reparatur</option>
                      <option value="damage">Schaden</option>
                      <option value="utilities">Nebenkosten</option>
                      <option value="payment">Zahlung</option>
                      <option value="document">Dokument</option>
                      <option value="termination">Kündigung</option>
                      <option value="handover">Übergabe</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priorität</Label>
                    <select
                      id="priority"
                      name="priority"
                      defaultValue="medium"
                      className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
                    >
                      <option value="low">Niedrig</option>
                      <option value="medium">Normal</option>
                      <option value="high">Hoch</option>
                      <option value="urgent">Dringend</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="body">Erste Nachricht</Label>
                  <Textarea
                    id="body"
                    name="body"
                    minLength={1}
                    maxLength={20_000}
                    rows={6}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">
                  <Send />
                  Unterhaltung eröffnen
                </Button>
              </form>
            ) : (
              <p className="text-sm leading-6 text-muted-foreground">
                {canWrite
                  ? "Lege zuerst ein aktives Mietverhältnis mit Hauptmieter an."
                  : "Deine Rolle besitzt keine Schreibberechtigung."}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
