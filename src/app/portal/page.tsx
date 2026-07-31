import { AlertCircle, Building2, FileText, MessageSquareText } from "lucide-react";
import { requireOrganization } from "@/lib/auth/dal";
import { fetchAllRows } from "@/lib/supabase/pagination";
import { createClient } from "@/lib/supabase/server";
import {
  createMaintenanceRequestAction,
  createTenantConversationAction,
  replyToConversationAction,
} from "@/app/portal/actions";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";

const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});

function cents(value: unknown) {
  return euro.format(Number(value ?? 0) / 100);
}

function dateInBerlin() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

function formattedDate(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00.000Z`));
}

function formattedMonth(value: string) {
  return new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value.slice(0, 10)}T00:00:00.000Z`));
}

const paymentStatusLabels: Record<string, string> = {
  open: "Offen",
  partial: "Teilweise bezahlt",
  paid: "Bezahlt",
  overpaid: "Überzahlt",
  cancelled: "Storniert",
};

export default async function TenantPortalPage() {
  const viewer = await requireOrganization();
  const supabase = await createClient();
  const [tenantUserResult, portalContextsResult] = await Promise.all([
    supabase
      .from("tenant_users")
      .select("tenant_id, tenants(first_name, last_name, company_name)")
      .eq("organization_id", viewer.organizationId)
      .eq("user_id", viewer.userId)
      .maybeSingle(),
    fetchAllRows(
      (from, to) =>
        supabase
          .rpc("get_tenant_portal_context", {
            p_organization_id: viewer.organizationId,
          })
          .order("lease_starts_on", { ascending: false })
          .order("lease_id")
          .range(from, to),
      { label: "Mietverhältnisse im Portal" },
    ),
  ]);
  const tenantUser = tenantUserResult.data;
  const portalContexts = portalContextsResult.data;

  if (tenantUserResult.error || portalContextsResult.error) {
    return (
      <Alert variant="destructive">
        <AlertCircle />
        <AlertTitle>Mieterportal unvollständig</AlertTitle>
        <AlertDescription>
          Die Mietverhältnisse konnten nicht vollständig geladen werden. Es
          werden keine gekürzten Ersatzdaten angezeigt.
        </AlertDescription>
      </Alert>
    );
  }

  if (!tenantUser || !portalContexts?.length) {
    return (
      <Alert>
        <AlertCircle />
        <AlertTitle>Mieterprofil wird vorbereitet</AlertTitle>
        <AlertDescription>
          Dein Konto ist angemeldet, aber noch keinem Mietverhältnis zugeordnet.
          Bitte wende dich an deine Verwaltung.
        </AlertDescription>
      </Alert>
    );
  }

  const leaseIds = [
    ...new Set(portalContexts.map((context) => context.lease_id)),
  ];
  const today = dateInBerlin();
  const currentContext =
    portalContexts.find(
      (context) =>
        ["active", "notice_given"].includes(context.lease_status) &&
        context.lease_starts_on <= today &&
        (!context.lease_ends_on || context.lease_ends_on >= today),
    ) ?? portalContexts[0];

  const [
    claimsResult,
    documentsResult,
    requestsResult,
    conversationsResult,
  ] = await Promise.all([
    fetchAllRows(
      (from, to) =>
        supabase
          .from("rent_claims")
          .select(
            "id, lease_id, claim_month, due_date, amount_cents, paid_cents, status",
          )
          .eq("organization_id", viewer.organizationId)
          .in("lease_id", leaseIds)
          .order("claim_month", { ascending: false })
          .order("id")
          .range(from, to),
      { label: "Mietforderungen" },
    ),
    fetchAllRows(
      (from, to) =>
        supabase
          .from("documents")
          .select(
            "id, lease_id, title, original_file_name, document_type, document_date, created_at",
          )
          .eq("organization_id", viewer.organizationId)
          .eq("tenant_visible", true)
          .in("lease_id", leaseIds)
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, to),
      { label: "Portal-Dokumente" },
    ),
    fetchAllRows(
      (from, to) =>
        supabase
          .from("maintenance_requests")
          .select(
            "id, title, description, category, priority, status, created_at",
          )
          .eq("organization_id", viewer.organizationId)
          .eq("tenant_id", tenantUser.tenant_id)
          .is("archived_at", null)
          .order("created_at", { ascending: false })
          .order("id")
          .range(from, to),
      { label: "Anliegen" },
    ),
    supabase
      .from("conversations")
      .select("id, lease_id, subject, status, last_message_at", {
        count: "exact",
      })
      .eq("organization_id", viewer.organizationId)
      .eq("is_internal", false)
      .in("lease_id", leaseIds)
      .is("archived_at", null)
      .order("last_message_at", {
        ascending: false,
        nullsFirst: false,
      })
      .order("id")
      .limit(100),
  ]);

  const claims = claimsResult.data ?? [];
  const recentClaims = claims.slice(0, 24);
  const documents = documentsResult.data ?? [];
  const requests = requestsResult.data ?? [];
  const conversations = conversationsResult.data ?? [];
  const conversationIds = (conversations ?? []).map((row) => row.id);
  const messagesResult = conversationIds.length
    ? await fetchAllRows(
        (from, to) =>
          supabase
            .from("messages")
            .select("id, conversation_id, body, author_tenant_id, sent_at")
            .eq("organization_id", viewer.organizationId)
            .in("conversation_id", conversationIds)
            .is("deleted_at", null)
            .order("sent_at", { ascending: true })
            .order("id")
            .range(from, to),
        { label: "Nachrichtenverläufe" },
      )
    : { data: [], error: null };
  const messages = messagesResult.data ?? [];
  const queryFailed = [
    claimsResult,
    documentsResult,
    requestsResult,
    conversationsResult,
    messagesResult,
  ].some((result) => result.error);
  const hiddenConversationCount = Math.max(
    0,
    (conversationsResult.count ?? conversations.length) -
      conversations.length,
  );

  const openAmountCents = (claims ?? []).reduce(
    (sum, claim) =>
      ["open", "partial"].includes(claim.status)
        ? sum +
          Math.max(
            0,
            Number(claim.amount_cents ?? 0) - Number(claim.paid_cents),
          )
        : sum,
    0,
  );
  const tenantRecord = Array.isArray(tenantUser.tenants)
    ? tenantUser.tenants[0]
    : tenantUser.tenants;
  const tenantName =
    tenantRecord?.company_name ||
    [tenantRecord?.first_name, tenantRecord?.last_name].filter(Boolean).join(" ") ||
    viewer.fullName ||
    "Mieter";

  return (
    <>
      <header className="mb-6">
        <p className="text-sm font-medium text-primary">Willkommen, {tenantName}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">
          Dein Mietverhältnis
        </h1>
        <p className="mt-2 text-muted-foreground">
          Zahlungen, freigegebene Dokumente und Anliegen an einem sicheren Ort.
        </p>
      </header>

      {queryFailed ? (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle />
          <AlertTitle>Portalansicht unvollständig</AlertTitle>
          <AlertDescription>
            Mindestens ein Datenbereich konnte nicht vollständig geladen
            werden. Betroffene Kennzahlen werden nicht aus gekürzten
            Teilergebnissen berechnet.
          </AlertDescription>
        </Alert>
      ) : null}
      {hiddenConversationCount > 0 ? (
        <Alert className="mb-6">
          <MessageSquareText />
          <AlertTitle>Neueste Unterhaltungen</AlertTitle>
          <AlertDescription>
            Angezeigt werden die 100 zuletzt aktiven Unterhaltungen mit ihrem
            vollständigen Verlauf. {hiddenConversationCount} ältere
            Unterhaltungen bleiben in dieser kompakten Ansicht ausgeblendet.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Monatliche Gesamtmiete</p>
            <p className="mt-2 text-2xl font-semibold">
              {cents(
                Number(currentContext.cold_rent_cents ?? 0) +
                  Number(currentContext.ancillary_prepayment_cents ?? 0) +
                  Number(currentContext.parking_rent_cents ?? 0) +
                  Number(currentContext.other_rent_cents ?? 0),
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Offener Betrag</p>
            <p className="mt-2 text-2xl font-semibold">{cents(openAmountCents)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Offene Anliegen</p>
            <p className="mt-2 text-2xl font-semibold">
              {(requests ?? []).filter(
                (request) =>
                  !["done", "completed", "closed", "cancelled"].includes(
                    request.status,
                  ),
              ).length}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-6">
        <CardContent className="flex items-start gap-3 p-5">
          <Building2 className="mt-0.5 size-5 text-primary" />
          <div>
            <p className="font-medium">
              {currentContext.property_name || "Mietobjekt"} ·{" "}
              {currentContext.unit_number || "Einheit"}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              {[
                currentContext.property_street,
                currentContext.property_house_number,
                currentContext.property_postal_code,
                currentContext.property_city,
              ]
                .filter(Boolean)
                .join(" ")}
            </p>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="payments">
        <TabsList className="max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="payments">Zahlungen</TabsTrigger>
          <TabsTrigger value="documents">Dokumente</TabsTrigger>
          <TabsTrigger value="messages">Nachrichten</TabsTrigger>
          <TabsTrigger value="requests">Anliegen</TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="mt-5 space-y-3">
          {recentClaims.map((claim) => (
            <Card key={claim.id}>
              <CardContent className="flex items-center justify-between gap-4 p-5">
                <div>
                  <p className="font-medium">
                    Miete {formattedMonth(claim.claim_month)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Fällig am {formattedDate(claim.due_date)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{cents(claim.amount_cents)}</p>
                  {claim.status === "partial" ? (
                    <p className="mb-1 text-xs text-muted-foreground">
                      {cents(claim.paid_cents)} bezahlt
                    </p>
                  ) : claim.status === "overpaid" ? (
                    <p className="mb-1 text-xs text-muted-foreground">
                      {cents(claim.paid_cents)} eingegangen
                    </p>
                  ) : null}
                  <Badge
                    variant={
                      ["paid", "overpaid"].includes(claim.status)
                        ? "default"
                        : claim.status === "cancelled"
                          ? "outline"
                          : "secondary"
                    }
                  >
                    {paymentStatusLabels[claim.status] ?? claim.status}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
          {recentClaims.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">
              Noch keine Zahlungsübersicht vorhanden.
            </p>
          ) : null}
          {claims.length > recentClaims.length ? (
            <p className="py-2 text-center text-xs text-muted-foreground">
              Angezeigt werden die 24 neuesten Forderungen. Offene Beträge
              berücksichtigen alle {claims.length} vollständig geladenen
              Forderungen.
            </p>
          ) : null}
        </TabsContent>

        <TabsContent value="documents" className="mt-5">
          <Card>
            <CardContent className="divide-y p-0">
              {documents.map((document) => (
                <div
                  key={document.id}
                  className="flex items-center justify-between gap-4 p-5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <FileText className="size-5 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate font-medium">
                        {document.title || document.original_file_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {document.document_type}
                      </p>
                    </div>
                  </div>
                  <Button asChild variant="outline" size="sm">
                    <a href={`/api/documents/${document.id}/download`}>Öffnen</a>
                  </Button>
                </div>
              ))}
              {documents.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  Keine Dokumente für dich freigegeben.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="messages" className="mt-5 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Neue Nachricht</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createTenantConversationAction} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="message-subject">Betreff</Label>
                  <Input id="message-subject" name="subject" required maxLength={240} />
                </div>
                <div className="grid gap-2">
                  <Label>Kategorie</Label>
                  <Select name="category" defaultValue="general">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">Allgemein</SelectItem>
                      <SelectItem value="repair">Reparatur</SelectItem>
                      <SelectItem value="damage">Schaden</SelectItem>
                      <SelectItem value="utilities">Nebenkosten</SelectItem>
                      <SelectItem value="payment">Zahlung</SelectItem>
                      <SelectItem value="document">Dokument</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="message-body">Nachricht</Label>
                  <Textarea id="message-body" name="body" required rows={4} />
                </div>
                <Button type="submit" className="w-fit">
                  <MessageSquareText />
                  Nachricht senden
                </Button>
              </form>
            </CardContent>
          </Card>

          {conversations.map((conversation) => {
            const conversationMessages = messages.filter(
              (message) => message.conversation_id === conversation.id,
            );
            return (
              <Card key={conversation.id}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <CardTitle className="text-base">{conversation.subject}</CardTitle>
                    <Badge variant="secondary">{conversation.status}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {conversationMessages.map((message) => (
                    <div
                      key={message.id}
                      className={
                        message.author_tenant_id
                          ? "ml-auto max-w-[85%] rounded-xl bg-primary p-3 text-sm text-primary-foreground"
                          : "max-w-[85%] rounded-xl bg-muted p-3 text-sm"
                      }
                    >
                      {message.body}
                    </div>
                  ))}
                  <form action={replyToConversationAction} className="flex gap-2">
                    <input
                      type="hidden"
                      name="conversationId"
                      value={conversation.id}
                    />
                    <Input
                      name="body"
                      required
                      minLength={2}
                      placeholder="Antwort schreiben …"
                    />
                    <Button type="submit">Senden</Button>
                  </form>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>

        <TabsContent value="requests" className="mt-5 grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Schaden oder Anliegen melden</CardTitle>
            </CardHeader>
            <CardContent>
              <form action={createMaintenanceRequestAction} className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="request-title">Titel</Label>
                  <Input id="request-title" name="title" required />
                </div>
                <div className="grid gap-2">
                  <Label>Kategorie</Label>
                  <Select name="category" defaultValue="repair">
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="repair">Reparatur</SelectItem>
                      <SelectItem value="damage">Schaden</SelectItem>
                      <SelectItem value="heating">Heizung</SelectItem>
                      <SelectItem value="water">Wasser</SelectItem>
                      <SelectItem value="electrical">Elektrik</SelectItem>
                      <SelectItem value="security">Sicherheit</SelectItem>
                      <SelectItem value="other">Sonstiges</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="request-description">Beschreibung</Label>
                  <Textarea
                    id="request-description"
                    name="description"
                    required
                    rows={5}
                  />
                </div>
                <Button type="submit" className="w-fit">Anliegen absenden</Button>
              </form>
            </CardContent>
          </Card>
          <div className="space-y-3">
            {requests.map((request) => (
              <Card key={request.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium">{request.title}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {request.description}
                      </p>
                    </div>
                    <Badge variant="secondary">{request.status}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
            {requests.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Noch keine Anliegen gemeldet.
              </p>
            ) : null}
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}
