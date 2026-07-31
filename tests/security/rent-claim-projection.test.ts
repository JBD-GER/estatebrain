import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("rent claim projection hardening", () => {
  const migration = readFileSync(
    new URL(
      "../../supabase/migrations/20260731123500_rent_claim_rpc_only_mutations.sql",
      import.meta.url,
    ),
    "utf8",
  );

  it("removes browser access that could forge derived claim totals", () => {
    expect(migration).toContain(
      "revoke insert, update on public.rent_claims from authenticated",
    );
    expect(migration).toContain(
      "drop policy if exists rent_claims_insert_bookkeeping",
    );
    expect(migration).toContain(
      "drop policy if exists rent_claims_update_bookkeeping",
    );
  });

  it("retains the RPC and trigger-backed mutation contract", () => {
    expect(migration).toContain(
      "public.generate_monthly_rent_claims(uuid, date)",
    );
    expect(migration).toContain("private.refresh_rent_claim_totals()");
  });
});
