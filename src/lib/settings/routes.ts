import type { OrganizationRole } from "@/lib/auth/permissions";

export function personalSettingsPath(viewer: {
  role: OrganizationRole | null;
  organizationId: string | null;
}) {
  return viewer.role === "tenant" || !viewer.organizationId
    ? "/konto/einstellungen"
    : "/app/einstellungen";
}

export function personalSettingsLocation(
  viewer: {
    role: OrganizationRole | null;
    organizationId: string | null;
  },
  parameter: "saved" | "error",
  value: string,
  hash?: string,
) {
  const anchor = hash ? `#${hash}` : "";
  return `${personalSettingsPath(viewer)}?${parameter}=${encodeURIComponent(
    value,
  )}${anchor}`;
}
