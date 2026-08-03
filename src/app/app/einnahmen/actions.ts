"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrganization } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

const cancellationSchema = z.object({
  rentClaimId: z.string().uuid(),
  reason: z.string().trim().min(3).max(500),
});

type CancellationClient = {
  rpc(
    name: "cancel_rent_claim",
    args: { p_rent_claim_id: string; p_reason: string },
  ): Promise<{ data: string | null; error: { message: string } | null }>;
};

export async function cancelRentClaimAction(formData: FormData) {
  const viewer = await requireOrganization();
  if (
    !hasPermission(viewer.role, "bookkeeping.write") &&
    !hasPermission(viewer.role, "portfolio.write")
  ) {
    redirect("/app/einnahmen?result=forbidden");
  }

  const parsed = cancellationSchema.safeParse({
    rentClaimId: formData.get("rentClaimId"),
    reason: formData.get("reason"),
  });
  if (!parsed.success) redirect("/app/einnahmen?result=invalid");

  const supabase = await createClient();
  const { data, error } = await (supabase as unknown as CancellationClient).rpc(
    "cancel_rent_claim",
    {
      p_rent_claim_id: parsed.data.rentClaimId,
      p_reason: parsed.data.reason,
    },
  );
  if (error || data !== parsed.data.rentClaimId) {
    redirect("/app/einnahmen?result=failed");
  }

  revalidatePath("/app");
  revalidatePath("/app/einnahmen");
  revalidatePath("/app/mietverhaeltnisse");
  redirect("/app/einnahmen?result=cancelled");
}
