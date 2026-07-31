import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("valuation projection guard", () => {
  const migration = readFileSync(
    new URL(
      "../../supabase/migrations/20260731123300_valuation_projection_guard.sql",
      import.meta.url,
    ),
    "utf8",
  );

  it("serializes every direct valuation mutation through the property row", () => {
    expect(migration).toMatch(
      /from public\.properties as property_row[\s\S]*organization_id = v_organization_id[\s\S]*id = v_property_id[\s\S]*for update/,
    );
    expect(migration).toMatch(
      /before insert or update or delete on public\.valuations[\s\S]*private\.lock_valuation_projection\(\)/,
    );
  });

  it("prevents a valuation from changing property or organization", () => {
    expect(migration).toContain(
      "new.organization_id is distinct from old.organization_id",
    );
    expect(migration).toContain(
      "new.property_id is distinct from old.property_id",
    );
    expect(migration).toContain("using errcode = '23514'");
  });

  it("refreshes the projection after inserts, updates, and deletes", () => {
    expect(migration).toMatch(
      /after insert or update or delete on public\.valuations[\s\S]*private\.refresh_valuation_projection\(\)/,
    );
    expect(migration).toMatch(
      /update public\.properties as property_row[\s\S]*set current_market_value_cents = \([\s\S]*from public\.valuations as valuation_row/,
    );
  });

  it("selects the newest remaining valuation deterministically", () => {
    expect(migration).toMatch(
      /order by[\s\S]*valued_on desc,[\s\S]*created_at desc,[\s\S]*id desc[\s\S]*limit 1/,
    );
  });

  it("keeps privileged trigger functions private and pinned to pg_catalog", () => {
    expect(migration).toMatch(
      /private\.lock_valuation_projection\(\)[\s\S]*security definer[\s\S]*set search_path = pg_catalog/,
    );
    expect(migration).toMatch(
      /private\.refresh_valuation_projection\(\)[\s\S]*security definer[\s\S]*set search_path = pg_catalog/,
    );
    expect(migration).toMatch(
      /revoke all on function private\.lock_valuation_projection\(\)[\s\S]*from public, anon, authenticated, service_role/,
    );
    expect(migration).toMatch(
      /revoke all on function private\.refresh_valuation_projection\(\)[\s\S]*from public, anon, authenticated, service_role/,
    );
  });

  it("prevents direct property updates from bypassing valuation history", () => {
    expect(migration).toMatch(
      /create or replace function private\.guard_property_market_value_projection\(\)[\s\S]*from public\.valuations[\s\S]*valued_on desc,[\s\S]*created_at desc,[\s\S]*id desc/,
    );
    expect(migration).toContain(
      "new.current_market_value_cents is distinct from v_expected_market_value_cents",
    );
    expect(migration).toMatch(
      /before update of current_market_value_cents on public\.properties[\s\S]*private\.guard_property_market_value_projection\(\)/,
    );
  });
});
