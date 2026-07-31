"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrganization } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

const messageSchema = z.object({
  subject: z.string().trim().min(3).max(240),
  body: z.string().trim().min(2).max(20_000),
  category: z.enum([
    "repair",
    "damage",
    "utilities",
    "payment",
    "document",
    "general",
  ]),
});

const replySchema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().trim().min(2).max(20_000),
});

const requestSchema = z.object({
  title: z.string().trim().min(3).max(240),
  description: z.string().trim().min(5).max(20_000),
  category: z.enum([
    "repair",
    "damage",
    "heating",
    "water",
    "electrical",
    "security",
    "other",
  ]),
});

function dateInBerlin() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = new Map(parts.map((part) => [part.type, part.value]));
  return `${values.get("year")}-${values.get("month")}-${values.get("day")}`;
}

async function getTenantScope() {
  const viewer = await requireOrganization();
  if (viewer.role !== "tenant") throw new Error("Nicht berechtigt.");

  const supabase = await createClient();
  const { data: contexts, error } = await supabase.rpc(
    "get_tenant_portal_context",
    { p_organization_id: viewer.organizationId },
  );
  if (error) throw new Error("Mieterprofil nicht gefunden.");

  const today = dateInBerlin();
  const context = contexts?.find(
    (item) =>
      ["active", "notice_given"].includes(item.lease_status) &&
      item.lease_starts_on <= today &&
      (!item.lease_ends_on || item.lease_ends_on >= today),
  );
  if (!context) {
    throw new Error("Kein aktuell aktives Mietverhältnis gefunden.");
  }

  return {
    supabase,
    viewer,
    tenantId: context.tenant_id,
    leaseId: context.lease_id,
    unitId: context.unit_id,
    propertyId: context.property_id,
  };
}

export async function createTenantConversationAction(formData: FormData) {
  const parsed = messageSchema.safeParse({
    subject: formData.get("subject"),
    body: formData.get("body"),
    category: formData.get("category"),
  });
  if (!parsed.success) return;

  const scope = await getTenantScope();
  const { data: conversation, error } = await scope.supabase
    .from("conversations")
    .insert({
      organization_id: scope.viewer.organizationId,
      property_id: scope.propertyId,
      unit_id: scope.unitId,
      lease_id: scope.leaseId,
      subject: parsed.data.subject,
      category: parsed.data.category,
      priority: parsed.data.category === "damage" ? "high" : "medium",
      status: "open",
      is_internal: false,
      last_message_at: new Date().toISOString(),
      created_by: scope.viewer.userId,
    })
    .select("id")
    .single();
  if (error || !conversation) return;

  await scope.supabase.from("messages").insert({
    organization_id: scope.viewer.organizationId,
    conversation_id: conversation.id,
    author_user_id: null,
    author_tenant_id: scope.tenantId,
    body: parsed.data.body,
    is_internal_note: false,
    created_by: scope.viewer.userId,
  });
  revalidatePath("/portal");
}

export async function replyToConversationAction(formData: FormData) {
  const parsed = replySchema.safeParse({
    conversationId: formData.get("conversationId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return;

  const scope = await getTenantScope();
  const { data: conversation } = await scope.supabase
    .from("conversations")
    .select("id")
    .eq("organization_id", scope.viewer.organizationId)
    .eq("id", parsed.data.conversationId)
    .eq("is_internal", false)
    .maybeSingle();
  if (!conversation) return;

  await scope.supabase.from("messages").insert({
    organization_id: scope.viewer.organizationId,
    conversation_id: conversation.id,
    author_user_id: null,
    author_tenant_id: scope.tenantId,
    body: parsed.data.body,
    is_internal_note: false,
    created_by: scope.viewer.userId,
  });
  revalidatePath("/portal");
}

export async function createMaintenanceRequestAction(formData: FormData) {
  const parsed = requestSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    category: formData.get("category"),
  });
  if (!parsed.success) return;

  const scope = await getTenantScope();
  await scope.supabase.from("maintenance_requests").insert({
    organization_id: scope.viewer.organizationId,
    property_id: scope.propertyId,
    unit_id: scope.unitId,
    lease_id: scope.leaseId,
    tenant_id: scope.tenantId,
    title: parsed.data.title,
    description: parsed.data.description,
    category: parsed.data.category,
    priority: parsed.data.category === "damage" ? "high" : "medium",
    status: "open",
    created_by: scope.viewer.userId,
  });
  revalidatePath("/portal");
}
