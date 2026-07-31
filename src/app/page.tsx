import type { Metadata } from "next";

import { LandingPage } from "@/components/marketing/landing-page";

export const metadata: Metadata = {
  title: "Estate Brain – Immobilien, Zahlen und Cashflow im Überblick",
  description:
    "Estate Brain verbindet Mieteinnahmen, Ausgaben, Rechnungen, Finanzierungen und geschätzte steuerliche Effekte für private Immobilieninvestoren.",
};

export default function HomePage() {
  return <LandingPage />;
}
