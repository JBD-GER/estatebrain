"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrganization } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  investmentScenarioSaveSchema,
  type DeleteInvestmentScenarioResult,
  type SaveInvestmentScenarioResult,
} from "@/lib/tax/scenario-schema";
import {
  decodeInvestmentScenario,
  investmentScenarioColumns,
} from "@/lib/tax/scenario-storage";
import type { Json } from "@/types/database";

/** Scenarios are shared planning data, available to all tax.read roles. */
export async function saveInvestmentScenarioAction(
  value: unknown,
): Promise<SaveInvestmentScenarioResult> {
  const viewer = await requireOrganization();
  if (!hasPermission(viewer.role, "tax.read")) {
    return { success: false, error: "Für das Speichern fehlen die Zugriffsrechte." };
  }
  const parsed = investmentScenarioSaveSchema.safeParse(value);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Bitte die Eingaben prüfen." };
  }

  const supabase = await createClient();
  const input = JSON.parse(JSON.stringify(parsed.data.input)) as Json;
  const payload = {
    name: parsed.data.name,
    input,
    selected_method: parsed.data.selectedMethod,
    schema_version: 1,
  };
  const result = parsed.data.id
    ? await supabase
        .from("investment_scenarios")
        .update(payload)
        .eq("id", parsed.data.id)
        .eq("organization_id", viewer.organizationId)
        .select(investmentScenarioColumns)
        .maybeSingle()
    : await supabase
        .from("investment_scenarios")
        .insert({ ...payload, organization_id: viewer.organizationId, created_by: viewer.userId })
        .select(investmentScenarioColumns)
        .single();

  if (result.error) {
    return { success: false, error: "Der Vergleich konnte nicht gespeichert werden. Bitte erneut versuchen." };
  }
  if (!result.data) {
    return { success: false, error: "Der Vergleich wurde nicht gefunden oder du hast keinen Zugriff mehr." };
  }
  const scenario = decodeInvestmentScenario(result.data);
  if (!scenario) {
    return { success: false, error: "Die gespeicherten Eingaben konnten nicht bestätigt werden." };
  }
  revalidatePath("/app");
  revalidatePath("/app/steuervergleich");
  return { success: true, scenario };
}

export async function deleteInvestmentScenarioAction(
  id: string,
): Promise<DeleteInvestmentScenarioResult> {
  const viewer = await requireOrganization();
  if (!hasPermission(viewer.role, "tax.read")) {
    return { success: false, error: "Für das Löschen fehlen die Zugriffsrechte." };
  }
  if (!z.uuid().safeParse(id).success) {
    return { success: false, error: "Der Vergleich ist ungültig." };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("investment_scenarios")
    .delete()
    .eq("id", id)
    .eq("organization_id", viewer.organizationId)
    .select("id")
    .maybeSingle();
  if (error) {
    return { success: false, error: "Der Vergleich konnte nicht gelöscht werden. Bitte erneut versuchen." };
  }
  if (!data) {
    return { success: false, error: "Der Vergleich wurde nicht gefunden oder du hast keinen Zugriff mehr." };
  }
  revalidatePath("/app");
  revalidatePath("/app/steuervergleich");
  return { success: true, id: data.id };
}
