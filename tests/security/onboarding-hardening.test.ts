import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("first-run onboarding migration", () => {
  const migration = readFileSync(
    new URL(
      "../../supabase/migrations/20260731092855_onboarding_first_run_hardening.sql",
      import.meta.url,
    ),
    "utf8",
  );

  it("serializes setup and returns an existing organization on retry", () => {
    expect(migration).toMatch(/from public\.profiles[\s\S]*for update/);
    expect(migration).toContain("v_existing_organization_id");
    expect(migration).toContain("return v_existing_organization_id");
  });

  it("supports an empty setup without importing property data", () => {
    expect(migration).toContain("v_setup_mode = 'portfolio'");
    expect(migration).toContain("Empty setup cannot import sample data");
    expect(migration).toMatch(
      /if v_setup_mode = 'portfolio'[\s\S]*return private\.complete_portfolio_onboarding_v1/,
    );
  });

  it("derives unit count and keeps lower-level setup out of browser reach", () => {
    expect(migration).toContain("jsonb_array_length(p_payload -> 'units')");
    expect(migration).toMatch(
      /revoke all on function public\.create_organization_with_owner[\s\S]*from public, anon, authenticated/,
    );
  });
});
