import {
  hasPermission,
  type OrganizationRole,
} from "@/lib/auth/permissions";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type ReportProperty = {
  id: string;
  name: string;
};

type ReportUnit = {
  id: string;
  property_id: string;
  unit_number: string;
};

export type ReportScope = {
  propertyId: string | null;
  unitId: string | null;
  hasObjectFilter: boolean;
  label: string;
};

type ScopeResolution =
  | { scope: ReportScope; error: null }
  | { scope: null; error: string };

function requestedUuid(value: string | null | undefined) {
  if (!value) return { value: null, valid: true };
  return UUID_PATTERN.test(value)
    ? { value, valid: true }
    : { value: null, valid: false };
}

export function canAccessSensitiveReportData(role: OrganizationRole) {
  return (
    hasPermission(role, "bank.read") &&
    hasPermission(role, "financing.read") &&
    hasPermission(role, "tax.read")
  );
}

export function resolveReportScope({
  propertyParam,
  unitParam,
  properties,
  units,
}: {
  propertyParam: string | null | undefined;
  unitParam: string | null | undefined;
  properties: readonly ReportProperty[];
  units: readonly ReportUnit[];
}): ScopeResolution {
  const requestedProperty = requestedUuid(propertyParam);
  const requestedUnit = requestedUuid(unitParam);

  if (!requestedProperty.valid || !requestedUnit.valid) {
    return { scope: null, error: "Ungültiger Objektfilter." };
  }

  const unit = requestedUnit.value
    ? units.find((candidate) => candidate.id === requestedUnit.value)
    : null;
  if (requestedUnit.value && !unit) {
    return {
      scope: null,
      error: "Die ausgewählte Einheit ist nicht verfügbar.",
    };
  }

  const effectivePropertyId =
    requestedProperty.value ?? unit?.property_id ?? null;
  const property = effectivePropertyId
    ? properties.find((candidate) => candidate.id === effectivePropertyId)
    : null;
  if (effectivePropertyId && !property) {
    return {
      scope: null,
      error: "Die ausgewählte Immobilie ist nicht verfügbar.",
    };
  }
  if (unit && unit.property_id !== effectivePropertyId) {
    return {
      scope: null,
      error: "Einheit und Immobilie gehören nicht zusammen.",
    };
  }

  return {
    scope: {
      propertyId: effectivePropertyId,
      unitId: unit?.id ?? null,
      hasObjectFilter: Boolean(effectivePropertyId || unit),
      label: unit
        ? `${property?.name ?? "Immobilie"} · ${unit.unit_number}`
        : property?.name ?? "Gesamtportfolio",
    },
    error: null,
  };
}

export function reportScopeSearchParams(
  year: number,
  scope: ReportScope,
) {
  const params = new URLSearchParams({ year: String(year) });
  if (scope.propertyId) params.set("property", scope.propertyId);
  if (scope.unitId) params.set("unit", scope.unitId);
  return params;
}
