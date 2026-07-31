"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrganization } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

const confirmMatchSchema = z.object({
  matchId: z.uuid(),
});

function bankResult(result: string): never {
  redirect(`/app/bank?result=${encodeURIComponent(result)}`);
}

export async function confirmTransactionMatchAction(formData: FormData) {
  const parsed = confirmMatchSchema.safeParse({
    matchId: formData.get("matchId"),
  });
  if (!parsed.success) bankResult("invalid");

  const viewer = await requireOrganization();
  if (!hasPermission(viewer.role, "bank.reconcile")) {
    bankResult("forbidden");
  }

  const supabase = await createClient();
  const { data: match, error: matchError } = await supabase
    .from("transaction_matches")
    .select("id, organization_id, bank_transaction_id, status")
    .eq("id", parsed.data.matchId)
    .eq("organization_id", viewer.organizationId)
    .maybeSingle();

  if (matchError || !match) bankResult("not-found");
  if (match.status === "confirmed") bankResult("already-confirmed");
  if (match.status !== "suggested") bankResult("invalid-status");

  const { data: transaction, error: transactionError } = await supabase
    .from("bank_transactions")
    .select("id, organization_id, is_ignored")
    .eq("id", match.bank_transaction_id)
    .eq("organization_id", viewer.organizationId)
    .maybeSingle();

  if (transactionError || !transaction || transaction.is_ignored) {
    bankResult("not-found");
  }

  const { error } = await supabase.rpc("confirm_transaction_match", {
    p_match_id: match.id,
  });
  if (error) bankResult("failed");

  revalidatePath("/app/bank");
  revalidatePath("/app");
  bankResult("confirmed");
}
