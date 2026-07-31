import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("tenant portal history projection", () => {
  const migration = readFileSync(
    new URL(
      "../../supabase/migrations/20260731123700_tenant_portal_history.sql",
      import.meta.url,
    ),
    "utf8",
  );

  it("keeps the tenant and organization boundary", () => {
    expect(migration).toContain(
      "om.user_id = (select auth.uid())",
    );
    expect(migration).toContain(
      "om.organization_id = p_organization_id",
    );
    expect(migration).toContain("om.role = 'tenant'");
  });

  it("returns completed occupancy history while ordering current leases first", () => {
    expect(migration).toContain("occupancy_starts_on date");
    expect(migration).toContain("occupancy_ends_on date");
    expect(migration).not.toMatch(
      /where[\s\S]*lt\.occupancy_ends_on >= clock\.today[\s\S]*order by/,
    );
    expect(migration).toMatch(
      /case[\s\S]*lt\.occupancy_ends_on >= clock\.today[\s\S]*then 0[\s\S]*else 1/,
    );
  });

  it("uses the same Berlin business date as the portal mutations", () => {
    expect(migration).toContain(
      "(now() at time zone 'Europe/Berlin')::date as today",
    );
    expect(migration).not.toContain("current_date");
  });
});
