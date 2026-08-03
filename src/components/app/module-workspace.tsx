"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  CircleAlert,
  Database,
  Download,
  FilePlus2,
  Loader2,
  Plus,
  Search,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHeader } from "@/components/app/page-header";
import { TaxDisclaimer } from "@/components/app/tax-disclaimer";
import type {
  ModuleDefinition,
  ModuleField,
} from "@/lib/modules";
import type {
  ModuleRow,
  RelationLoadErrors,
  RelationOptions,
} from "@/lib/data/modules";
import {
  createModuleRecordAction,
  type CreateRecordState,
} from "@/app/app/[module]/actions";
import { cn } from "@/lib/utils";
import { documentStatusRequiresAttention } from "@/lib/documents/status";
import {
  getModuleRowAction,
  type ModuleRowAction,
} from "@/lib/modules/interactions";
import { moduleRowRequiresAttention } from "@/lib/modules/summary";
import { propertyTypeLabel } from "@/lib/domain/property";

const initialState: CreateRecordState = { status: "idle" };

const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});
const number = new Intl.NumberFormat("de-DE", {
  maximumFractionDigits: 2,
});

const statusLabels: Record<string, string> = {
  active: "Aktiv",
  occupied: "Vermietet",
  vacant: "Leerstand",
  renovation: "Sanierung",
  paid: "Bezahlt",
  open: "Offen",
  partial: "Teilweise",
  completed: "Erledigt",
  done: "Erledigt",
  rented: "Vermietet",
  in_progress: "In Arbeit",
  planned: "Geplant",
  draft: "Entwurf",
  verified: "Geprüft",
  missing: "Beleg fehlt",
  unreadable: "Unleserlich",
  unclear_assignment: "Zuordnung unklar",
  review_required: "Prüfung erforderlich",
  high: "Hoch",
  medium: "Mittel",
  low: "Niedrig",
  urgent: "Dringend",
  demo: "Demo",
  connected: "Verbunden",
  annuity: "Annuitätendarlehen",
  repayment: "Ratentilgungsdarlehen",
  interest_only: "Endfälliges Darlehen",
  variable: "Variables Darlehen",
  other: "Sonstiges",
  advance: "Vorauszahlung",
  flat_rate: "Betriebskostenpauschale",
  none: "Keine gesonderten Nebenkosten",
  existing: "Bestandsimmobilie",
  scenario: "Fiktives Szenario",
};

function text(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return "";
}

function formatCell(value: unknown, format?: string) {
  if (value === null || value === undefined || value === "") return "–";
  switch (format) {
    case "money":
      return euro.format(Number(value) / 100);
    case "number":
      return number.format(Number(value));
    case "percent":
      return `${number.format(Number(value))} %`;
    case "rate":
      return `${number.format(Number(value) * 100)} %`;
    case "date": {
      const date = new Date(String(value));
      return Number.isNaN(date.valueOf())
        ? "–"
        : new Intl.DateTimeFormat("de-DE").format(date);
    }
    case "status": {
      const key = String(value);
      return statusLabels[key] ?? key.replaceAll("_", " ");
    }
    case "propertyType":
      return propertyTypeLabel(value);
    default:
      return String(value);
  }
}

function badgeVariant(value: unknown) {
  const key = String(value);
  if (["paid", "completed", "verified", "active", "connected"].includes(key)) {
    return "default" as const;
  }
  if (
    documentStatusRequiresAttention(key) ||
    ["urgent", "overdue"].includes(key)
  ) {
    return "destructive" as const;
  }
  return "secondary" as const;
}

function relationOptions(field: ModuleField, relations: RelationOptions) {
  if (!field.relation) return field.options ?? [];
  return relations[field.relation];
}

const relationLabels: Record<keyof RelationOptions, string> = {
  properties: "Immobilien",
  units: "Einheiten",
  tenants: "Mieter",
};

function RowActionLink({ action }: { action: ModuleRowAction }) {
  const content = (
    <>
      {action.kind === "download" ? (
        <Download />
      ) : action.kind === "review" ? (
        <CheckCircle2 />
      ) : (
        <ArrowUpRight />
      )}
      {action.label}
    </>
  );

  return (
    <Button asChild variant="ghost" size="sm">
      {action.kind === "download" ? (
        <a href={action.href}>{content}</a>
      ) : (
        <Link href={action.href}>{content}</Link>
      )}
    </Button>
  );
}

function CreateRecordDialog({
  definition,
  relations,
  relationErrors,
  initialFieldValues,
  initiallyOpen,
}: {
  definition: ModuleDefinition;
  relations: RelationOptions;
  relationErrors: RelationLoadErrors;
  initialFieldValues?: Record<string, string>;
  initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(Boolean(initiallyOpen));
  const [state, setState] = useState(initialState);
  const [pending, startTransition] = useTransition();
  const hasRelationLoadError = definition.fields.some(
    (field) => field.relation && relationErrors[field.relation],
  );
  const hasMissingRequiredRelation = definition.fields.some(
    (field) =>
      field.required &&
      field.relation &&
      !relationErrors[field.relation] &&
      relations[field.relation].length === 0,
  );
  const hasBlockingRelationIssue = definition.fields.some(
    (field) =>
      field.required &&
      field.relation &&
      (relationErrors[field.relation] ||
        relations[field.relation].length === 0),
  );

  useEffect(() => {
    if (state.status === "success") {
      toast.success(state.message);
    }
  }, [state]);

  function action(formData: FormData) {
    startTransition(async () => {
      const result = await createModuleRecordAction(initialState, formData);
      setState(result);
      if (result.status === "success") setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus />
          {definition.createLabel ?? "Neu anlegen"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{definition.createLabel ?? "Datensatz anlegen"}</DialogTitle>
          <DialogDescription>
            Pflichtangaben werden serverseitig geprüft und deiner aktuellen
            Organisation zugeordnet.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="module" value={definition.slug} />
          {state.status === "error" && state.message ? (
            <Alert variant="destructive" className="sm:col-span-2">
              <CircleAlert />
              <AlertDescription>{state.message}</AlertDescription>
            </Alert>
          ) : null}
          {hasRelationLoadError ? (
            <Alert variant="destructive" className="sm:col-span-2">
              <CircleAlert />
              <AlertTitle>Auswahldaten nicht verfügbar</AlertTitle>
              <AlertDescription>
                Mindestens eine Auswahlliste konnte nicht geladen werden. Bitte
                schließe den Dialog und lade die Seite neu.
              </AlertDescription>
            </Alert>
          ) : hasMissingRequiredRelation ? (
            <Alert className="sm:col-span-2">
              <CircleAlert />
              <AlertTitle>Voraussetzung fehlt</AlertTitle>
              <AlertDescription>
                Für die Anlage fehlt noch ein benötigter Stammdatensatz.
              </AlertDescription>
            </Alert>
          ) : null}
          {definition.fields.map((field) => {
            const fieldError = state.errors?.[field.name]?.[0];
            const options = relationOptions(field, relations);
            const relationLoadFailed = field.relation
              ? Boolean(relationErrors[field.relation])
              : false;
            const relationIsEmpty = Boolean(
              field.relation && options.length === 0,
            );
            const relationMessage = field.relation
              ? relationLoadFailed
                ? "Auswahldaten konnten nicht geladen werden. Bitte lade die Seite neu."
                : relationIsEmpty
                  ? `Noch keine ${relationLabels[field.relation]} verfügbar.`
                  : null
              : null;
            return (
              <div
                className={cn(
                  "space-y-2",
                  field.type === "textarea" && "sm:col-span-2",
                )}
                key={field.name}
              >
                <Label htmlFor={field.name}>
                  {field.label}
                  {field.required ? " *" : ""}
                </Label>
                {field.type === "select" ? (
                  <Select
                    name={field.name}
                    defaultValue={initialFieldValues?.[field.name]}
                    required={field.required}
                    disabled={Boolean(
                      field.relation &&
                        (relationLoadFailed || relationIsEmpty),
                    )}
                  >
                    <SelectTrigger
                      id={field.name}
                      aria-invalid={Boolean(fieldError || relationLoadFailed)}
                    >
                      <SelectValue placeholder="Bitte auswählen" />
                    </SelectTrigger>
                    <SelectContent>
                      {options.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : field.type === "textarea" ? (
                  <Textarea
                    id={field.name}
                    name={field.name}
                    placeholder={field.placeholder}
                    required={field.required}
                    rows={4}
                    aria-invalid={Boolean(fieldError)}
                  />
                ) : (
                  <div className="relative">
                    <Input
                      id={field.name}
                      name={field.name}
                      type={
                        field.type === "money" || field.type === "number"
                          ? "number"
                          : field.type === "date"
                            ? "date"
                            : "text"
                      }
                      min={
                        field.type === "money" || field.type === "number"
                          ? "0"
                          : undefined
                      }
                      step={field.type === "money" ? "0.01" : "any"}
                      className={cn(field.type === "money" && "pr-9")}
                      placeholder={field.placeholder}
                      defaultValue={initialFieldValues?.[field.name]}
                      required={field.required}
                      aria-invalid={Boolean(fieldError)}
                    />
                    {field.type === "money" ? (
                      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                        €
                      </span>
                    ) : null}
                  </div>
                )}
                {fieldError ? (
                  <p className="text-xs text-destructive">{fieldError}</p>
                ) : relationMessage ? (
                  <p
                    className={cn(
                      "text-xs",
                      relationLoadFailed
                        ? "text-destructive"
                        : "text-muted-foreground",
                    )}
                  >
                    {relationMessage}
                  </p>
                ) : null}
              </div>
            );
          })}
          <div className="flex justify-end gap-2 pt-2 sm:col-span-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Abbrechen
            </Button>
            <Button
              type="submit"
              disabled={pending || hasBlockingRelationIssue}
            >
              {pending ? <Loader2 className="animate-spin" /> : null}
              Speichern
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ModuleSummary({
  definition,
  rows,
}: {
  definition: ModuleDefinition;
  rows: ModuleRow[];
}) {
  const moneyKey =
    definition.columns.find((column) => column.format === "money")?.key ?? null;
  const total = moneyKey
    ? rows.reduce((sum, row) => sum + (Number(row[moneyKey]) || 0), 0)
    : 0;
  const attention = rows.filter(moduleRowRequiresAttention).length;
  const timestamped = rows.filter((row) => {
    const date = new Date(String(row.updated_at ?? row.created_at ?? ""));
    return !Number.isNaN(date.valueOf());
  }).length;

  const metrics = [
    { label: "Datensätze", value: number.format(rows.length), hint: "Aktuelle Auswahl" },
    {
      label: moneyKey ? "Gesamtsumme" : "Aktualisiert",
      value: moneyKey ? euro.format(total / 100) : number.format(timestamped),
      hint: moneyKey ? "Erster sichtbarer Geldwert" : "Mit Aktualisierungsdatum",
    },
    {
      label: "Handlungsbedarf",
      value: number.format(attention),
      hint: attention ? "Offen oder zu prüfen" : "Derzeit unauffällig",
    },
  ];

  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-3">
      {metrics.map((metric) => (
        <Card key={metric.label}>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">{metric.label}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight">
              {metric.value}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{metric.hint}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function IntegrationCards() {
  const integrations = [
    ["Open Banking", "Zahlungsabgleich mit erklärbarem Demo-Scoring", "Demo"],
    ["Dokumenterkennung", "Manuelle Eingabe und Demo-Extraktion verfügbar", "Demo"],
    ["Marktdaten", "Manueller Import mit Quelle und Unsicherheit", "Manuell"],
    ["E-Mail", "Sicherer Entwicklungsmodus für Einladungen", "Entwicklung"],
    ["Geocoding", "Adresseingabe funktioniert ohne externen Schlüssel", "Optional"],
  ];
  return (
    <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {integrations.map(([name, description, mode]) => (
        <Card key={name}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                <Database className="size-5" />
              </div>
              <Badge variant="secondary">{mode}</Badge>
            </div>
            <h2 className="mt-4 font-semibold">{name}</h2>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              {description}
            </p>
            <Button variant="outline" size="sm" className="mt-4" disabled>
              Provider verbinden
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function BankDemoCard() {
  return (
    <Card className="mb-6 border-primary/20">
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base">Demo-Zuordnungsvorschlag</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Noch kein Open-Banking-Provider verbunden
          </p>
        </div>
        <Badge>92 % sicher</Badge>
      </CardHeader>
      <CardContent className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <div className="rounded-xl bg-muted p-4">
          <p className="text-sm font-medium">Zahlungseingang</p>
          <p className="mt-2 text-xl font-semibold">875,00 €</p>
          <p className="mt-1 text-sm text-muted-foreground">
            DEMO MIETER · Miete 08/2026 Whg. 2 OG links
          </p>
        </div>
        <ArrowUpRight className="hidden size-5 text-primary lg:block" />
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <p className="text-sm font-medium">
            Hannover · Wohnung 2. OG links
          </p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
            <li>• Betrag stimmt exakt mit der offenen Mietforderung überein</li>
            <li>• Einheit wird im Verwendungszweck genannt</li>
            <li>• Buchungsdatum liegt im erwarteten Zeitfenster</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export function ModuleWorkspace({
  definition,
  rows,
  relations,
  relationErrors,
  error,
  forbidden,
  canCreate,
  headerActions,
  notice,
  initialFieldValues,
  initiallyOpenCreate,
}: {
  definition: ModuleDefinition;
  rows: ModuleRow[];
  relations: RelationOptions;
  relationErrors: RelationLoadErrors;
  error: string | null;
  forbidden: boolean;
  canCreate: boolean;
  headerActions?: React.ReactNode;
  notice?: React.ReactNode;
  initialFieldValues?: Record<string, string>;
  initiallyOpenCreate?: boolean;
}) {
  const [query, setQuery] = useState("");
  const filteredRows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("de");
    if (!normalized) return rows;
    return rows.filter((row) =>
      Object.values(row).some((value) =>
        text(value).toLocaleLowerCase("de").includes(normalized),
      ),
    );
  }, [query, rows]);
  const hasRowActions = useMemo(
    () =>
      rows.some((row) =>
        Boolean(getModuleRowAction(definition.slug, row.id)),
      ),
    [definition.slug, rows],
  );

  if (forbidden) {
    return (
      <>
        <PageHeader
          eyebrow={definition.eyebrow}
          title={definition.title}
          description={definition.description}
        />
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>403 · Zugriff verweigert</AlertTitle>
          <AlertDescription>
            Deine aktuelle Rolle darf diesen Bereich nicht einsehen. Es wurden
            keine Daten aus dem geschützten Modul abgefragt.
          </AlertDescription>
        </Alert>
      </>
    );
  }

  const defaultActions =
    definition.slug === "belege" && canCreate ? (
      <Button asChild>
        <Link href="/app/belege/upload">
          <Upload />
          Beleg hochladen
        </Link>
      </Button>
    ) : definition.slug === "berichte" ? (
      <>
        <Button asChild variant="outline">
          <a href="/api/exports/csv?resource=properties">
            <Download />
            CSV
          </a>
        </Button>
        <Button asChild>
          <a href="/api/exports/pdf">
            <FilePlus2 />
            PDF-Bericht
          </a>
        </Button>
      </>
    ) : !definition.readOnly && definition.fields.length && canCreate ? (
      <CreateRecordDialog
        definition={definition}
        relations={relations}
        relationErrors={relationErrors}
        initialFieldValues={initialFieldValues}
        initiallyOpen={initiallyOpenCreate}
      />
    ) : undefined;
  const actions =
    headerActions || defaultActions ? (
      <>
        {headerActions}
        {defaultActions}
      </>
    ) : undefined;

  return (
    <>
      <PageHeader
        eyebrow={definition.eyebrow}
        title={definition.title}
        description={definition.description}
        actions={actions}
      />
      {notice ? <div className="mb-5">{notice}</div> : null}
      {definition.taxSensitive ? (
        <div className="mb-6">
          <TaxDisclaimer compact={definition.slug !== "steuern"} />
        </div>
      ) : null}
      {definition.slug === "integrationen" ? <IntegrationCards /> : null}
      {definition.slug === "bank" ? <BankDemoCard /> : null}
      <ModuleSummary definition={definition} rows={rows} />

      {error ? (
        <Alert variant="destructive" className="mb-5">
          <CircleAlert />
          <AlertDescription>
            Die Live-Daten konnten nicht vollständig geladen werden. Bitte lade
            die Seite neu. Demo-Funktionen bleiben verfügbar.
          </AlertDescription>
        </Alert>
      ) : null}

      <Card>
        <CardHeader className="flex-col gap-4 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-base">Aktuelle Datensätze</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              {filteredRows.length} von {rows.length} Einträgen
            </p>
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tabelle durchsuchen …"
              className="pl-9"
            />
          </div>
        </CardHeader>
        <CardContent className="px-0">
          {filteredRows.length === 0 ? (
            <div className="flex flex-col items-center px-6 py-16 text-center">
              <div className="grid size-12 place-items-center rounded-2xl bg-muted text-muted-foreground">
                {query ? <Search className="size-5" /> : <Banknote className="size-5" />}
              </div>
              <h2 className="mt-4 font-semibold">
                {query ? "Keine Treffer" : definition.emptyTitle}
              </h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                {query
                  ? "Passe den Suchbegriff an oder entferne den Filter."
                  : definition.emptyDescription}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {definition.columns.map((column) => (
                      <TableHead key={column.key}>{column.label}</TableHead>
                    ))}
                    {hasRowActions ? (
                      <TableHead className="w-44">Aktion</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredRows.map((row, rowIndex) => {
                    const rowAction = getModuleRowAction(
                      definition.slug,
                      row.id,
                    );

                    return (
                      <TableRow key={text(row.id) || rowIndex}>
                        {definition.columns.map((column) => (
                          <TableCell
                            key={column.key}
                            className={cn(
                              column.format === "money" &&
                                "font-mono tabular-nums",
                              column.key === definition.columns[0]?.key &&
                                "font-medium",
                            )}
                          >
                            {column.format === "status" ? (
                              <Badge variant={badgeVariant(row[column.key])}>
                                {formatCell(row[column.key], column.format)}
                              </Badge>
                            ) : (
                              formatCell(row[column.key], column.format)
                            )}
                          </TableCell>
                        ))}
                        {hasRowActions ? (
                          <TableCell className="whitespace-nowrap">
                            {rowAction ? (
                              <RowActionLink action={rowAction} />
                            ) : null}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
