import type { Metadata } from "next";
import { Dashboard } from "@/components/app/dashboard";
import { DemoShell } from "@/components/app/demo-shell";
import { getDemoDashboardSnapshot } from "@/lib/dashboard/demo";

export const metadata: Metadata = {
  title: "Interaktive Demo",
  description:
    "Das Estate-Brain-Portfolio-Cockpit mit ausschließlich fiktiven Beispieldaten ansehen.",
};

export default function DemoPage() {
  const snapshot = getDemoDashboardSnapshot();

  return (
    <DemoShell>
      <Dashboard snapshot={snapshot} />
    </DemoShell>
  );
}
