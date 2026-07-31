import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Landmark,
  Link2,
} from "lucide-react";
import { confirmTransactionMatchAction } from "@/app/app/bank/actions";
import { PageHeader } from "@/components/app/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrganization } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 2,
});
const date = new Intl.DateTimeFormat("de-DE");

const resultMessages: Record<
  string,
  { title: string; description: string; destructive?: boolean }
> = {
  confirmed: {
    title: "Zuordnung bestätigt",
    description:
      "Die Transaktion und das zugehörige Ziel wurden atomar aktualisiert.",
  },
  "already-confirmed": {
    title: "Bereits bestätigt",
    description: "Diese Zuordnung war bereits verbindlich bestätigt.",
  },
  forbidden: {
    title: "Keine Schreibberechtigung",
    description: "Deine Rolle darf Zuordnungsvorschläge nicht bestätigen.",
    destructive: true,
  },
  invalid: {
    title: "Ungültige Anfrage",
    description: "Die ausgewählte Zuordnung konnte nicht geprüft werden.",
    destructive: true,
  },
  "invalid-status": {
    title: "Zuordnung nicht bestätigbar",
    description:
      "Nur offene Vorschläge können bestätigt werden. Lade die Seite neu.",
    destructive: true,
  },
  "not-found": {
    title: "Zuordnung nicht gefunden",
    description:
      "Die Zuordnung gehört nicht zur aktuellen Organisation oder ist nicht mehr verfügbar.",
    destructive: true,
  },
  failed: {
    title: "Bestätigung fehlgeschlagen",
    description:
      "Die Datenbank hat die Zuordnung nicht übernommen. Die bisherigen Daten blieben unverändert.",
    destructive: true,
  },
};

function amount(cents: number) {
  return euro.format(cents / 100);
}

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function matchTarget(match: {
  rent_claim_id: string | null;
  income_entry_id: string | null;
  expense_entry_id: string | null;
}) {
  if (match.rent_claim_id) {
    return `Mietforderung ${shortId(match.rent_claim_id)}`;
  }
  if (match.income_entry_id) {
    return `Einnahme ${shortId(match.income_entry_id)}`;
  }
  if (match.expense_entry_id) {
    return `Ausgabe ${shortId(match.expense_entry_id)}`;
  }
  return "Unbekanntes Ziel";
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    unmatched: "Nicht zugeordnet",
    suggested: "Vorgeschlagen",
    confirmed: "Bestätigt",
    rejected: "Abgelehnt",
    ignored: "Ignoriert",
  };
  return labels[status] ?? status.replaceAll("_", " ");
}

export default async function BankPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string | string[] }>;
}) {
  const viewer = await requireOrganization();
  const canRead = hasPermission(viewer.role, "bank.read");
  const canConfirm = hasPermission(viewer.role, "bank.reconcile");
  const resultValue = (await searchParams).result;
  const result = typeof resultValue === "string" ? resultValue : null;
  const resultMessage = result ? resultMessages[result] : null;

  if (!canRead) {
    return (
      <>
        <PageHeader
          eyebrow="Bankdaten"
          title="Bank & Zahlungen"
          description="Transaktionen und Zuordnungen sind nur für berechtigte Finanzrollen sichtbar."
        />
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>403 · Zugriff verweigert</AlertTitle>
          <AlertDescription>
            Deine aktuelle Rolle darf sensible Banktransaktionen und
            Zahlungszuordnungen nicht einsehen. Einnahmen und Ausgaben bleiben
            im Buchhaltungsbereich verfügbar, sofern deine Rolle dafür
            berechtigt ist.
          </AlertDescription>
        </Alert>
      </>
    );
  }

  const supabase = await createClient();
  const [transactionsResult, matchesResult] = await Promise.all([
    supabase
      .from("bank_transactions")
      .select(
        "id, booked_on, value_on, amount_cents, currency, counterparty_name, counterparty_iban_last4, remittance_information, match_status, is_ignored",
      )
      .eq("organization_id", viewer.organizationId)
      .order("booked_on", { ascending: false })
      .limit(100),
    supabase
      .from("transaction_matches")
      .select(
        "id, bank_transaction_id, rent_claim_id, income_entry_id, expense_entry_id, confidence, explanation, status, created_at",
      )
      .eq("organization_id", viewer.organizationId)
      .order("created_at", { ascending: false })
      .limit(250),
  ]);
  const transactions = transactionsResult.data ?? [];
  const matches = matchesResult.data ?? [];
  const visibleTransactionIds = new Set(
    transactions.map((transaction) => transaction.id),
  );
  const visibleMatches = matches.filter((match) =>
    visibleTransactionIds.has(match.bank_transaction_id),
  );
  const matchesByTransaction = new Map<
    string,
    typeof visibleMatches
  >();
  for (const match of visibleMatches) {
    const current = matchesByTransaction.get(match.bank_transaction_id) ?? [];
    current.push(match);
    matchesByTransaction.set(match.bank_transaction_id, current);
  }
  const suggestedCount = visibleMatches.filter(
    (match) => match.status === "suggested",
  ).length;
  const confirmedCount = visibleMatches.filter(
    (match) => match.status === "confirmed",
  ).length;
  const queryFailed = Boolean(transactionsResult.error || matchesResult.error);

  return (
    <>
      <PageHeader
        eyebrow="Erklärbarer Zahlungsabgleich"
        title="Bank & Zahlungen"
        description="Echte Transaktionen und Zuordnungsvorschläge deiner aktuellen Organisation prüfen und verbindlich bestätigen."
      />

      {resultMessage ? (
        <Alert
          variant={resultMessage.destructive ? "destructive" : "default"}
          className="mb-5"
        >
          {resultMessage.destructive ? <CircleAlert /> : <CheckCircle2 />}
          <AlertTitle>{resultMessage.title}</AlertTitle>
          <AlertDescription>{resultMessage.description}</AlertDescription>
        </Alert>
      ) : null}

      {queryFailed ? (
        <Alert variant="destructive" className="mb-5">
          <CircleAlert />
          <AlertTitle>Bankdaten nicht vollständig geladen</AlertTitle>
          <AlertDescription>
            Prüfe die Verbindung und lade die Seite erneut. Es wurden keine
            Ersatz- oder Demo-Datensätze erzeugt.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[
          ["Transaktionen", transactions.length],
          ["Offene Vorschläge", suggestedCount],
          ["Bestätigte Zuordnungen", confirmedCount],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 text-2xl font-semibold tabular-nums">
                {value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {transactions.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center px-6 py-16 text-center">
            <div className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
              <Landmark className="size-5" />
            </div>
            <h2 className="mt-4 font-semibold">
              Noch keine echten Banktransaktionen
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              Sobald ein Bankkonto angebunden oder ein Import verarbeitet
              wurde, erscheinen die Transaktionen hier. In diesem
              Organisationsbereich werden keine erfundenen Demo-Zahlungen
              gespeichert oder als echte Vorschläge ausgegeben.
            </p>
            <Badge variant="secondary" className="mt-4">
              Open-Banking-Anbindung vorbereitet
            </Badge>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {transactions.map((transaction) => {
            const transactionMatches =
              matchesByTransaction.get(transaction.id) ?? [];
            return (
              <Card key={transaction.id}>
                <CardHeader className="gap-3 sm:grid-cols-[1fr_auto]">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle>
                        {transaction.counterparty_name ||
                          "Unbekannte Gegenpartei"}
                      </CardTitle>
                      <Badge
                        variant={
                          transaction.match_status === "confirmed"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {statusLabel(transaction.match_status)}
                      </Badge>
                      {transaction.is_ignored ? (
                        <Badge variant="outline">Ignoriert</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {date.format(new Date(`${transaction.booked_on}T12:00:00`))}
                      {transaction.counterparty_iban_last4
                        ? ` · IBAN endet auf ${transaction.counterparty_iban_last4}`
                        : ""}
                    </p>
                  </div>
                  <p
                    className={`text-xl font-semibold tabular-nums ${
                      transaction.amount_cents < 0
                        ? "text-destructive"
                        : "text-primary"
                    }`}
                  >
                    {amount(transaction.amount_cents)}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="rounded-lg bg-muted/60 px-4 py-3 text-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Verwendungszweck
                    </p>
                    <p className="mt-1 break-words">
                      {transaction.remittance_information || "Nicht angegeben"}
                    </p>
                  </div>

                  {transactionMatches.length === 0 ? (
                    <div className="mt-4 flex items-start gap-3 rounded-lg border border-dashed p-4">
                      <Link2 className="mt-0.5 size-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">
                          Kein Zuordnungsvorschlag vorhanden
                        </p>
                        <p className="mt-1 text-xs leading-5 text-muted-foreground">
                          Es wird keine künstliche Zuordnung erzeugt. Die
                          Transaktion bleibt nachvollziehbar offen.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 space-y-3">
                      {transactionMatches.map((match) => (
                        <div
                          key={match.id}
                          className="grid gap-4 rounded-lg border p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                        >
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-medium">
                                {matchTarget(match)}
                              </p>
                              <ArrowRight className="size-3.5 text-muted-foreground" />
                              <Badge
                                variant={
                                  match.status === "confirmed"
                                    ? "default"
                                    : "secondary"
                                }
                              >
                                {statusLabel(match.status)}
                              </Badge>
                              {match.confidence !== null ? (
                                <Badge variant="outline">
                                  {Math.round(match.confidence * 100)} %
                                  Konfidenz
                                </Badge>
                              ) : null}
                            </div>
                            <p className="mt-2 text-sm leading-6 text-muted-foreground">
                              {match.explanation}
                            </p>
                          </div>
                          {match.status === "suggested" && canConfirm ? (
                            <form action={confirmTransactionMatchAction}>
                              <input
                                type="hidden"
                                name="matchId"
                                value={match.id}
                              />
                              <Button type="submit" size="sm">
                                <CheckCircle2 />
                                Bestätigen
                              </Button>
                            </form>
                          ) : match.status === "suggested" ? (
                            <p className="text-xs text-muted-foreground">
                              Nur mit Finanz-Schreibrecht bestätigbar
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
