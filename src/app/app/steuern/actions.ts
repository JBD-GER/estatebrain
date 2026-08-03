"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrganization } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { calculateGermanRentalTaxEstimate2026 } from "@/lib/domain";
import { createClient } from "@/lib/supabase/server";

const profileSchema = z
  .object({
    calculationMode: z.enum(["automatic", "manual"]),
    manualEffectiveTaxRate: z.preprocess(
      (value) => (value === "" || value == null ? null : Number(value)),
      z.number().finite().min(0).max(100).nullable(),
    ),
    otherTaxableIncome: z.preprocess(
      (value) => (value === "" || value == null ? null : Number(value)),
      z.number().finite().min(0).nullable(),
    ),
    filingStatus: z.enum(["single", "joint"]),
    rentalIncomeComplete: z.boolean(),
  })
  .superRefine((input, context) => {
    if (
      input.calculationMode === "manual" &&
      input.manualEffectiveTaxRate === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["manualEffectiveTaxRate"],
        message: "Der effektive Steuersatz fehlt.",
      });
    }
    if (
      input.calculationMode === "automatic" &&
      input.otherTaxableIncome === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["otherTaxableIncome"],
        message: "Die weiteren steuerpflichtigen Einkünfte fehlen.",
      });
    }
    if (
      input.calculationMode === "automatic" &&
      !input.rentalIncomeComplete
    ) {
      context.addIssue({
        code: "custom",
        path: ["rentalIncomeComplete"],
        message: "Die Vertragsmieten müssen zuerst bestätigt werden.",
      });
    }
  });

async function taxableRentalResultCents(
  supabase: SupabaseClient,
  organizationId: string,
) {
  const today = new Date().toISOString().slice(0, 10);
  const taxYearEnd = "2026-12-31";
  const [propertiesResult, loansResult, depreciationResult] =
    await Promise.all([
      supabase
        .from("properties")
        .select("id")
        .eq("organization_id", organizationId)
        .eq("property_mode", "existing")
        .is("archived_at", null),
      supabase
        .from("loans")
        .select(
          "property_id, current_balance_cents, nominal_interest_rate, status",
        )
        .eq("organization_id", organizationId)
        .eq("status", "active")
        .is("archived_at", null),
      supabase
        .from("depreciation_assets")
        .select(
          "property_id, depreciable_basis_cents, annual_rate, manual_adjustment_cents, manual_annual_depreciation_cents, use_start_date",
        )
        .eq("organization_id", organizationId)
        .is("archived_at", null),
    ]);
  if (
    propertiesResult.error ||
    loansResult.error ||
    depreciationResult.error
  ) {
    throw new Error("Steuergrundlagen konnten nicht geladen werden.");
  }
  const properties = propertiesResult.data;
  const loans = loansResult.data;
  const depreciationAssets = depreciationResult.data;
  const propertyIds = (properties ?? []).map((property) => String(property.id));
  if (propertyIds.length === 0) return 0;

  const [unitsResult, expensesResult] = await Promise.all([
    supabase
      .from("units")
      .select("id")
      .eq("organization_id", organizationId)
      .in("property_id", propertyIds)
      .is("archived_at", null),
    supabase
      .from("expense_entries")
      .select("amount_cents, is_interest, is_principal")
      .eq("organization_id", organizationId)
      .in("property_id", propertyIds)
      .eq("payment_status", "paid")
      .eq("is_deductible", true)
      .eq("tax_year", 2026)
      .is("archived_at", null),
  ]);
  if (unitsResult.error || expensesResult.error) {
    throw new Error("Miet- oder Ausgabendaten konnten nicht geladen werden.");
  }
  const units = unitsResult.data;
  const expenses = expensesResult.data;
  const unitIds = (units ?? []).map((unit) => String(unit.id));
  const leaseResult = unitIds.length
    ? await supabase
        .from("leases")
        .select(
          "id, cold_rent_cents, ancillary_prepayment_cents, parking_rent_cents, other_rent_cents",
        )
        .eq("organization_id", organizationId)
        .in("unit_id", unitIds)
        .in("status", ["active", "notice_given"])
        .lte("starts_on", today)
        .or(`ends_on.is.null,ends_on.gte.${today}`)
        .is("archived_at", null)
    : { data: [] };
  if ("error" in leaseResult && leaseResult.error) {
    throw new Error("Mietverträge konnten nicht geladen werden.");
  }
  const leases = leaseResult.data;
  const leaseIds = (leases ?? []).map((lease) => String(lease.id));
  const scheduleResult = leaseIds.length
    ? await supabase
        .from("rent_schedules")
        .select(
          "lease_id, cold_rent_cents, ancillary_prepayment_cents, parking_rent_cents, other_rent_cents, valid_from, valid_until",
        )
        .eq("organization_id", organizationId)
        .in("lease_id", leaseIds)
        .lte("valid_from", today)
        .order("valid_from", { ascending: false })
    : { data: [] };
  if ("error" in scheduleResult && scheduleResult.error) {
    throw new Error("Miethistorie konnte nicht geladen werden.");
  }
  const schedules = scheduleResult.data;
  const currentScheduleByLease = new Map<string, Record<string, unknown>>();
  for (const schedule of schedules ?? []) {
    const leaseId = String(schedule.lease_id);
    if (
      !currentScheduleByLease.has(leaseId) &&
      (!schedule.valid_until || String(schedule.valid_until) >= today)
    ) {
      currentScheduleByLease.set(
        leaseId,
        schedule as unknown as Record<string, unknown>,
      );
    }
  }
  const annualRentalIncomeCents = (leases ?? []).reduce((sum, lease) => {
    const schedule = currentScheduleByLease.get(String(lease.id));
    return (
      sum +
      12 *
        (Number(schedule?.cold_rent_cents ?? lease.cold_rent_cents ?? 0) +
          Number(
            schedule?.ancillary_prepayment_cents ??
              lease.ancillary_prepayment_cents ??
              0,
          ) +
          Number(schedule?.parking_rent_cents ?? lease.parking_rent_cents ?? 0) +
          Number(schedule?.other_rent_cents ?? lease.other_rent_cents ?? 0))
    );
  }, 0);
  const annualInterestCents = (loans ?? [])
    .filter((loan) => propertyIds.includes(String(loan.property_id)))
    .reduce(
      (sum, loan) =>
        sum +
        Math.round(
          Number(loan.current_balance_cents ?? 0) *
            Number(loan.nominal_interest_rate ?? 0),
        ),
      0,
    );
  const annualDepreciationCents = (depreciationAssets ?? [])
    .filter(
      (asset) =>
        propertyIds.includes(String(asset.property_id)) &&
        String(asset.use_start_date) <= taxYearEnd,
    )
    .reduce((sum, asset) => {
      if (asset.manual_annual_depreciation_cents != null) {
        return sum + Number(asset.manual_annual_depreciation_cents);
      }
      const useStart = String(asset.use_start_date);
      const months = useStart < "2026-01-01" ? 12 : 13 - Number(useStart.slice(5, 7));
      return (
        sum +
        Math.round(
          Number(asset.depreciable_basis_cents ?? 0) *
            Number(asset.annual_rate ?? 0) *
            (months / 12),
        ) +
        Number(asset.manual_adjustment_cents ?? 0)
      );
    }, 0);
  const deductibleOperatingExpensesCents = (expenses ?? [])
    .filter((expense) => !expense.is_interest && !expense.is_principal)
    .reduce((sum, expense) => sum + Number(expense.amount_cents ?? 0), 0);

  return (
    annualRentalIncomeCents -
    annualInterestCents -
    annualDepreciationCents -
    deductibleOperatingExpensesCents
  );
}

export async function saveTaxProfileAction(formData: FormData) {
  const viewer = await requireOrganization();
  if (!hasPermission(viewer.role, "tax.manage")) {
    redirect("/app/steuern?result=forbidden");
  }
  const parsed = profileSchema.safeParse({
    calculationMode: formData.get("calculationMode"),
    manualEffectiveTaxRate: formData.get("manualEffectiveTaxRate"),
    otherTaxableIncome: formData.get("otherTaxableIncome"),
    filingStatus: formData.get("filingStatus"),
    rentalIncomeComplete: formData.get("rentalIncomeComplete") === "on",
  });
  if (!parsed.success) redirect("/app/steuern?result=invalid");

  const supabase = await createClient();
  const dynamicSupabase = supabase as unknown as SupabaseClient;
  let taxableRentalCents = 0;
  if (parsed.data.calculationMode === "automatic") {
    try {
      taxableRentalCents = await taxableRentalResultCents(
        dynamicSupabase,
        viewer.organizationId,
      );
    } catch {
      redirect("/app/steuern?result=calculation-failed");
    }
  }
  const automaticEstimate =
    parsed.data.calculationMode === "automatic"
      ? calculateGermanRentalTaxEstimate2026({
          otherTaxableIncomeCents: Math.round(
            (parsed.data.otherTaxableIncome ?? 0) * 100,
          ),
          taxableRentalResultCents: taxableRentalCents,
          assessmentType:
            parsed.data.filingStatus === "joint" ? "joint" : "individual",
        })
      : null;
  const payload = {
    organization_id: viewer.organizationId,
    user_id: viewer.userId,
    calculation_mode: parsed.data.calculationMode,
    effective_tax_rate:
      automaticEstimate?.effectiveTaxRate ??
      (parsed.data.manualEffectiveTaxRate ?? 0) / 100,
    marginal_tax_rate: automaticEstimate?.marginalTaxRate ?? null,
    other_taxable_income_cents:
      parsed.data.otherTaxableIncome === null
        ? null
        : Math.round(parsed.data.otherTaxableIncome * 100),
    assumed_taxable_income_cents:
      parsed.data.otherTaxableIncome === null
        ? null
        : Math.round(parsed.data.otherTaxableIncome * 100),
    assessment_type:
      parsed.data.filingStatus === "joint" ? "joint" : "individual",
    rental_inputs_confirmed_at:
      parsed.data.calculationMode === "automatic"
        ? new Date().toISOString()
        : null,
    tariff_year: parsed.data.calculationMode === "automatic" ? 2026 : null,
    tariff_version:
      parsed.data.calculationMode === "automatic"
        ? "de_estg_32a_2026_v1"
        : null,
    calculations_enabled: true,
    created_by: viewer.userId,
  };
  const { error } = await dynamicSupabase
    .from("tax_profiles")
    .upsert(payload, { onConflict: "organization_id,user_id" });
  if (error) redirect("/app/steuern?result=failed");

  revalidatePath("/app");
  revalidatePath("/app/steuern");
  redirect("/app/steuern?result=saved");
}
