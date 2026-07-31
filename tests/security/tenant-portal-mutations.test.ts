import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("tenant portal mutation hardening migration", () => {
  const migration = readFileSync(
    new URL(
      "../../supabase/migrations/20260731122900_tenant_portal_mutation_hardening.sql",
      import.meta.url,
    ),
    "utf8",
  );

  it("creates the conversation, participant, and first message atomically", () => {
    expect(migration).toMatch(
      /create or replace function public\.create_tenant_portal_conversation[\s\S]*insert into public\.conversations[\s\S]*insert into public\.conversation_participants[\s\S]*insert into public\.messages/,
    );
    expect(migration).toContain("'waiting_team'");
  });

  it("revalidates the authenticated tenant and active lease in the database", () => {
    expect(migration).toContain("om.user_id = v_user_id");
    expect(migration).toContain("om.role = 'tenant'");
    expect(migration).toContain("l.status in ('active', 'notice_given')");
    expect(migration).toContain("l.starts_on <= v_today");
    expect(migration).toContain("l.ends_on >= v_today");
    expect(migration).toContain("lt.occupancy_ends_on >= v_today");
  });

  it("locks replies, updates conversation state, and restricts RPC execution", () => {
    expect(migration).toMatch(
      /create or replace function public\.reply_tenant_portal_conversation[\s\S]*for update of c[\s\S]*insert into public\.messages[\s\S]*status = 'waiting_team'/,
    );
    expect(migration).toMatch(
      /revoke all[\s\S]*create_tenant_portal_conversation[\s\S]*from public, anon/,
    );
    expect(migration).toMatch(
      /revoke all[\s\S]*reply_tenant_portal_conversation[\s\S]*from public, anon/,
    );
    expect(migration.match(/security definer/g)).toHaveLength(3);
    expect(migration.match(/set search_path = pg_catalog/g)).toHaveLength(3);
  });

  it("creates a linked staff task in the same maintenance transaction", () => {
    expect(migration).toMatch(
      /create or replace function public\.create_tenant_portal_maintenance_request[\s\S]*insert into public\.maintenance_requests[\s\S]*returning id into v_request_id[\s\S]*insert into public\.tasks/,
    );
    expect(migration).toContain("maintenance_request_id");
    expect(migration).toMatch(
      /revoke all[\s\S]*create_tenant_portal_maintenance_request[\s\S]*from public, anon/,
    );
  });
});
