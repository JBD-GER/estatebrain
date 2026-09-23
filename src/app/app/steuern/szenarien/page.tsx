import type { Metadata } from "next";
import { InvestmentWorkspace } from "@/components/tax/investment-workspace";
import { TaxNavigation } from "@/components/tax/tax-navigation";
import { requireOrganization } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { getInvestmentScenarios } from "@/lib/tax/scenario-storage";
import { getInvestmentPropertyOptions } from "@/lib/tax/portfolio-options";

export const metadata: Metadata = { title: "Steuerszenarien & Abschreibung" };

export default async function TaxScenariosPage() {
  const viewer = await requireOrganization();
  if (!hasPermission(viewer.role, "tax.read")) return <p>Für die Steuerübersicht fehlen die Zugriffsrechte.</p>;
  const [{ scenarios, error }, portfolio] = await Promise.all([getInvestmentScenarios(), getInvestmentPropertyOptions()]);
  return <div><TaxNavigation active="scenarios" /><InvestmentWorkspace key={viewer.organizationId} initialScenarios={scenarios} storageError={error} portfolioProperties={portfolio.properties} portfolioError={portfolio.error} skippedProperties={portfolio.skippedCount} /></div>;
}
