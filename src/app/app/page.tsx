import type { Metadata } from "next";
import { Dashboard } from "@/components/app/dashboard";
import { getLiveDashboardSnapshot } from "@/lib/data/dashboard";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  return <Dashboard snapshot={await getLiveDashboardSnapshot()} />;
}
