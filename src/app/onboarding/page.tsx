import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOutAction } from "@/app/(auth)/actions";
import { BrandLogo } from "@/components/brand/logo";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { Button } from "@/components/ui/button";
import { requireViewer } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import type { OnboardingInput } from "@/lib/validation/onboarding";

export const metadata: Metadata = { title: "Portfolio einrichten" };

const currentYear = new Date().getFullYear();

function percentFromFraction(value: number | null | undefined) {
  return value == null ? null : Number(value) * 100;
}

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ resume?: string }>;
}) {
  const viewer = await requireViewer();
  const resumeRequested = (await searchParams).resume === "1";
  let initialOrganization:
    | OnboardingInput["organization"]
    | undefined;
  let initialTax: OnboardingInput["tax"] | undefined;
  let resumeMode = false;

  if (viewer.organizationId) {
    if (!resumeRequested || viewer.role !== "owner") redirect("/app");

    const supabase = await createClient();
    const [
      organizationResult,
      taxProfileResult,
      taxYearResult,
      propertyCountResult,
    ] = await Promise.all([
      supabase
        .from("organizations")
        .select("name, kind, street, postal_code, city, default_currency")
        .eq("id", viewer.organizationId)
        .maybeSingle(),
      supabase
        .from("tax_profiles")
        .select(
          "marginal_tax_rate, effective_tax_rate, church_tax_enabled, solidarity_surcharge_enabled, assumed_taxable_income_cents, assessment_type, calculations_enabled",
        )
        .eq("organization_id", viewer.organizationId)
        .eq("user_id", viewer.userId)
        .maybeSingle(),
      supabase
        .from("tax_years")
        .select("year")
        .eq("organization_id", viewer.organizationId)
        .order("year", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("properties")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", viewer.organizationId),
    ]);

    if (
      organizationResult.error ||
      taxProfileResult.error ||
      taxYearResult.error ||
      propertyCountResult.error ||
      !organizationResult.data ||
      (propertyCountResult.count ?? 0) > 0
    ) {
      redirect("/app");
    }

    const organization = organizationResult.data;
    const taxProfile = taxProfileResult.data;
    initialOrganization = {
      name: organization.name,
      organizationType:
        organization.kind === "company" ? "company" : "private",
      street: organization.street ?? "",
      postalCode: organization.postal_code ?? "",
      city: organization.city ?? "",
      currency: "EUR",
      taxYear: Number(taxYearResult.data?.year ?? currentYear),
    };
    initialTax = {
      calculationMode:
        (taxProfile?.calculations_enabled ?? true) &&
        taxProfile?.assumed_taxable_income_cents != null
          ? "automatic"
          : "manual",
      manualEffectiveTaxRate:
        percentFromFraction(taxProfile?.effective_tax_rate) ??
        percentFromFraction(taxProfile?.marginal_tax_rate) ??
        0,
      otherTaxableIncome:
        taxProfile?.assumed_taxable_income_cents == null
          ? null
          : Number(taxProfile.assumed_taxable_income_cents) / 100,
      rentalIncomeComplete: false,
      churchTax: taxProfile?.church_tax_enabled ?? false,
      solidaritySurcharge:
        taxProfile?.solidarity_surcharge_enabled ?? false,
      filingStatus:
        taxProfile?.assessment_type === "joint" ? "joint" : "single",
    };
    resumeMode = true;
  }

  return (
    <main className="min-h-screen">
      <header className="border-b bg-background/90 px-5 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <BrandLogo />
          <form action={signOutAction}>
            <Button type="submit" variant="ghost" size="sm">
              <LogOut aria-hidden="true" />
              Abmelden
            </Button>
          </form>
        </div>
      </header>
      <div className="px-5 py-10 sm:px-8 sm:py-14">
        <OnboardingWizard
          fullName={viewer.fullName}
          userId={viewer.userId}
          initialOrganization={initialOrganization}
          initialTax={initialTax}
          resumeMode={resumeMode}
        />
      </div>
    </main>
  );
}
