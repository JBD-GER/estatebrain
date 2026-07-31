export type ModuleRowAction = {
  href: string;
  kind: "open" | "review" | "download";
  label: string;
};

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Returns only actions backed by an existing, record-scoped destination.
 * Modules without a real detail or focus route deliberately have no row action.
 */
export function getModuleRowAction(
  moduleSlug: string,
  recordId: unknown,
): ModuleRowAction | null {
  if (typeof recordId !== "string" || !uuidPattern.test(recordId)) {
    return null;
  }

  const safeId = encodeURIComponent(recordId);

  switch (moduleSlug) {
    case "portfolio":
    case "immobilien":
      return {
        href: `/app/immobilien/${safeId}`,
        kind: "open",
        label: "Details öffnen",
      };
    case "daten-pruefen":
      return {
        href: `/app/belege?review=${safeId}`,
        kind: "review",
        label: "Prüfung öffnen",
      };
    case "belege":
      return {
        href: `/api/documents/${safeId}/download`,
        kind: "download",
        label: "Sicher herunterladen",
      };
    default:
      return null;
  }
}
