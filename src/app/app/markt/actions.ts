"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrganization } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { valuationInputSchema } from "@/lib/valuations/somantic";
import { requestSomanticValuation, ValuationProviderError } from "@/lib/valuations/provider";
import type { Json } from "@/types/database";

export async function requestValuationAction(propertyId: string, input: unknown): Promise<{error?: string; errors?: Record<string,string[]>; reportId?: string}> {
  const viewer = await requireOrganization();
  if (!hasPermission(viewer.role, "portfolio.write")) return {error: "Deine Rolle darf keine Bewertung anfordern."};
  if (!z.uuid().safeParse(propertyId).success) return {error: "Bitte eine Immobilie auswählen."};
  const parsed = valuationInputSchema.safeParse(input);
  if (!parsed.success) return {error: "Bitte die markierten Angaben ergänzen.", errors: parsed.error.flatten().fieldErrors};
  if (!process.env.SOMANTIC_API_KEY || !process.env.SUPABASE_SECRET_KEY) return {error: "Die Bewertungsverbindung ist noch nicht eingerichtet."};
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("reserve_somantic_valuation", {p_organization_id: viewer.organizationId, p_property_id: propertyId, p_input: parsed.data as Json});
  if (error || !id) return {error: error?.code === "23505" ? "Für diese Immobilie läuft bereits eine Bewertungsanfrage oder ihr Ergebnis ist noch unbestätigt. Bitte den laufenden Abruf abwarten; bei unbestätigtem Status den Support kontaktieren." : error?.code === "55P03" ? "Bitte vor einem erneuten Versuch eine Minute warten." : "Die Bewertung konnte nicht reserviert werden. Bitte Verfügbarkeit und Objektdaten prüfen."};
  const admin = createAdminClient();
  try {
    const response = await requestSomanticValuation(parsed.data);
    // Persist retries never repeat the billable provider request. Completion is idempotent.
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await admin.rpc("finish_somantic_valuation", {p_report_id: id, p_response: response as Json});
      if (!result.error) { revalidatePath("/app", "layout"); return {reportId: id}; }
    }
    // Retain the provider result for recovery without another API call.
    await admin.from("somantic_valuation_reports").update({response: response as Json, status: "uncertain", error_message: "Das Ergebnis liegt vor; die Übernahme in den Marktwert muss geprüft werden."}).eq("id",id).eq("status","pending");
    return {error: "Die Bewertung wurde geliefert, konnte aber nicht vollständig übernommen werden. Bitte den Support zur Prüfung kontaktieren."};
  } catch (error) {
    const providerError = error instanceof ValuationProviderError ? error : new ValuationProviderError("Die Verarbeitung ist unbestätigt. Bitte den Support zur Prüfung kontaktieren.", false);
    await admin.from("somantic_valuation_reports").update({status: providerError.retryable ? "failed" : "uncertain",error_message: providerError.message}).eq("id",id).eq("status","pending");
    revalidatePath("/app/markt");
    return {error: providerError.message};
  }
}
