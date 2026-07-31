import { describe, expect, it } from "vitest";
import { loginDestination } from "@/lib/auth/flow";

describe("loginDestination", () => {
  it("routes a fresh account straight to onboarding", () => {
    expect(loginDestination("/app", null)).toBe("/onboarding");
    expect(loginDestination("/app/immobilien", null)).toBe("/onboarding");
    expect(loginDestination("/portal", null)).toBe("/onboarding");
  });

  it("routes tenants away from the staff workspace", () => {
    expect(loginDestination("/app", "tenant")).toBe("/portal");
    expect(loginDestination("/app/belege", "tenant")).toBe("/portal");
  });

  it("keeps staff and invitation destinations intact", () => {
    expect(loginDestination("/app", "owner")).toBe("/app");
    expect(loginDestination("/einladung/abc123", null)).toBe(
      "/einladung/abc123",
    );
  });
});
