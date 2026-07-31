"use server";

import { revalidatePath } from "next/cache";
import { requireOrganization } from "@/lib/auth/dal";
import { isCurrentTenantLease } from "@/lib/portal/lease";
import { createClient } from "@/lib/supabase/server";
import {
  parseTenantConversationFormData,
  parseTenantMaintenanceRequestFormData,
  parseTenantReplyFormData,
} from "@/lib/validation/tenant-portal";

export type TenantPortalActionState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Record<string, string[]>;
};

type PortalError = {
  code?: string;
};

function actionError(message: string): TenantPortalActionState {
  return { status: "error", message };
}

function databaseErrorMessage(error: PortalError | null, fallback: string) {
  switch (error?.code) {
    case "42501":
      return "Du bist für diese Aktion nicht berechtigt.";
    case "P0002":
      return "Das aktive Mietverhältnis oder die Unterhaltung ist nicht mehr verfügbar. Bitte aktualisiere die Seite.";
    case "22023":
    case "23514":
      return "Die Angaben sind ungültig. Bitte prüfe das Formular.";
    default:
      return fallback;
  }
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

async function getTenantScope() {
  const viewer = await requireOrganization();
  if (viewer.role !== "tenant") {
    return {
      ok: false as const,
      state: actionError("Nur Mieterkonten können das Mieterportal verwenden."),
    };
  }

  const supabase = await createClient();
  const { data: contexts, error } = await supabase.rpc(
    "get_tenant_portal_context",
    { p_organization_id: viewer.organizationId },
  );
  if (error) {
    return {
      ok: false as const,
      state: actionError(
        databaseErrorMessage(
          error,
          "Dein Mieterprofil konnte nicht geladen werden. Bitte versuche es erneut.",
        ),
      ),
    };
  }

  const today = dateInBerlin();
  const context = contexts?.find((item) => isCurrentTenantLease(item, today));
  if (!context) {
    return {
      ok: false as const,
      state: actionError(
        "Für diese Aktion brauchst du ein aktuell aktives Mietverhältnis.",
      ),
    };
  }

  return {
    ok: true as const,
    supabase,
    viewer,
    leaseId: context.lease_id,
  };
}

export async function createTenantConversationAction(
  _state: TenantPortalActionState,
  formData: FormData,
): Promise<TenantPortalActionState> {
  const parsed = parseTenantConversationFormData(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Bitte prüfe die markierten Angaben.",
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const scope = await getTenantScope();
  if (!scope.ok) return scope.state;

  const { error } = await scope.supabase.rpc(
    "create_tenant_portal_conversation",
    {
      p_organization_id: scope.viewer.organizationId,
      p_lease_id: scope.leaseId,
      p_subject: parsed.data.subject,
      p_category: parsed.data.category,
      p_body: parsed.data.body,
    },
  );
  if (error) {
    return actionError(
      databaseErrorMessage(
        error,
        "Die Nachricht konnte nicht gesendet werden. Es wurden keine Teildaten gespeichert.",
      ),
    );
  }

  revalidatePath("/portal");
  return {
    status: "success",
    message: "Deine Nachricht wurde an die Verwaltung gesendet.",
  };
}

export async function replyToConversationAction(
  _state: TenantPortalActionState,
  formData: FormData,
): Promise<TenantPortalActionState> {
  const parsed = parseTenantReplyFormData(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Bitte prüfe deine Antwort.",
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const scope = await getTenantScope();
  if (!scope.ok) return scope.state;

  const { error } = await scope.supabase.rpc(
    "reply_tenant_portal_conversation",
    {
      p_organization_id: scope.viewer.organizationId,
      p_conversation_id: parsed.data.conversationId,
      p_body: parsed.data.body,
    },
  );
  if (error) {
    return actionError(
      databaseErrorMessage(
        error,
        "Deine Antwort konnte nicht gesendet werden. Bitte versuche es erneut.",
      ),
    );
  }

  revalidatePath("/portal");
  return {
    status: "success",
    message: "Deine Antwort wurde gesendet.",
  };
}

export async function createMaintenanceRequestAction(
  _state: TenantPortalActionState,
  formData: FormData,
): Promise<TenantPortalActionState> {
  const parsed = parseTenantMaintenanceRequestFormData(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Bitte prüfe die markierten Angaben.",
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const scope = await getTenantScope();
  if (!scope.ok) return scope.state;

  const { error } = await scope.supabase.rpc(
    "create_tenant_portal_maintenance_request",
    {
      p_organization_id: scope.viewer.organizationId,
      p_lease_id: scope.leaseId,
      p_title: parsed.data.title,
      p_description: parsed.data.description,
      p_category: parsed.data.category,
    },
  );
  if (error) {
    return actionError(
      databaseErrorMessage(
        error,
        "Das Anliegen konnte nicht gespeichert werden. Bitte versuche es erneut.",
      ),
    );
  }

  revalidatePath("/portal");
  revalidatePath("/app/aufgaben");
  revalidatePath("/app");
  return {
    status: "success",
    message: "Dein Anliegen wurde an die Verwaltung übermittelt.",
  };
}
