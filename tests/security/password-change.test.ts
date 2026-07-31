import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("password change hardening", () => {
  const actionSource = readFileSync(
    new URL(
      "../../src/app/app/einstellungen/actions.ts",
      import.meta.url,
    ),
    "utf8",
  );
  const authConfig = readFileSync(
    new URL("../../supabase/config.toml", import.meta.url),
    "utf8",
  );

  it("requires the current password before updating credentials", () => {
    const reauthentication = actionSource.indexOf(
      "supabase.auth.signInWithPassword",
    );
    const passwordUpdate = actionSource.indexOf("supabase.auth.updateUser");

    expect(actionSource).toContain("currentPassword");
    expect(reauthentication).toBeGreaterThan(-1);
    expect(passwordUpdate).toBeGreaterThan(reauthentication);
  });

  it("enables Supabase secure password changes", () => {
    expect(authConfig).toMatch(/^secure_password_change = true$/m);
  });
});
