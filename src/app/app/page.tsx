import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Building2, Settings2 } from "lucide-react";
import { Dashboard } from "@/components/app/dashboard";
import { InvestmentWorkspace } from "@/components/tax/investment-workspace";
import { requireOrganization } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { getLiveDashboardSnapshot } from "@/lib/data/dashboard";
import { getInvestmentScenarios } from "@/lib/tax/scenario-storage";
import { getInvestmentPropertyOptions } from "@/lib/tax/portfolio-options";

export const metadata: Metadata = { title: "Steuer-Dashboard" };

export default async function DashboardPage() {
  const viewer = await requireOrganization();
  if (!hasPermission(viewer.role, "tax.read")) {
    const snapshot = await getLiveDashboardSnapshot();
    return <Dashboard snapshot={snapshot} />;
  }
  const [{ scenarios, error }, portfolio] = await Promise.all([getInvestmentScenarios(), getInvestmentPropertyOptions()]);
  return <div>
    <nav aria-label="Dashboard-Bereiche" className="mb-7 flex flex-wrap items-center gap-2 border-b pb-4 text-xs">
      <Link href="/app" aria-current="page" className="rounded-lg bg-primary px-4 py-2.5 font-semibold text-primary-foreground">Steuer-Dashboard</Link>
      <Link href="/app/uebersicht" className="flex items-center gap-2 rounded-lg px-4 py-2.5 text-muted-foreground hover:bg-secondary"><Building2 className="size-3.5" />Portfolio-Übersicht</Link>
      <Link href="/app/steuern" className="ml-auto flex items-center gap-2 rounded-lg px-3 py-2.5 text-muted-foreground hover:bg-secondary"><Settings2 className="size-3.5" />Steuerprofil<ArrowUpRight className="size-3" /></Link>
    </nav>
    <InvestmentWorkspace key={viewer.organizationId} initialScenarios={scenarios} storageError={error} portfolioProperties={portfolio.properties} portfolioError={portfolio.error} skippedProperties={portfolio.skippedCount} />
  </div>;
}
