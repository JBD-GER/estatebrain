import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("tenant portal RPC-only write policies", () => {
  const migration = readFileSync(
    new URL(
      "../../supabase/migrations/20260731123400_tenant_portal_rpc_only_writes.sql",
      import.meta.url,
    ),
    "utf8",
  );

  it("removes tenant branches from direct conversation and request inserts", () => {
    expect(migration).toMatch(
      /create policy conversations_insert[\s\S]*private\.current_member_role\(organization_id\) = 'employee'[\s\S]*\);/,
    );
    expect(migration).toMatch(
      /create policy maintenance_requests_insert[\s\S]*private\.can_operate_property\(organization_id, property_id\)[\s\S]*\);/,
    );
    expect(migration).not.toContain(
      "private.current_member_role(organization_id) = 'tenant'",
    );
  });

  it("keeps direct message inserts and edits staff-authored only", () => {
    expect(migration).toMatch(
      /create policy messages_insert[\s\S]*author_user_id = \(select auth\.uid\(\)\)[\s\S]*author_tenant_id is null[\s\S]*<> 'tenant'/,
    );
    expect(migration).toMatch(
      /create policy messages_update_author[\s\S]*for update[\s\S]*<> 'tenant'[\s\S]*with check[\s\S]*<> 'tenant'/,
    );
  });
});
