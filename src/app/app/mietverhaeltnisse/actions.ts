"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireOrganization } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  parseTenantLeaseFormData,
  toCreateTenantLeasePayload,
} from "@/lib/validation/tenant-lease";

export type CreateTenantLeaseState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Record<string, string[]>;
};

function rentResult(result: string, count?: number): never {
  const search = new URLSearchParams({ result });
  if (typeof count === "number") search.set("count", String(count));
  redirect(`/app/mietverhaeltnisse?${search.toString()}`);
}

function currentBerlinMonth() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  if (!year || !month) throw new Error("Aktueller Abrechnungsmonat fehlt.");
  return `${year}-${month}-01`;
}

export async function generateCurrentMonthRentClaimsAction() {
  const viewer = await requireOrganization();
  const canGenerate =
    hasPermission(viewer.role, "portfolio.write") ||
    hasPermission(viewer.role, "bookkeeping.write");
  if (!canGenerate) rentResult("forbidden");

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_monthly_rent_claims", {
    p_organization_id: viewer.organizationId,
    p_period: currentBerlinMonth(),
  });
  if (error) rentResult("failed");

  revalidatePath("/app/mietverhaeltnisse");
  revalidatePath("/app");
  rentResult("generated", data);
}

function leaseCreationError(code: string | undefined) {
  switch (code) {
    case "42501":
      return "Deine Rolle darf keine Mieter und Mietverhältnisse anlegen.";
    case "23505":
      return "Die Einheit ist nicht mehr verfügbar. Bitte aktualisiere die Seite und wähle eine andere Einheit.";
    case "P0002":
      return "Immobilie und Einheit passen nicht zusammen oder sind nicht mehr verfügbar.";
    case "22023":
    case "23514":
      return "Die Vertragsdaten sind ungültig. Bitte prüfe alle Angaben.";
    default:
      return "Mieter und Mietverhältnis konnten nicht gespeichert werden. Es wurden keine Teildaten angelegt.";
  }
}

export async function createTenantLeaseAction(
  _state: CreateTenantLeaseState,
  formData: FormData,
): Promise<CreateTenantLeaseState> {
  const viewer = await requireOrganization();
  if (!hasPermission(viewer.role, "portfolio.write")) {
    return {
      status: "error",
      message: "Deine Rolle darf keine Mieter und Mietverhältnisse anlegen.",
    };
  }

  const parsed = parseTenantLeaseFormData(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Bitte prüfe die markierten Angaben.",
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_tenant_lease", {
    p_organization_id: viewer.organizationId,
    p_payload: toCreateTenantLeasePayload(parsed.data),
  });

  if (error) {
    return {
      status: "error",
      message: leaseCreationError(error.code),
    };
  }

  revalidatePath("/app/mietverhaeltnisse");
  revalidatePath("/app/einheiten");
  revalidatePath("/app");
  return {
    status: "success",
    message:
      "Mieter, Mietvertrag und erster Mietplan wurden vollständig angelegt.",
  };
}
