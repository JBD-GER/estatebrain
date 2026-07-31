"use server";

import { z, type ZodType } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganization } from "@/lib/auth/dal";
import { hasPermission, type Permission } from "@/lib/auth/permissions";
import { getModuleDefinition, type ModuleField } from "@/lib/modules";

export type CreateRecordState = {
  status: "idle" | "success" | "error";
  message?: string;
  errors?: Record<string, string[]>;
};

function optional<T extends ZodType>(schema: T, required?: boolean) {
  if (required) return schema;
  return z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    schema.optional(),
  );
}

function schemaForField(field: ModuleField): ZodType {
  switch (field.type) {
    case "money":
      return optional(
        z.coerce
          .number()
          .finite()
          .min(0, "Der Betrag darf nicht negativ sein.")
          .transform((value) => Math.round(value * 100)),
        field.required,
      );
    case "number":
      return optional(
        field.percentageRate
          ? z.coerce
              .number()
              .finite("Bitte gib eine gültige Zahl ein.")
              .min(0)
              .max(100)
              .transform((value) => value / 100)
          : z.coerce
              .number()
              .finite("Bitte gib eine gültige Zahl ein.")
              .min(0, "Der Wert darf nicht negativ sein."),
        field.required,
      );
    case "date":
      return optional(
        z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/, "Bitte gib ein gültiges Datum ein.")
          .refine((value) => {
            const parsed = new Date(`${value}T00:00:00.000Z`);
            return (
              !Number.isNaN(parsed.valueOf()) &&
              parsed.toISOString().slice(0, 10) === value
            );
          }, "Bitte gib ein gültiges Kalenderdatum ein."),
        field.required,
      );
    case "select": {
      if (field.relation) {
        return optional(z.string().uuid("Bitte triff eine Auswahl."), field.required);
      }
      const values = field.options?.map((option) => option.value) ?? [];
      return optional(
        z.string().refine((value) => values.includes(value), "Ungültige Auswahl."),
        field.required,
      );
    }
    case "textarea":
    case "text":
    default:
      return optional(
        z
          .string()
          .trim()
          .min(field.required ? 1 : 0, "Dieses Feld ist erforderlich.")
          .max(
            ["subject", "title"].includes(field.name)
              ? 240
              : field.name === "name"
                ? 160
                : 2_000,
            "Der Text ist zu lang.",
          ),
        field.required,
      );
  }
}

function requiredPermission(slug: string): Permission {
  if (["einnahmen", "ausgaben"].includes(slug)) {
    return "bookkeeping.write";
  }
  if (slug === "finanzierungen") return "financing.write";
  if (slug === "kommunikation") return "messages.write";
  if (slug === "aufgaben") return "tasks.write";
  if (slug === "belege") return "documents.write";
  return "portfolio.write";
}

function defaultsForModule(slug: string) {
  switch (slug) {
    case "immobilien":
      return { country_code: "DE", status: "active" };
    case "einheiten":
      return { unit_type: "apartment" };
    case "einnahmen":
      return { payment_status: "paid" };
    case "ausgaben":
      return { payment_status: "paid", document_status: "missing" };
    case "finanzierungen":
      return { status: "active" };
    case "sanierungen":
      return { status: "open" };
    case "kommunikation":
      return { status: "open", last_message_at: new Date().toISOString() };
    default:
      return {};
  }
}

export async function createModuleRecordAction(
  _state: CreateRecordState,
  formData: FormData,
): Promise<CreateRecordState> {
  const slug = formData.get("module");
  if (typeof slug !== "string") {
    return { status: "error", message: "Unbekannter Bereich." };
  }

  const definition = getModuleDefinition(slug);
  if (!definition || definition.readOnly || definition.fields.length === 0) {
    return {
      status: "error",
      message: "In diesem Bereich ist keine direkte Anlage vorgesehen.",
    };
  }

  const viewer = await requireOrganization();
  if (!hasPermission(viewer.role, requiredPermission(slug))) {
    return {
      status: "error",
      message: "Deine Rolle darf in diesem Bereich keine Daten anlegen.",
    };
  }

  const shape: Record<string, ZodType> = {};
  for (const field of definition.fields) {
    shape[field.name] = schemaForField(field);
  }
  const schema = z.object(shape);
  const raw = Object.fromEntries(
    definition.fields.map((field) => [field.name, formData.get(field.name)]),
  );
  const parsed = schema.safeParse(raw);

  if (!parsed.success) {
    return {
      status: "error",
      message: "Bitte prüfe die markierten Angaben.",
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const parsedValues = parsed.data as Record<string, unknown>;
  const semanticErrors: Record<string, string[]> = {};
  if (
    slug === "immobilien" &&
    typeof parsedValues.rentable_area_sqm === "number" &&
    parsedValues.rentable_area_sqm <= 0
  ) {
    semanticErrors.rentable_area_sqm = [
      "Die vermietbare Fläche muss größer als 0 sein.",
    ];
  }
  if (slug === "einheiten") {
    if (
      typeof parsedValues.area_sqm === "number" &&
      parsedValues.area_sqm <= 0
    ) {
      semanticErrors.area_sqm = ["Die Fläche muss größer als 0 sein."];
    }
    if (
      typeof parsedValues.rooms === "number" &&
      parsedValues.rooms <= 0
    ) {
      semanticErrors.rooms = ["Die Zimmerzahl muss größer als 0 sein."];
    }
  }
  if (slug === "finanzierungen") {
    const original = Number(parsedValues.original_principal_cents);
    const balance = Number(parsedValues.current_balance_cents);
    if (!Number.isFinite(original) || original <= 0) {
      semanticErrors.original_principal_cents = [
        "Der ursprüngliche Darlehensbetrag muss größer als 0 sein.",
      ];
    }
    if (
      Number.isFinite(original) &&
      Number.isFinite(balance) &&
      balance > original
    ) {
      semanticErrors.current_balance_cents = [
        "Die Restschuld darf den ursprünglichen Betrag nicht übersteigen.",
      ];
    }
  }
  if (Object.keys(semanticErrors).length > 0) {
    return {
      status: "error",
      message: "Bitte prüfe die markierten Angaben.",
      errors: semanticErrors,
    };
  }

  const payload = {
    ...defaultsForModule(slug),
    ...parsed.data,
    organization_id: viewer.organizationId,
    created_by: viewer.userId,
  };
  const supabase = await createClient();
  const dynamicSupabase = supabase as unknown as SupabaseClient;
  const { error } = await dynamicSupabase
    .from(definition.table)
    .insert(payload as never);

  if (error) {
    return {
      status: "error",
      message:
        "Der Datensatz konnte nicht gespeichert werden. Bitte prüfe Pflichtangaben und Berechtigungen.",
    };
  }

  revalidatePath(`/app/${slug}`);
  revalidatePath("/app");
  return {
    status: "success",
    message: "Gespeichert. Die Auswertung wurde aktualisiert.",
  };
}
