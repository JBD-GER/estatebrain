"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrganization } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

const createConversationSchema = z.object({
  leaseId: z.string().uuid(),
  subject: z.string().trim().min(1).max(240),
  category: z.enum([
    "repair",
    "damage",
    "utilities",
    "payment",
    "document",
    "general",
    "termination",
    "handover",
    "other",
  ]),
  priority: z.enum(["low", "medium", "high", "urgent"]),
  body: z.string().trim().min(1).max(20_000),
});

const replySchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().trim().min(1).max(20_000),
  internalNote: z.boolean(),
});

export async function createStaffConversationAction(formData: FormData) {
  const parsed = createConversationSchema.safeParse({
    leaseId: formData.get("leaseId"),
    subject: formData.get("subject"),
    category: formData.get("category"),
    priority: formData.get("priority"),
    body: formData.get("body"),
  });
  if (!parsed.success) redirect("/app/kommunikation?result=invalid");

  const viewer = await requireOrganization();
  if (!hasPermission(viewer.role, "messages.write")) {
    redirect("/app/kommunikation?result=forbidden");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_staff_tenant_conversation", {
    p_organization_id: viewer.organizationId,
    p_lease_id: parsed.data.leaseId,
    p_subject: parsed.data.subject,
    p_category: parsed.data.category,
    p_priority: parsed.data.priority,
    p_body: parsed.data.body,
  });
  if (error) redirect("/app/kommunikation?result=failed");

  revalidatePath("/app/kommunikation");
  redirect("/app/kommunikation?result=created");
}

export async function replyStaffConversationAction(formData: FormData) {
  const parsed = replySchema.safeParse({
    conversationId: formData.get("conversationId"),
    body: formData.get("body"),
    internalNote: formData.get("internalNote") === "on",
  });
  if (!parsed.success) redirect("/app/kommunikation?result=invalid");

  const viewer = await requireOrganization();
  if (!hasPermission(viewer.role, "messages.write")) {
    redirect("/app/kommunikation?result=forbidden");
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("reply_staff_conversation", {
    p_organization_id: viewer.organizationId,
    p_conversation_id: parsed.data.conversationId,
    p_body: parsed.data.body,
    p_internal_note: parsed.data.internalNote,
  });
  if (error) redirect("/app/kommunikation?result=failed");

  revalidatePath("/app/kommunikation");
  redirect("/app/kommunikation?result=replied");
}
