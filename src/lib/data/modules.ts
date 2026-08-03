import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireOrganization } from "@/lib/auth/dal";
import {
  canAccessModule,
  canCreateModuleRecord,
} from "@/lib/auth/permissions";
import { getModuleDefinition } from "@/lib/modules";

export type ModuleRow = Record<string, unknown> & { id?: string };

export type RelationOptions = {
  properties: Array<{ label: string; value: string }>;
  units: Array<{ label: string; value: string }>;
  tenants: Array<{ label: string; value: string }>;
};

export type RelationLoadErrors = Partial<
  Record<keyof RelationOptions, true>
>;

function asText(value: unknown) {
  return typeof value === "string" ? value : "";
}

const derivedColumnDependencies: Record<string, string> = {
  display_name: "user_id",
  email: "user_id",
  property_name: "property_id",
  unit_name: "unit_id",
};

type ModuleQueryPlan = {
  selectColumns: string[];
  derivedColumns: Set<string>;
  relationOptions: Set<keyof RelationOptions>;
  wantsTenantName: boolean;
};

function createModuleQueryPlan(
  definition: NonNullable<ReturnType<typeof getModuleDefinition>>,
): ModuleQueryPlan {
  const selectColumns = new Set(["id", "created_at", "updated_at"]);
  const derivedColumns = new Set<string>();
  const relationOptions = new Set<keyof RelationOptions>();
  let wantsTenantName = false;

  for (const column of definition.columns) {
    if (column.key === "tenant_name") {
      derivedColumns.add(column.key);
      wantsTenantName = true;
      relationOptions.add("tenants");
      continue;
    }

    const dependency = derivedColumnDependencies[column.key];
    if (dependency) {
      derivedColumns.add(column.key);
      selectColumns.add(dependency);
      if (column.key === "property_name") relationOptions.add("properties");
      if (column.key === "unit_name") {
        relationOptions.add("units");
        relationOptions.add("properties");
      }
      continue;
    }

    selectColumns.add(column.key);
  }

  for (const field of definition.fields) {
    if (field.relation) relationOptions.add(field.relation);
  }
  if (relationOptions.has("units")) relationOptions.add("properties");

  return {
    selectColumns: [...selectColumns],
    derivedColumns,
    relationOptions,
    wantsTenantName,
  };
}

function toModuleRow(
  value: unknown,
  selectColumns: readonly string[],
): ModuleRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const source = value as Record<string, unknown>;
  return Object.fromEntries(
    selectColumns
      .filter((column) => Object.hasOwn(source, column))
      .map((column) => [column, source[column]]),
  );
}

export async function getModulePageData(slug: string) {
  const definition = getModuleDefinition(slug);
  if (!definition) return null;

  const viewer = await requireOrganization();
  const canCreate = canCreateModuleRecord(viewer.role, slug);
  if (!canAccessModule(viewer.role, slug)) {
    return {
      definition,
      rows: [],
      relations: {
        properties: [],
        units: [],
        tenants: [],
      } satisfies RelationOptions,
      relationErrors: {} satisfies RelationLoadErrors,
      error: null,
      forbidden: true,
      canCreate: false,
      viewer,
    };
  }

  const supabase = await createClient();
  const plan = createModuleQueryPlan(definition);
  // The module registry is a runtime-selected, schema-checked table union.
  // Only explicitly planned display/dependency columns cross the DTO boundary.
  const dynamicSupabase = supabase as unknown as SupabaseClient;

  let query = dynamicSupabase
    .from(definition.table)
    .select(plan.selectColumns.join(", "));
  query =
    definition.table === "organizations"
      ? query.eq("id", viewer.organizationId)
      : query.eq("organization_id", viewer.organizationId);

  if (slug === "daten-pruefen") {
    query = query.neq("review_status", "reviewed");
  }

  const [
    { data: rawRows, error: rowsError },
    { data: properties, error: propertiesError },
    { data: units, error: unitsError },
    { data: tenants, error: tenantsError },
    { data: unitCapacityRows, error: unitCapacityError },
  ] = await Promise.all([
    query.order("created_at", { ascending: false }).limit(100),
    plan.relationOptions.has("properties")
      ? supabase
          .from("properties")
          .select("id, name, property_type")
          .eq("organization_id", viewer.organizationId)
          .is("archived_at", null)
          .order("name")
      : Promise.resolve({ data: [], error: null }),
    plan.relationOptions.has("units")
      ? supabase
          .from("units")
          .select("id, unit_number, property_id")
          .eq("organization_id", viewer.organizationId)
          .order("unit_number")
      : Promise.resolve({ data: [], error: null }),
    plan.relationOptions.has("tenants")
      ? supabase
          .from("tenants")
          .select("id, first_name, last_name")
          .eq("organization_id", viewer.organizationId)
          .order("last_name")
      : Promise.resolve({ data: [], error: null }),
    slug === "einheiten"
      ? supabase
          .from("units")
          .select("property_id")
          .eq("organization_id", viewer.organizationId)
          .is("archived_at", null)
      : Promise.resolve({ data: [], error: null }),
  ]);

  const relationErrors: RelationLoadErrors = {
    ...(propertiesError || unitCapacityError ? { properties: true } : {}),
    ...(unitsError ? { units: true } : {}),
    ...(tenantsError ? { tenants: true } : {}),
  };

  const propertyIdsWithUnits = new Set(
    (unitCapacityRows ?? []).map((unit) => String(unit.property_id)),
  );
  const allPropertyOptions = (properties ?? []).map((property) => ({
    value: String(property.id),
    label: asText(property.name) || "Immobilie",
    propertyType: asText(property.property_type),
  }));
  const propertyOptions = allPropertyOptions
    .filter(
      (property) =>
        slug !== "einheiten" ||
        property.propertyType === "apartment_building" ||
        !propertyIdsWithUnits.has(property.value),
    )
    .map((property) => ({
      value: property.value,
      label: property.label,
    }));
  const propertyMap = new Map(
    allPropertyOptions.map((property) => [property.value, property.label]),
  );
  const unitOptions = (units ?? []).map((unit) => ({
    value: String(unit.id),
    label: `${propertyMap.get(String(unit.property_id)) ?? "Immobilie"} · ${
      asText(unit.unit_number) || "Einheit"
    }`,
  }));
  const unitMap = new Map(
    unitOptions.map((unit) => [unit.value, unit.label]),
  );
  const tenantOptions = (tenants ?? []).map((tenant) => ({
    value: String(tenant.id),
    label:
      `${asText(tenant.first_name)} ${asText(tenant.last_name)}`.trim() ||
      "Mieter",
  }));
  const tenantMap = new Map(
    tenantOptions.map((tenant) => [tenant.value, tenant.label]),
  );

  let rows = (rawRows ?? []).map((row) =>
    toModuleRow(row, plan.selectColumns),
  );

  const primaryTenantByLease = new Map<string, string>();
  if (plan.wantsTenantName && rows.length > 0) {
    const leaseIds = rows.map((row) => asText(row.id)).filter(Boolean);
    const { data: leaseTenants } = await supabase
      .from("lease_tenants")
      .select("lease_id, tenant_id")
      .eq("organization_id", viewer.organizationId)
      .eq("is_primary", true)
      .in("lease_id", leaseIds);

    for (const leaseTenant of leaseTenants ?? []) {
      primaryTenantByLease.set(
        String(leaseTenant.lease_id),
        String(leaseTenant.tenant_id),
      );
    }
  }

  rows = rows.map(
    (row): ModuleRow => {
      const tenantId = primaryTenantByLease.get(asText(row.id));
      const derivedValues: ModuleRow = {};
      if (plan.derivedColumns.has("property_name")) {
        derivedValues.property_name =
          propertyMap.get(asText(row.property_id)) ?? null;
      }
      if (plan.derivedColumns.has("unit_name")) {
        derivedValues.unit_name = unitMap.get(asText(row.unit_id)) ?? null;
      }
      if (plan.derivedColumns.has("tenant_name")) {
        derivedValues.tenant_name = tenantId
          ? (tenantMap.get(tenantId) ?? null)
          : null;
      }

      return {
        ...row,
        ...derivedValues,
      };
    },
  );

  if (slug === "team" && rows.length > 0) {
    const userIds = rows
      .map((row) => asText(row.user_id))
      .filter(Boolean);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", userIds);
    const profileMap = new Map(
      (profiles ?? []).map((profile) => [
        String(profile.id),
        asText(profile.full_name),
      ]),
    );
    rows = rows.map((row) => ({
      ...row,
      display_name: profileMap.get(asText(row.user_id)) || "Teammitglied",
      email:
        (profiles ?? []).find(
          (profile) => String(profile.id) === asText(row.user_id),
        )?.email ?? null,
    }));
  }

  return {
    definition,
    rows,
    relations: {
      properties: propertyOptions,
      units: unitOptions,
      tenants: tenantOptions,
    } satisfies RelationOptions,
    relationErrors,
    error:
      rowsError?.message ??
      propertiesError?.message ??
      unitsError?.message ??
      tenantsError?.message ??
      unitCapacityError?.message ??
      null,
    forbidden: false,
    canCreate,
    viewer,
  };
}
