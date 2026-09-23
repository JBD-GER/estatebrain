"use server";

import { z, type ZodType } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireOrganization } from "@/lib/auth/dal";
import { hasPermission, type Permission } from "@/lib/auth/permissions";
import {
  calculateAcquisitionAllocation,
  DomainValidationError,
} from "@/lib/domain";
import { getModuleDefinition, type ModuleField } from "@/lib/modules";
import { editableModules } from "@/lib/modules/lifecycle";
import type { Json } from "@/types/database";

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

  const recordId = formData.get("recordId");
  const isUpdate = typeof recordId === "string" && recordId.length > 0;
  if (isUpdate && (!z.uuid().safeParse(recordId).success || !editableModules.has(slug))) {
    return { status: "error", message: "Dieser Datensatz kann nicht bearbeitet werden." };
  }
  const definition = getModuleDefinition(slug);
  if (!definition || (!isUpdate && definition.readOnly) || definition.fields.length === 0) {
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
  let derivedValues: Record<string, unknown> = {};
  if (
    slug === "immobilien" &&
    typeof parsedValues.rentable_area_sqm === "number" &&
    parsedValues.rentable_area_sqm <= 0
  ) {
    semanticErrors.rentable_area_sqm = [
      "Die vermietbare Fläche muss größer als 0 sein.",
    ];
  }
  if (slug === "immobilien") {
    const constructionYear = Number(parsedValues.construction_year);
    if (
      !Number.isInteger(constructionYear) ||
      constructionYear < 1000 ||
      constructionYear > 2200
    ) {
      semanticErrors.construction_year = [
        "Bitte gib ein gültiges vierstelliges Baujahr an.",
      ];
    }

    const purchasePriceCents = Number(parsedValues.purchase_price_cents);
    if (!Number.isSafeInteger(purchasePriceCents) || purchasePriceCents <= 0) {
      semanticErrors.purchase_price_cents = [
        "Der Kaufpreis muss größer als 0 sein.",
      ];
    }

    const landAreaSquareMeters = Number(parsedValues.land_area_sqm);
    if (!Number.isFinite(landAreaSquareMeters) || landAreaSquareMeters <= 0) {
      semanticErrors.land_area_sqm = [
        "Die Grundstücksfläche muss größer als 0 sein.",
      ];
    }

    if (Object.keys(semanticErrors).length === 0) {
      try {
        const allocation = calculateAcquisitionAllocation({
          purchasePriceCents,
          landAreaSquareMeters,
          standardLandValueCentsPerSquareMeter: Number(
            parsedValues.standard_land_value_cents_per_sqm,
          ),
          landOwnershipShare:
            typeof parsedValues.land_ownership_share === "number"
              ? parsedValues.land_ownership_share
              : 1,
          realEstateTransferTaxRate: Number(
            parsedValues.real_estate_transfer_tax_rate,
          ),
          brokerFeeCents: Number(parsedValues.broker_fee_cents),
          notaryAndLandRegistryFeeCents: Number(
            parsedValues.notary_fee_cents,
          ) + Number(
            parsedValues.land_registry_fee_cents,
          ),
          otherAcquisitionCostsCents: Number(
            parsedValues.other_acquisition_costs_cents,
          ),
        });

        derivedValues = {
          land_value_cents: allocation.landValueCents,
          building_purchase_price_cents:
            allocation.buildingPurchasePriceCents,
          real_estate_transfer_tax_cents:
            allocation.realEstateTransferTaxCents,
          acquisition_costs_cents: allocation.acquisitionCostsCents,
          total_acquisition_cost_cents:
            allocation.totalAcquisitionCostCents,
          building_value_cents: allocation.buildingValueCents,
          current_market_value_cents: purchasePriceCents,
          market_value_status: "estimated",
          market_value_source: "purchase_price_proxy",
        };
      } catch (error) {
        if (error instanceof DomainValidationError) {
          const domainFieldToFormField: Record<string, string> = {
            purchasePriceCents: "purchase_price_cents",
            landAreaSquareMeters: "land_area_sqm",
            standardLandValueCentsPerSquareMeter:
              "standard_land_value_cents_per_sqm",
            landOwnershipShare: "land_ownership_share",
            realEstateTransferTaxRate: "real_estate_transfer_tax_rate",
            brokerFeeCents: "broker_fee_cents",
            notaryAndLandRegistryFeeCents:
              "notary_fee_cents",
            otherAcquisitionCostsCents:
              "other_acquisition_costs_cents",
          };
          const field = error.field
            ? domainFieldToFormField[error.field]
            : undefined;
          semanticErrors[field ?? "purchase_price_cents"] = [error.message];
        } else {
          throw error;
        }
      }
    }
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
  if (slug === "mieter") {
    if(parsedValues.tenant_type === "company" && !parsedValues.company_name) semanticErrors.company_name=["Bitte den Firmennamen angeben."];
    if(parsedValues.tenant_type === "person" && !parsedValues.first_name && !parsedValues.last_name) semanticErrors.last_name=["Bitte einen Namen angeben."];
    if(parsedValues.email && !z.email().safeParse(parsedValues.email).success) semanticErrors.email=["Bitte eine gültige E-Mail-Adresse angeben."];
  }
  if (slug === "sanierungen" && parsedValues.status === "done" && !parsedValues.actual_end_date) {
    semanticErrors.actual_end_date = ["Bitte das Abschlussdatum angeben."];
  }
  if (slug === "mietverhaeltnisse") {
    if (parsedValues.ends_on && String(parsedValues.ends_on) < String(parsedValues.starts_on)) semanticErrors.ends_on = ["Das Mietende liegt vor dem Mietbeginn."];
    if (!Number.isInteger(parsedValues.due_day) || Number(parsedValues.due_day) < 1 || Number(parsedValues.due_day) > 31) semanticErrors.due_day = ["Bitte einen Tag von 1 bis 31 angeben."];
    if (!String(parsedValues.rent_effective_from).endsWith("-01")) semanticErrors.rent_effective_from = ["Bitte einen Monatsbeginn auswählen."];
    if (parsedValues.status === "ended" && !parsedValues.ends_on) semanticErrors.ends_on = ["Ein beendeter Vertrag benötigt ein Mietende."];
    if (parsedValues.ancillary_charge_type === "none" && parsedValues.ancillary_prepayment_cents !== 0) semanticErrors.ancillary_prepayment_cents = ["Ohne Nebenkosten muss der Betrag 0 sein."];
  }
  if (Object.keys(semanticErrors).length > 0) {
    return {
      status: "error",
      message: "Bitte prüfe die markierten Angaben.",
      errors: semanticErrors,
    };
  }

  if (isUpdate && slug === "immobilien") {
    delete derivedValues.current_market_value_cents;
    delete derivedValues.market_value_status;
    delete derivedValues.market_value_source;
  }
  const values = Object.fromEntries(Object.entries(parsedValues).map(([key, value]) => [key, value ?? (key === "land_ownership_share" ? 1 : definition.fields.find((field) => field.name === key)?.type === "money" ? 0 : null)]));
  const payload: Record<string, unknown> = {
    ...(isUpdate ? {} : defaultsForModule(slug)), ...values, ...derivedValues,
    ...(isUpdate ? {} : { organization_id: viewer.organizationId, created_by: viewer.userId }),
  };
  const supabase = await createClient();
  const dynamicSupabase = supabase as unknown as SupabaseClient;
  const updatedAt = formData.get("updatedAt");
  if (isUpdate && (typeof updatedAt !== "string" || !updatedAt)) {
    return { status: "error", message: "Bitte die Seite neu laden und erneut bearbeiten." };
  }
  const result = isUpdate
    ? slug === "mietverhaeltnisse"
      ? await dynamicSupabase.rpc("update_lease_contract", {
          p_organization_id: viewer.organizationId, p_lease_id: recordId,
          p_updated_at: updatedAt, p_payload: values as Json,
        })
      : await dynamicSupabase.from(definition.table).update(payload)
          .eq("id", recordId).eq("organization_id", viewer.organizationId)
          .eq("updated_at", updatedAt).select("id").maybeSingle()
    : slug === "markt"
      ? await supabase.rpc("create_valuation", {
          p_organization_id: viewer.organizationId,
          p_property_id: String(parsedValues.property_id),
          p_valued_on: String(parsedValues.valued_on),
          p_market_value_cents: Number(parsedValues.market_value_cents),
          p_source_type: String(parsedValues.source_type),
          p_source_name: String(parsedValues.source_name),
        })
      : await dynamicSupabase.from(definition.table).insert(payload).select("id").single();
  const error = result.error;
  if (isUpdate && !error && !result.data) return { status: "error", message: "Der Eintrag wurde inzwischen geändert oder gelöscht. Bitte neu laden." };

  if (error) {
    return {
      status: "error",
      message:
        "Der Datensatz konnte nicht gespeichert werden. Bitte prüfe Pflichtangaben und Berechtigungen.",
    };
  }

  revalidatePath(`/app/${slug}`);
  revalidatePath("/app", "layout");
  return {
    status: "success",
    message: "Gespeichert. Die Auswertung wurde aktualisiert.",
  };
}

export async function deleteModuleRecordAction(input: {module: string; id: string; updatedAt?: string; valuationReport?: boolean}): Promise<CreateRecordState> {
  const parsed = z.object({module: z.string(), id: z.uuid(), updatedAt: z.string().optional(), valuationReport: z.boolean().optional()}).safeParse(input);
  if (!parsed.success || (!editableModules.has(input.module) && input.module !== "belege") || (input.valuationReport && input.module !== "markt")) return {status: "error", message: "Ungültiger Datensatz."};
  const viewer = await requireOrganization();
  if (!hasPermission(viewer.role, requiredPermission(input.module)) || (input.module === "belege" && !hasPermission(viewer.role, "bookkeeping.write"))) return {status: "error", message: "Deine Rolle darf diesen Eintrag nicht löschen."};
  const supabase = await createClient();
  const {error} = input.module === "markt" ? await (supabase as unknown as SupabaseClient).rpc("delete_property_valuation", {
    p_organization_id: viewer.organizationId, p_valuation_id: input.valuationReport ? null : input.id,
    p_report_id: input.valuationReport ? input.id : null, p_updated_at: input.updatedAt || null,
  }) : await (supabase as unknown as SupabaseClient).rpc("archive_workspace_record", {
    p_organization_id: viewer.organizationId, p_module: input.module, p_record_id: input.id,
    p_updated_at: input.updatedAt ?? null,
  });
  if (error) return {status: "error", message: error.code === "55000" ? "Diese Bewertungsanfrage läuft noch oder ist unbestätigt. Bitte zuerst den Abschluss abwarten oder den Status prüfen lassen." : error.code === "40001" ? "Der Eintrag wurde inzwischen geändert. Bitte lade ihn neu, bevor du ihn löschst." : error.message.includes("active units") ? "Zur Immobilie gehören noch Einheiten. Entferne zuerst deren Mietverhältnisse und anschließend die Einheiten." : error.message.includes("active leases") ? "Es bestehen noch zugeordnete Mietverhältnisse. Entferne zuerst diese Verträge; zugehörige Nachweise bleiben erhalten." : "Löschen nicht möglich. Bitte verknüpfte Einträge und deine Berechtigung prüfen."};
  revalidatePath("/app", "layout");
  return {status: "success", message: "Eintrag gelöscht. Die Auswertungen wurden aktualisiert."};
}
