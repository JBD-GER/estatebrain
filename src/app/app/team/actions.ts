"use server";

import { createHash, randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrganization } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export type InviteMemberState = {
  status: "idle" | "success" | "error";
  message?: string;
  invitationUrl?: string;
};

const invitationSchema = z
  .object({
    email: z.email().transform((value) => value.toLowerCase()),
    role: z.enum([
      "admin",
      "property_manager",
      "accounting",
      "employee",
      "tenant",
    ]),
    tenantId: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim() ? value.trim() : undefined,
      z.uuid().optional(),
    ),
  })
  .refine((value) => value.role !== "tenant" || value.tenantId, {
    path: ["tenantId"],
  });

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function applicationOrigin() {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  const origin = configured || (await headers()).get("origin") || "";
  try {
    const url = new URL(origin);
    return url.protocol === "https:" || url.hostname === "localhost"
      ? url.origin
      : null;
  } catch {
    return null;
  }
}

export async function inviteMemberAction(
  _state: InviteMemberState,
  formData: FormData,
): Promise<InviteMemberState> {
  const parsed = invitationSchema.safeParse({
    email: formData.get("email"),
    role: formData.get("role"),
    tenantId: formData.get("tenantId"),
  });
  if (!parsed.success) {
    return {
      status: "error",
      message:
        "Bitte prüfe E-Mail-Adresse, Rolle und gegebenenfalls die Mieterzuordnung.",
    };
  }

  const viewer = await requireOrganization();
  if (!hasPermission(viewer.role, "team.manage")) {
    return { status: "error", message: "Du darfst keine Personen einladen." };
  }

  const origin = await applicationOrigin();
  if (!origin) {
    return {
      status: "error",
      message: "Die öffentliche App-URL ist noch nicht konfiguriert.",
    };
  }

  const supabase = await createClient();
  if (parsed.data.tenantId) {
    const { data: tenant } = await supabase
      .from("tenants")
      .select("id")
      .eq("id", parsed.data.tenantId)
      .eq("organization_id", viewer.organizationId)
      .maybeSingle();
    if (!tenant) {
      return { status: "error", message: "Der ausgewählte Mieter ist ungültig." };
    }
  }

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const { error } = await supabase.from("invitations").insert({
    organization_id: viewer.organizationId,
    email: parsed.data.email,
    role: parsed.data.role,
    token_hash: `\\x${tokenHash}`,
    status: "pending",
    expires_at: expiresAt.toISOString(),
    invited_by: viewer.userId,
    tenant_id: parsed.data.tenantId ?? null,
    property_restricted: parsed.data.role === "employee",
    created_by: viewer.userId,
  });

  if (error) {
    return {
      status: "error",
      message:
        "Die Einladung konnte nicht angelegt werden. Möglicherweise ist bereits eine Einladung offen.",
    };
  }

  const invitationUrl = `${origin}/einladung/${rawToken}`;
  let sent = false;
  if (process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL,
          to: [parsed.data.email],
          subject: `Einladung zu ${viewer.organizationName}`,
          html: `<p>Du wurdest zu <strong>${escapeHtml(
            viewer.organizationName,
          )}</strong> eingeladen.</p><p><a href="${escapeHtml(
            invitationUrl,
          )}">Einladung annehmen</a></p><p>Der Link ist sieben Tage gültig.</p>`,
        }),
      });
      sent = response.ok;
    } catch {
      sent = false;
    }
  }

  revalidatePath("/app/team");
  return {
    status: "success",
    message: sent
      ? "Einladung wurde per E-Mail versendet."
      : "Einladung erstellt. Teile den sicheren Link manuell; der E-Mail-Provider ist nicht aktiv.",
    invitationUrl: sent ? undefined : invitationUrl,
  };
}

const memberRoleSchema = z.object({
  membershipId: z.uuid(),
  role: z.enum(["admin", "property_manager", "accounting", "employee"]),
});

export async function updateMemberRoleAction(formData: FormData) {
  const parsed = memberRoleSchema.safeParse({
    membershipId: formData.get("membershipId"),
    role: formData.get("role"),
  });
  if (!parsed.success) return;

  const viewer = await requireOrganization();
  if (!hasPermission(viewer.role, "team.manage")) return;
  const supabase = await createClient();
  const { data: target } = await supabase
    .from("organization_members")
    .select("id, user_id, role")
    .eq("id", parsed.data.membershipId)
    .eq("organization_id", viewer.organizationId)
    .maybeSingle();
  if (!target || target.user_id === viewer.userId || target.role === "owner") return;

  await supabase
    .from("organization_members")
    .update({ role: parsed.data.role })
    .eq("id", target.id)
    .eq("organization_id", viewer.organizationId);
  revalidatePath("/app/team");
}

export async function suspendMemberAction(formData: FormData) {
  const membershipId = z.uuid().safeParse(formData.get("membershipId"));
  if (!membershipId.success) return;

  const viewer = await requireOrganization();
  if (!hasPermission(viewer.role, "team.manage")) return;
  const supabase = await createClient();
  const { data: target } = await supabase
    .from("organization_members")
    .select("id, user_id, role")
    .eq("id", membershipId.data)
    .eq("organization_id", viewer.organizationId)
    .maybeSingle();
  if (!target || target.user_id === viewer.userId || target.role === "owner") return;

  await supabase
    .from("organization_members")
    .update({ status: "suspended" })
    .eq("id", target.id)
    .eq("organization_id", viewer.organizationId);
  revalidatePath("/app/team");
}

export async function revokeInvitationAction(formData: FormData) {
  const invitationId = z.uuid().safeParse(formData.get("invitationId"));
  if (!invitationId.success) return;

  const viewer = await requireOrganization();
  if (!hasPermission(viewer.role, "team.manage")) return;
  const supabase = await createClient();
  await supabase
    .from("invitations")
    .update({ status: "revoked" })
    .eq("id", invitationId.data)
    .eq("organization_id", viewer.organizationId)
    .eq("status", "pending");
  revalidatePath("/app/team");
}

const propertyAssignmentSchema = z.object({
  membershipId: z.uuid(),
  propertyId: z.uuid(),
});

export async function assignMemberPropertyAction(formData: FormData) {
  const parsed = propertyAssignmentSchema.safeParse({
    membershipId: formData.get("membershipId"),
    propertyId: formData.get("propertyId"),
  });
  if (!parsed.success) return;

  const viewer = await requireOrganization();
  if (!hasPermission(viewer.role, "team.manage")) return;

  const supabase = await createClient();
  const [{ data: target }, { data: property }] = await Promise.all([
    supabase
      .from("organization_members")
      .select("id, role, status")
      .eq("id", parsed.data.membershipId)
      .eq("organization_id", viewer.organizationId)
      .maybeSingle(),
    supabase
      .from("properties")
      .select("id, status")
      .eq("id", parsed.data.propertyId)
      .eq("organization_id", viewer.organizationId)
      .is("archived_at", null)
      .maybeSingle(),
  ]);
  if (
    !target ||
    target.role !== "employee" ||
    target.status !== "active" ||
    !property
  ) {
    return;
  }

  const { error } = await supabase.from("property_assignments").insert({
    organization_id: viewer.organizationId,
    member_id: target.id,
    property_id: property.id,
    can_manage_tasks: true,
    can_manage_documents: true,
    can_manage_messages: true,
    created_by: viewer.userId,
  });
  if (error && error.code !== "23505") return;

  revalidatePath("/app/team");
}

const removePropertyAssignmentSchema = z.object({
  assignmentId: z.uuid(),
});

export async function removeMemberPropertyAssignmentAction(
  formData: FormData,
) {
  const parsed = removePropertyAssignmentSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
  });
  if (!parsed.success) return;

  const viewer = await requireOrganization();
  if (!hasPermission(viewer.role, "team.manage")) return;

  const supabase = await createClient();
  const { data: assignment } = await supabase
    .from("property_assignments")
    .select("id, member_id, property_id")
    .eq("id", parsed.data.assignmentId)
    .eq("organization_id", viewer.organizationId)
    .maybeSingle();
  if (!assignment) return;

  const [{ data: target }, { data: property }] = await Promise.all([
    supabase
      .from("organization_members")
      .select("id, role")
      .eq("id", assignment.member_id)
      .eq("organization_id", viewer.organizationId)
      .maybeSingle(),
    supabase
      .from("properties")
      .select("id")
      .eq("id", assignment.property_id)
      .eq("organization_id", viewer.organizationId)
      .maybeSingle(),
  ]);
  if (!target || target.role !== "employee" || !property) return;

  await supabase
    .from("property_assignments")
    .delete()
    .eq("id", assignment.id)
    .eq("member_id", target.id)
    .eq("property_id", property.id)
    .eq("organization_id", viewer.organizationId);
  revalidatePath("/app/team");
}
