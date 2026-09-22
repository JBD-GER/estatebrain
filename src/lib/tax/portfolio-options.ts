import "server-only";

import { requireOrganization } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { mapInvestmentProperties, type InvestmentPropertyOption } from "@/lib/tax/portfolio-input";

export interface InvestmentPropertyOptionsResult {
  properties: InvestmentPropertyOption[];
  skippedCount: number;
  error?: string;
}

export const investmentPropertyColumns = "id,name,property_type,property_mode,country_code,purchase_price_cents,acquisition_costs_cents,purchase_date,construction_year,land_value_cents,land_area_sqm,standard_land_value_cents_per_sqm,land_ownership_share,rentable_area_sqm,total_area_sqm";

/** Read-only, tenant-scoped seeds for the authenticated tax dashboard. */
export async function getInvestmentPropertyOptions(): Promise<InvestmentPropertyOptionsResult> {
  const viewer = await requireOrganization();
  if (!hasPermission(viewer.role, "tax.read")) {
    return { properties: [], skippedCount: 0, error: "Für den Steuervergleich fehlen die Zugriffsrechte." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase.from("properties")
    .select(investmentPropertyColumns)
    .eq("organization_id", viewer.organizationId)
    .in("status", ["active", "draft"])
    .is("archived_at", null)
    .order("name", { ascending: true })
    .order("id", { ascending: true })
    .limit(201);
  if (error) {
    return { properties: [], skippedCount: 0, error: "Immobilien aus deinem Portfolio sind gerade nicht verfügbar. Du kannst den Vergleich manuell ausfüllen." };
  }
  const result = mapInvestmentProperties((data ?? []).slice(0, 200));
  return {
    ...result,
    ...((data?.length ?? 0) > 200 ? { error: "Die ersten 200 aktiven Immobilien und Entwürfe werden zur Übernahme geprüft. Weitere Objekte kannst du manuell vergleichen." } : {}),
  };
}
