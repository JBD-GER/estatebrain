export function loginDestination(
  requestedDestination: string,
  selectedRole: string | null,
) {
  const requestsWorkspace =
    requestedDestination === "/app" ||
    requestedDestination.startsWith("/app/");
  const requestsTenantPortal =
    requestedDestination === "/portal" ||
    requestedDestination.startsWith("/portal/");

  if (!selectedRole && (requestsWorkspace || requestsTenantPortal)) {
    return "/onboarding";
  }

  if (selectedRole === "tenant" && requestsWorkspace) {
    return "/portal";
  }

  return requestedDestination;
}
