import { describe, expect, it } from "vitest";
import {
  safeInternalPath,
  trustedApplicationOrigin,
} from "@/lib/security/redirects";

describe("safeInternalPath", () => {
  it("keeps valid internal paths including search parameters", () => {
    expect(safeInternalPath("/app/immobilien?id=1", "/app")).toBe(
      "/app/immobilien?id=1",
    );
  });

  it.each([
    "https://evil.example",
    "//evil.example",
    "/\\evil.example",
    "/%5cevil.example",
    "/app\nLocation: https://evil.example",
  ])("rejects unsafe redirect target %s", (target) => {
    expect(safeInternalPath(target, "/app")).toBe("/app");
  });
});

describe("trustedApplicationOrigin", () => {
  it("prefers the configured application URL", () => {
    expect(
      trustedApplicationOrigin(
        "https://estate-brain.vercel.app/path",
        "https://attacker.example",
      ),
    ).toBe("https://estate-brain.vercel.app");
  });

  it("rejects non-HTTP schemes", () => {
    expect(trustedApplicationOrigin("javascript:alert(1)", null)).toBe(
      "http://localhost:3000",
    );
  });
});
