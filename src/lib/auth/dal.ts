import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  organizationRoles,
  type OrganizationRole,
} from "@/lib/auth/permissions";

export type Viewer = {
  userId: string;
  email: string | null;
  fullName: string | null;
  organizationId: string | null;
  organizationName: string | null;
  role: OrganizationRole | null;
  memberships: Array<{
    organizationId: string;
    organizationName: string;
    role: OrganizationRole;
  }>;
};

type MembershipRow = {
  organization_id: string;
  role: string;
  organizations:
    | { id: string; name: string }
    | Array<{ id: string; name: string }>
    | null;
};

function normalizeOrganization(
  value: MembershipRow["organizations"],
): { id: string; name: string } | null {
  if (!value) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function isRole(value: string): value is OrganizationRole {
  return organizationRoles.includes(value as OrganizationRole);
}

export const getViewer = cache(async (): Promise<Viewer | null> => {
  const supabase = await createClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  if (claimsError || !userId) return null;

  const [{ data: profile }, { data: rawMemberships }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userId)
      .maybeSingle(),
    supabase
      .from("organization_members")
      .select("organization_id, role, organizations(id, name)")
      .eq("user_id", userId)
      .eq("status", "active"),
  ]);

  const memberships = ((rawMemberships ?? []) as MembershipRow[])
    .map((membership) => {
      const organization = normalizeOrganization(membership.organizations);
      if (!organization || !isRole(membership.role)) return null;
      return {
        organizationId: organization.id,
        organizationName: organization.name,
        role: membership.role,
      };
    })
    .filter(
      (
        membership,
      ): membership is {
        organizationId: string;
        organizationName: string;
        role: OrganizationRole;
      } => Boolean(membership),
    );

  const selectedOrganizationId = (await cookies()).get(
    "estatebrain_org",
  )?.value;
  const current =
    memberships.find(
      (membership) =>
        membership.organizationId === selectedOrganizationId,
    ) ?? memberships[0];

  const claims = claimsData.claims;

  return {
    userId,
    email: typeof claims.email === "string" ? claims.email : null,
    fullName:
      profile && typeof profile.full_name === "string"
        ? profile.full_name
        : null,
    organizationId: current?.organizationId ?? null,
    organizationName: current?.organizationName ?? null,
    role: current?.role ?? null,
    memberships,
  };
});

export async function requireViewer() {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  return viewer;
}

export async function requireOrganization() {
  const viewer = await requireViewer();
  if (!viewer.organizationId || !viewer.role) redirect("/onboarding");
  return {
    ...viewer,
    organizationId: viewer.organizationId,
    organizationName: viewer.organizationName ?? "Meine Verwaltung",
    role: viewer.role,
  };
}
