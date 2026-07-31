import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL(
    "../../supabase/migrations/20260731123000_create_valuation_rpc.sql",
    import.meta.url,
  ),
  "utf8",
);

const moduleAction = readFileSync(
  new URL("../../src/app/app/[module]/actions.ts", import.meta.url),
  "utf8",
);

describe("atomic valuation projection", () => {
  it("writes valuation history and the KPI projection in one RPC", () => {
    expect(migration).toContain("security invoker");
    expect(migration).toMatch(/from public\.properties[\s\S]*for update;/);
    expect(migration).toContain("insert into public.valuations");
    expect(migration).toContain("update public.properties");
    expect(migration).toContain("current_market_value_cents");
  });

  it("keeps a backdated valuation from replacing the newest dated value", () => {
    expect(migration).toMatch(
      /order by[\s\S]*valued_on desc,[\s\S]*created_at desc,[\s\S]*id desc[\s\S]*limit 1/,
    );
  });

  it("exposes the RPC only to signed-in application roles", () => {
    expect(migration).toMatch(
      /revoke all on function public\.create_valuation\([\s\S]*from public, anon, authenticated/,
    );
    expect(migration).toMatch(
      /grant execute on function public\.create_valuation\([\s\S]*to authenticated, service_role/,
    );
  });

  it("routes generic market creation through the atomic RPC", () => {
    expect(moduleAction).toMatch(
      /slug === "markt"[\s\S]*\.rpc\("create_valuation"/,
    );
  });
});
