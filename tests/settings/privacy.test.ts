import { describe, expect, it } from "vitest";
import {
  readAccountDeletionRequest,
  readConsentPreferences,
  withAccountDeletionRequest,
  withConsentPreferences,
} from "@/lib/settings/privacy";
import {
  personalSettingsLocation,
  personalSettingsPath,
} from "@/lib/settings/routes";

describe("privacy settings metadata", () => {
  it("defaults optional consent and deletion state safely", () => {
    expect(readConsentPreferences(null)).toEqual({
      productUpdates: false,
      usageAnalytics: false,
      updatedAt: null,
      policyVersion: null,
    });
    expect(readAccountDeletionRequest({})).toEqual({
      status: "none",
      requestedAt: null,
      cancelledAt: null,
      requestId: null,
    });
  });

  it("preserves unrelated user metadata when consent is updated", () => {
    const metadata = withConsentPreferences(
      {
        full_name: "Ada Lovelace",
        estate_brain_privacy: {
          account_deletion_request: {
            status: "requested",
            requested_at: "2026-07-30T12:00:00.000Z",
          },
        },
      },
      {
        productUpdates: true,
        usageAnalytics: false,
        updatedAt: "2026-07-31T12:00:00.000Z",
        policyVersion: "2026-07",
      },
    );

    expect(metadata.full_name).toBe("Ada Lovelace");
    expect(readConsentPreferences(metadata)).toEqual({
      productUpdates: true,
      usageAnalytics: false,
      updatedAt: "2026-07-31T12:00:00.000Z",
      policyVersion: "2026-07",
    });
    expect(readAccountDeletionRequest(metadata).status).toBe("requested");
  });

  it("tracks account deletion requests and cancellation without deleting data", () => {
    const requested = withAccountDeletionRequest(
      { locale: "de-DE" },
      {
        status: "requested",
        requestedAt: "2026-07-31T10:00:00.000Z",
        cancelledAt: null,
        organizationId: "2b30e8ba-e2ba-41a0-99f1-e4970dd3d3ea",
        reason: "Konto wird nicht mehr benötigt.",
      },
    );
    const cancelled = withAccountDeletionRequest(requested, {
      status: "cancelled",
      requestedAt: "2026-07-31T10:00:00.000Z",
      cancelledAt: "2026-07-31T11:00:00.000Z",
      organizationId: "2b30e8ba-e2ba-41a0-99f1-e4970dd3d3ea",
      reason: null,
    });

    expect(cancelled.locale).toBe("de-DE");
    expect(readAccountDeletionRequest(cancelled)).toEqual({
      status: "cancelled",
      requestedAt: "2026-07-31T10:00:00.000Z",
      cancelledAt: "2026-07-31T11:00:00.000Z",
      requestId: null,
    });
  });

});

describe("personal settings routes", () => {
  it("keeps staff in the workspace and routes tenants outside it", () => {
    expect(
      personalSettingsPath({
        role: "owner",
        organizationId: "2b30e8ba-e2ba-41a0-99f1-e4970dd3d3ea",
      }),
    ).toBe("/app/einstellungen");
    expect(
      personalSettingsPath({
        role: "tenant",
        organizationId: "2b30e8ba-e2ba-41a0-99f1-e4970dd3d3ea",
      }),
    ).toBe("/konto/einstellungen");
    expect(
      personalSettingsPath({ role: null, organizationId: null }),
    ).toBe("/konto/einstellungen");
  });

  it("creates a bounded status redirect with an optional anchor", () => {
    expect(
      personalSettingsLocation(
        { role: "tenant", organizationId: "org" },
        "saved",
        "account-deletion",
        "konto-loeschen",
      ),
    ).toBe(
      "/konto/einstellungen?saved=account-deletion#konto-loeschen",
    );
  });
});
