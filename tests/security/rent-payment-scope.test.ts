import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("rent payment organization scope", () => {
  const migration = readFileSync(
    new URL(
      "../../supabase/migrations/20260731123100_rent_payment_scope_hardening.sql",
      import.meta.url,
    ),
    "utf8",
  );

  it("binds every rent payment to a claim in the same organization", () => {
    expect(migration).toMatch(
      /unique \(organization_id, id\)/,
    );
    expect(migration).toMatch(
      /foreign key \(organization_id, rent_claim_id\)[\s\S]*references public\.rent_claims \(organization_id, id\)/,
    );
  });

  it("adds both constraints idempotently", () => {
    expect(migration).toContain(
      "conname = 'rent_claims_organization_id_id_key'",
    );
    expect(migration).toContain(
      "conname = 'rent_payments_organization_claim_fkey'",
    );
  });
});
