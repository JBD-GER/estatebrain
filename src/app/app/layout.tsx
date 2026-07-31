import { AppShell, DemoBanner } from "@/components/app/app-shell";
import { requireOrganization } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const viewer = await requireOrganization();
  if (viewer.role === "tenant") redirect("/portal");

  const supabase = await createClient();
  const { data: organization } = await supabase
    .from("organizations")
    .select("demo_seeded_at")
    .eq("id", viewer.organizationId)
    .maybeSingle();

  return (
    <AppShell viewer={viewer}>
      {organization?.demo_seeded_at ? <DemoBanner persisted /> : null}
      {children}
    </AppShell>
  );
}
