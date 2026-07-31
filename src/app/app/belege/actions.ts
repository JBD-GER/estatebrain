"use server";

import { revalidatePath } from "next/cache";
import { requireOrganization } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { parseDocumentReviewFormData } from "@/lib/documents/review";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

export type DocumentReviewState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Record<string, string[] | undefined>;
};

export async function reviewDocumentAction(
  _previousState: DocumentReviewState,
  formData: FormData,
): Promise<DocumentReviewState> {
  const viewer = await requireOrganization();
  if (
    !hasPermission(viewer.role, "documents.write") ||
    viewer.role === "employee"
  ) {
    return {
      status: "error",
      message:
        "Für die verbindliche Belegprüfung fehlt die Buchhaltungsberechtigung.",
    };
  }

  const parsed = parseDocumentReviewFormData(formData);
  if (!parsed.success) {
    return {
      status: "error",
      message: "Bitte die markierten Angaben prüfen.",
      errors: parsed.error.flatten().fieldErrors,
    };
  }

  const { documentId, ...payload } = parsed.data;
  const supabase = await createClient();
  const { data: expenseId, error } = await supabase.rpc(
    "review_document_expense",
    {
      p_organization_id: viewer.organizationId,
      p_document_id: documentId,
      p_payload: payload as Json,
    },
  );

  if (error || !expenseId) {
    return {
      status: "error",
      message:
        "Die Prüfung konnte nicht gespeichert werden. Bitte Zuordnungen und Beträge erneut prüfen.",
    };
  }

  revalidatePath("/app/belege");
  revalidatePath("/app/ausgaben");
  revalidatePath("/app");

  return {
    status: "success",
    message: "Beleg geprüft und Ausgabe vollständig vorbereitet.",
  };
}
