import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("rent payment claim-state guard", () => {
  const migration = readFileSync(
    new URL(
      "../../supabase/migrations/20260731123200_rent_payment_claim_state_guard.sql",
      import.meta.url,
    ),
    "utf8",
  );

  it("locks the claim before accepting a payment write", () => {
    expect(migration).toMatch(
      /from public\.rent_claims as rc[\s\S]*for update/,
    );
    expect(migration).toContain(
      "v_status not in ('open', 'partial')",
    );
  });

  it("protects cancelled claims and prevents moving a payment", () => {
    expect(migration).toContain("v_status = 'cancelled'");
    expect(migration).toMatch(
      /tg_op = 'DELETE'[\s\S]*not exists \([\s\S]*from public\.organizations/,
    );
    expect(migration).toMatch(
      /v_claim_organization_id is null[\s\S]*tg_op = 'DELETE'[\s\S]*return old/,
    );
    expect(migration).toContain(
      "A rent payment cannot be moved to another claim",
    );
    expect(migration).toMatch(
      /before insert or update or delete on public\.rent_payments/,
    );
  });
});
