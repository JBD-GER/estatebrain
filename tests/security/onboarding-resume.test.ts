import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("resumable onboarding database boundary", () => {
  const migration = readFileSync(
    new URL(
      "../../supabase/migrations/20260731123600_resumable_onboarding_and_lease_guard.sql",
      import.meta.url,
    ),
    "utf8",
  );
  const actions = readFileSync(
    new URL("../../src/app/onboarding/actions.ts", import.meta.url),
    "utf8",
  );
  const page = readFileSync(
    new URL("../../src/app/onboarding/page.tsx", import.meta.url),
    "utf8",
  );
  const dashboard = readFileSync(
    new URL("../../src/components/app/dashboard.tsx", import.meta.url),
    "utf8",
  );

  it("rejects direct occupied-unit payloads without a valid lease start", () => {
    expect(migration).toMatch(
      /v_unit ->> 'status' = 'occupied'[\s\S]*v_lease_start_text is null[\s\S]*Occupied units require a valid lease start/,
    );
    expect(migration).toMatch(
      /jsonb_typeof\(p_payload -> 'organization'\) is distinct from 'object'[\s\S]*jsonb_typeof\(p_payload -> 'tax'\) is distinct from 'object'/,
    );
  });

  it("serializes an owner-only resume and stays idempotent", () => {
    expect(migration).toMatch(
      /create or replace function public\.resume_portfolio_onboarding[\s\S]*member_row\.role = 'owner'[\s\S]*for update of organization_row, member_row/,
    );
    expect(migration).toMatch(
      /if exists \([\s\S]*from public\.properties[\s\S]*return v_organization_id/,
    );
  });

  it("creates occupied units together with leases and rent schedules", () => {
    expect(migration).toMatch(
      /if v_unit ->> 'status' = 'occupied' then[\s\S]*insert into public\.leases[\s\S]*insert into public\.rent_schedules/,
    );
    expect(migration).toContain(
      "jsonb_array_length(p_payload -> 'units')",
    );
  });

  it("wires the resume RPC to a discoverable application flow", () => {
    expect(actions).toContain('supabase.rpc("resume_portfolio_onboarding"');
    expect(page).toContain('resumeRequested = (await searchParams).resume === "1"');
    expect(dashboard).toContain('href="/onboarding?resume=1"');
    expect(dashboard).toContain("Geführte Einrichtung fortsetzen");
  });
});
