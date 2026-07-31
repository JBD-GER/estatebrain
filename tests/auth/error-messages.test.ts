import { describe, expect, it } from "vitest";
import {
  loginPageErrorMessage,
  registrationErrorMessage,
} from "@/lib/auth/errors";

describe("registrationErrorMessage", () => {
  it.each([
    ["user_already_exists", /bereits ein Konto/],
    ["email_exists", /bereits ein Konto/],
    ["over_email_send_rate_limit", /Versandlimit/],
    ["over_request_rate_limit", /zu viele Registrierungsversuche/],
    ["weak_password", /nicht sicher genug/],
    ["email_address_invalid", /gültige E-Mail-Adresse/],
    ["signup_disabled", /momentan nicht verfügbar/],
    ["email_provider_disabled", /momentan nicht verfügbar/],
  ])("maps %s to a safe German message", (code, expected) => {
    expect(registrationErrorMessage({ code })).toMatch(expected);
  });

  it("maps a generic 429 without exposing provider details", () => {
    expect(registrationErrorMessage({ status: 429 })).toMatch(
      /zu viele Registrierungsversuche/,
    );
  });

  it("uses a stable fallback for unknown errors", () => {
    expect(
      registrationErrorMessage({
        code: "unexpected_provider_detail",
        status: 500,
      }),
    ).toBe(
      "Die Registrierung konnte nicht abgeschlossen werden. Bitte versuche es erneut.",
    );
  });
});

describe("loginPageErrorMessage", () => {
  it("shows confirmation failures without reflecting query text", () => {
    expect(loginPageErrorMessage("confirm")).toMatch(
      /Bestätigungslink ist abgelaufen oder ungültig/,
    );
    expect(loginPageErrorMessage("confirmation_failed")).toMatch(
      /Bestätigungslink ist abgelaufen oder ungültig/,
    );
    expect(loginPageErrorMessage("<script>alert(1)</script>")).toBeNull();
  });
});
