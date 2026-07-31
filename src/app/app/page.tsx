import { Dashboard } from "@/components/app/dashboard";
import { getLiveDashboardSnapshot } from "@/lib/data/dashboard";

export default async function DashboardPage() {
  const snapshot = await getLiveDashboardSnapshot();
  return <Dashboard snapshot={snapshot} />;
}
