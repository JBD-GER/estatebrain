import "server-only";

import { requireOrganization } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  investmentTaxInputSchema,
  investmentMethodSchema,
  type InvestmentScenario,
} from "@/lib/tax/scenario-schema";
import type { Database } from "@/types/database";

type ScenarioRow = Pick<
  Database["public"]["Tables"]["investment_scenarios"]["Row"],
  "id" | "name" | "input" | "selected_method" | "schema_version" | "created_at" | "updated_at"
>;

export const investmentScenarioColumns = "id, name, input, selected_method, schema_version, created_at, updated_at";

export function decodeInvestmentScenario(row: ScenarioRow): InvestmentScenario | null {
  const input = investmentTaxInputSchema.safeParse(row.input);
  const method = investmentMethodSchema.safeParse(row.selected_method);
  if (!input.success || !method.success || row.schema_version !== 1) return null;
  return {
    id: row.id,
    name: row.name,
    input: input.data,
    selectedMethod: method.data,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getInvestmentScenarios(): Promise<{
  scenarios: InvestmentScenario[];
  error?: string;
}> {
  const viewer = await requireOrganization();
  if (!hasPermission(viewer.role, "tax.read")) {
    return { scenarios: [], error: "Für den Steuervergleich fehlen die Zugriffsrechte." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("investment_scenarios")
    .select(investmentScenarioColumns)
    .eq("organization_id", viewer.organizationId)
    .order("updated_at", { ascending: false })
    .limit(101);

  if (error) {
    return {
      scenarios: [],
      error: "Gespeicherte Vergleiche sind gerade nicht verfügbar. Deine aktuelle Berechnung bleibt nutzbar.",
    };
  }

  const decoded = (data ?? []).slice(0, 100).map(decodeInvestmentScenario);
  const scenarios = decoded.filter((scenario): scenario is InvestmentScenario => scenario !== null);
  if (decoded.some((scenario) => scenario === null)) {
    return { scenarios, error: "Ein älterer Vergleich hat ungültige Eingaben und konnte nicht geladen werden." };
  }
  return {
    scenarios,
    ...(data.length > 100 ? { error: "Die 100 zuletzt bearbeiteten Vergleiche werden angezeigt." } : {}),
  };
}
