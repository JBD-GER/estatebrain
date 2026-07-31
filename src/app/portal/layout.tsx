import { redirect } from "next/navigation";
import { BrandLogo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/app/(auth)/actions";
import { requireOrganization } from "@/lib/auth/dal";

export default async function TenantPortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await requireOrganization();
  if (viewer.role !== "tenant") redirect("/app");

  return (
    <div className="min-h-dvh bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <BrandLogo href="/portal" />
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">
              Mieterportal
            </span>
            <form action={signOutAction}>
              <Button type="submit" variant="outline" size="sm">
                Abmelden
              </Button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
        {children}
      </main>
    </div>
  );
}
