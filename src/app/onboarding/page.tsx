import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand/logo";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";
import { requireViewer } from "@/lib/auth/dal";

export const metadata: Metadata = { title: "Portfolio einrichten" };

export default async function OnboardingPage() {
  const viewer = await requireViewer();
  if (viewer.organizationId) redirect("/app");

  return (
    <main className="min-h-screen">
      <header className="border-b bg-background/90 px-5 py-4 backdrop-blur sm:px-8">
        <BrandLogo />
      </header>
      <div className="px-5 py-10 sm:px-8 sm:py-14">
        <OnboardingWizard fullName={viewer.fullName} />
      </div>
    </main>
  );
}
