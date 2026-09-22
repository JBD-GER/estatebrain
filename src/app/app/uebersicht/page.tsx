import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Dashboard } from "@/components/app/dashboard";
import { getLiveDashboardSnapshot } from "@/lib/data/dashboard";

export const metadata: Metadata = { title: "Portfolio-Übersicht" };

export default async function PortfolioOverviewPage() {
  const snapshot = await getLiveDashboardSnapshot();
  return <div><Link href="/app" className="mb-6 inline-flex items-center gap-2 text-xs font-medium text-primary"><ArrowLeft className="size-3.5" />Zum Dashboard</Link><Dashboard snapshot={snapshot} /></div>;
}
