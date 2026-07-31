import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Building2, FileText, Landmark, Wrench } from "lucide-react";
import { requireOrganization } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  calculateGrossRentalYield,
  calculateVacancyRateByUnits,
} from "@/lib/domain";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const euro = new Intl.NumberFormat("de-DE", {
  style: "currency",
  currency: "EUR",
});
const number = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 2 });
const percent = new Intl.NumberFormat("de-DE", {
  style: "percent",
  maximumFractionDigits: 2,
});

function cents(value: unknown) {
  const amount = Number(value);
  return euro.format(Number.isFinite(amount) ? amount / 100 : 0);
}

function text(value: unknown, fallback = "–") {
  return typeof value === "string" && value.trim() ? value : fallback;
}

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const viewer = await requireOrganization();
  const canReadBookkeeping = hasPermission(
    viewer.role,
    "bookkeeping.read",
  );
  const canReadFinancing = hasPermission(viewer.role, "financing.read");
  const canUploadDocuments = hasPermission(viewer.role, "documents.write");
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .eq("organization_id", viewer.organizationId)
    .maybeSingle();

  if (!property) notFound();

  const [
    { data: units },
    { data: loans },
    { data: renovations },
    { data: documents },
    { data: income },
    { data: expenses },
  ] = await Promise.all([
    supabase
      .from("units")
      .select("*")
      .eq("organization_id", viewer.organizationId)
      .eq("property_id", id)
      .order("unit_number"),
    canReadFinancing
      ? supabase
          .from("loans")
          .select("*")
          .eq("organization_id", viewer.organizationId)
          .eq("property_id", id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: [] }),
    supabase
      .from("renovation_projects")
      .select("*")
      .eq("organization_id", viewer.organizationId)
      .eq("property_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("documents")
      .select("*")
      .eq("organization_id", viewer.organizationId)
      .eq("property_id", id)
      .is("archived_at", null)
      .order("created_at", { ascending: false }),
    canReadBookkeeping
      ? supabase
          .from("income_entries")
          .select("amount_cents")
          .eq("organization_id", viewer.organizationId)
          .eq("property_id", id)
          .is("archived_at", null)
      : Promise.resolve({ data: [] }),
    canReadBookkeeping
      ? supabase
          .from("expense_entries")
          .select("amount_cents")
          .eq("organization_id", viewer.organizationId)
          .eq("property_id", id)
          .is("archived_at", null)
      : Promise.resolve({ data: [] }),
  ]);

  const unitRows = units ?? [];
  const monthlyColdRentCents = unitRows.reduce(
    (sum, unit) => sum + Number(unit.target_cold_rent_cents ?? 0),
    0,
  );
  const purchasePriceCents = Number(property.purchase_price_cents ?? 0);
  const grossYield = calculateGrossRentalYield({
    annualColdRentCents: Math.max(0, Math.round(monthlyColdRentCents * 12)),
    purchasePriceCents: Math.max(0, Math.round(purchasePriceCents)),
  });
  const vacancyRate = calculateVacancyRateByUnits({
    vacantUnits: unitRows.filter((unit) => unit.status === "vacant").length,
    totalUnits: unitRows.length,
  });
  const incomeCents = (income ?? []).reduce(
    (sum, row) => sum + Number(row.amount_cents ?? 0),
    0,
  );
  const expenseCents = (expenses ?? []).reduce(
    (sum, row) => sum + Number(row.amount_cents ?? 0),
    0,
  );

  const address = [
    text(property.street, ""),
    text(property.house_number, ""),
    text(property.postal_code, ""),
    text(property.city, ""),
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <>
      <Button asChild variant="ghost" className="-ml-3 mb-3">
        <Link href="/app/immobilien">
          <ArrowLeft />
          Alle Immobilien
        </Link>
      </Button>

      <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-primary">Immobiliendetails</p>
            <Badge variant="secondary">{text(property.status, "aktiv")}</Badge>
          </div>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            {property.name}
          </h1>
          <p className="mt-2 text-muted-foreground">{address || "Keine Adresse"}</p>
        </div>
        {canUploadDocuments ? (
          <Button asChild>
            <Link href={`/app/belege/upload?property=${property.id}`}>
              <FileText />
              Beleg zuordnen
            </Link>
          </Button>
        ) : null}
      </header>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Marktwert", cents(property.current_market_value_cents)],
          ["Soll-Kaltmiete / Monat", cents(monthlyColdRentCents)],
          [
            "Bruttomietrendite",
            grossYield === null ? "Nicht berechenbar" : percent.format(grossYield),
          ],
          [
            "Leerstand",
            vacancyRate === null ? "Keine Einheiten" : percent.format(vacancyRate),
          ],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{label}</p>
              <p className="mt-2 text-xl font-semibold tabular-nums">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="max-w-full justify-start overflow-x-auto">
          <TabsTrigger value="overview">Übersicht</TabsTrigger>
          <TabsTrigger value="units">Einheiten</TabsTrigger>
          {canReadFinancing ? (
            <TabsTrigger value="finance">Finanzierung</TabsTrigger>
          ) : null}
          <TabsTrigger value="renovation">Sanierung</TabsTrigger>
          <TabsTrigger value="documents">Dokumente</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5 grid gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="size-4 text-primary" />
                Stammdaten
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Objekttyp</p>
                <p className="mt-1 font-medium">{text(property.property_type)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Baujahr</p>
                <p className="mt-1 font-medium">{text(property.construction_year)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Vermietbare Fläche</p>
                <p className="mt-1 font-medium">
                  {number.format(Number(property.rentable_area_sqm ?? 0))} m²
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Kaufpreis</p>
                <p className="mt-1 font-medium">
                  {cents(property.purchase_price_cents)}
                </p>
              </div>
            </CardContent>
          </Card>
          {canReadBookkeeping ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Erfasste Zahlungsströme
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Einnahmen</span>
                  <span className="font-medium text-primary">
                    {cents(incomeCents)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Ausgaben</span>
                  <span className="font-medium">{cents(expenseCents)}</span>
                </div>
                <div className="flex justify-between border-t pt-3">
                  <span>Cashflow vor Finanzierung und Steuer</span>
                  <span className="font-semibold">
                    {cents(incomeCents - expenseCents)}
                  </span>
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  Summe der aktuell erfassten Buchungen, nicht zeitanteilig
                  annualisiert.
                </p>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="units" className="mt-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Einheiten ({unitRows.length})</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Einheit</TableHead>
                    <TableHead>Fläche</TableHead>
                    <TableHead>Soll-Kaltmiete</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {unitRows.map((unit) => (
                    <TableRow key={unit.id}>
                      <TableCell className="font-medium">{unit.unit_number}</TableCell>
                      <TableCell>{number.format(Number(unit.area_sqm ?? 0))} m²</TableCell>
                      <TableCell>{cents(unit.target_cold_rent_cents)}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{text(unit.status)}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {unitRows.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-muted-foreground">
                  Noch keine Einheiten angelegt.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {canReadFinancing ? (
          <TabsContent
            value="finance"
            className="mt-5 grid gap-4 lg:grid-cols-2"
          >
            {(loans ?? []).map((loan) => (
              <Card key={loan.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Landmark className="size-4 text-primary" />
                    {loan.lender_name}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Restschuld</span>
                    <span className="font-medium">
                      {cents(loan.current_balance_cents)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Monatsrate</span>
                    <span>{cents(loan.monthly_payment_cents)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Sollzins</span>
                    <span>
                      {percent.format(
                        Number(loan.nominal_interest_rate ?? 0),
                      )}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
            {(loans ?? []).length === 0 ? (
              <Card>
                <CardContent className="p-8 text-sm text-muted-foreground">
                  Für dieses Objekt ist noch keine Finanzierung hinterlegt.
                </CardContent>
              </Card>
            ) : null}
          </TabsContent>
        ) : null}

        <TabsContent value="renovation" className="mt-5 grid gap-4 lg:grid-cols-2">
          {(renovations ?? []).map((project) => (
            <Card key={project.id}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wrench className="size-4 text-primary" />
                  {project.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Budget</span>
                  <span>{cents(project.estimated_cost_cents)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Priorität</span>
                  <Badge variant="secondary">{text(project.priority)}</Badge>
                </div>
              </CardContent>
            </Card>
          ))}
          {(renovations ?? []).length === 0 ? (
            <Card>
              <CardContent className="p-8 text-sm text-muted-foreground">
                Keine Sanierungsmaßnahme geplant.
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="documents" className="mt-5">
          <Card>
            <CardContent className="divide-y p-0">
              {(documents ?? []).map((document) => (
                <div
                  key={document.id}
                  className="flex items-center justify-between gap-4 p-5"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {document.original_file_name}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {text(document.document_type)} · {text(document.review_status)}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline">
                    <a href={`/api/documents/${document.id}/download`}>Öffnen</a>
                  </Button>
                </div>
              ))}
              {(documents ?? []).length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  Keine Dokumente für dieses Objekt.
                </p>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </>
  );
}
