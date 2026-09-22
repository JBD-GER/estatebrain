import type { SupabaseClient } from "@supabase/supabase-js";
import Link from "next/link";
import { ArrowRight, Calculator, CircleAlert, CircleCheck } from "lucide-react";
import { ModuleWorkspace } from "@/components/app/module-workspace";
import { TaxProfileForm } from "@/components/tax/tax-profile-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { hasPermission } from "@/lib/auth/permissions";
import { getModulePageData } from "@/lib/data/modules";
import { createClient } from "@/lib/supabase/server";

const percent = new Intl.NumberFormat("de-DE", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

export default async function TaxPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string | string[] }>;
}) {
  const data = await getModulePageData("steuern");
  if (!data) return null;
  const rawResult = (await searchParams).result;
  const result = typeof rawResult === "string" ? rawResult : null;
  const canEdit = hasPermission(data.viewer.role, "tax.manage");
  const supabase = await createClient();
  const dynamicSupabase = supabase as unknown as SupabaseClient;
  const { data: profile } = await dynamicSupabase
    .from("tax_profiles")
    .select(
      "calculation_mode, effective_tax_rate, marginal_tax_rate, other_taxable_income_cents, assessment_type, rental_inputs_confirmed_at, tariff_year, tariff_version",
    )
    .eq("organization_id", data.viewer.organizationId)
    .eq("user_id", data.viewer.userId)
    .maybeSingle();
  const row = (profile ?? {}) as Record<string, unknown>;
  const mode = row.calculation_mode === "manual" ? "manual" : "automatic";
  const effectiveRate =
    row.effective_tax_rate == null ? null : Number(row.effective_tax_rate);
  const marginalRate =
    row.marginal_tax_rate == null ? null : Number(row.marginal_tax_rate);

  const notice = (
    <div className="space-y-5">
      <Link href="/app" className="flex items-center gap-4 rounded-2xl bg-primary p-6 text-primary-foreground transition hover:opacity-95">
        <Calculator className="size-7 shrink-0" />
        <div><h2 className="font-semibold">Wie unterscheiden sich deine Immobilien steuerlich?</h2><p className="mt-1 text-xs opacity-80">Bestand, Neubau und Denkmal mit jährlichem AfA-Plan vergleichen.</p></div>
        <ArrowRight className="ml-auto size-5 shrink-0" />
      </Link>
      <p className="rounded-xl border bg-card p-4 text-xs leading-relaxed text-muted-foreground">Bei älteren automatisch berechneten AfA-Basen bitte die Kaufpreisaufteilung prüfen: Auch die auf Grund und Boden entfallenden Kaufnebenkosten sind nicht abschreibbar. Bereits gespeicherte oder manuell geprüfte Werte werden nicht automatisch geändert.</p>
      {result === "saved" ? (
        <Alert>
          <CircleCheck />
          <AlertTitle>Steuerprofil aktualisiert</AlertTitle>
          <AlertDescription>
            Die Portfolio-Modellrechnung verwendet jetzt die neuen Werte.
          </AlertDescription>
        </Alert>
      ) : result ? (
        <Alert variant="destructive">
          <CircleAlert />
          <AlertTitle>Steuerprofil nicht gespeichert</AlertTitle>
          <AlertDescription>
            Prüfe die Pflichtangaben und deine Berechtigung.
          </AlertDescription>
        </Alert>
      ) : null}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Berechnungsmodus</p>
            <p className="mt-2 text-xl font-semibold">
              {mode === "automatic" ? "Automatisch" : "Manuell"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Effektiver Steuersatz</p>
            <p className="mt-2 text-xl font-semibold tabular-nums">
              {effectiveRate === null ? "Nicht berechnet" : percent.format(effectiveRate)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">
              Automatisch berechneter Grenzsteuersatz
            </p>
            <p className="mt-2 text-xl font-semibold tabular-nums">
              {mode !== "automatic" || marginalRate === null
                ? "Nicht verwendet"
                : percent.format(marginalRate)}
            </p>
          </CardContent>
        </Card>
      </section>
      {canEdit ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Persönliches Steuerprofil</CardTitle>
            <CardDescription>
              Automatik berücksichtigt aktuelle Vertragsmieten,
              AfA-Modellwerte, geschätzte Darlehenszinsen und als abzugsfähig
              markierte Belegausgaben des Steuerjahres 2026.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <TaxProfileForm
              initialMode={mode}
              effectiveRatePercent={
                effectiveRate === null ? null : effectiveRate * 100
              }
              otherTaxableIncomeEuros={
                row.other_taxable_income_cents == null
                  ? null
                  : Number(row.other_taxable_income_cents) / 100
              }
              filingStatus={
                row.assessment_type === "joint" ? "joint" : "single"
              }
              rentalInputsConfirmed={Boolean(row.rental_inputs_confirmed_at)}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );

  return (
    <ModuleWorkspace
      definition={data.definition}
      rows={data.rows}
      relations={data.relations}
      relationErrors={data.relationErrors}
      error={data.error}
      forbidden={data.forbidden}
      canCreate={false}
      notice={notice}
    />
  );
}
