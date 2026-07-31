import { describe, expect, it } from "vitest";
import { isCurrentTenantLease } from "@/lib/portal/lease";
import {
  parseTenantConversationFormData,
  parseTenantMaintenanceRequestFormData,
  parseTenantReplyFormData,
} from "@/lib/validation/tenant-portal";

const conversationId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function formData(values: Record<string, string>) {
  const data = new FormData();
  for (const [name, value] of Object.entries(values)) data.set(name, value);
  return data;
}

describe("tenant portal validation", () => {
  it("normalizes a valid new conversation", () => {
    const result = parseTenantConversationFormData(
      formData({
        subject: "  Heizung im Bad  ",
        body: "  Bitte um Rückruf.  ",
        category: "repair",
      }),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual({
      subject: "Heizung im Bad",
      body: "Bitte um Rückruf.",
      category: "repair",
    });
  });

  it("returns field-level errors for incomplete messages and replies", () => {
    const conversation = parseTenantConversationFormData(
      formData({ subject: "x", body: "", category: "unknown" }),
    );
    expect(conversation.success).toBe(false);
    if (conversation.success) return;
    expect(conversation.error.flatten().fieldErrors).toMatchObject({
      subject: expect.any(Array),
      body: expect.any(Array),
      category: expect.any(Array),
    });

    const reply = parseTenantReplyFormData(
      formData({ conversationId: "not-a-uuid", body: "x" }),
    );
    expect(reply.success).toBe(false);
    if (reply.success) return;
    expect(reply.error.flatten().fieldErrors).toMatchObject({
      conversationId: expect.any(Array),
      body: expect.any(Array),
    });
  });

  it("validates and trims a maintenance request", () => {
    const result = parseTenantMaintenanceRequestFormData(
      formData({
        title: "  Wasserhahn tropft  ",
        description: "  Seit gestern tropft der Hahn dauerhaft.  ",
        category: "water",
      }),
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.title).toBe("Wasserhahn tropft");
    expect(result.data.description).toBe(
      "Seit gestern tropft der Hahn dauerhaft.",
    );
  });
});

describe("tenant portal active lease gating", () => {
  it.each([
    ["active", "2026-01-01", null, true],
    ["notice_given", "2026-07-31", "2026-07-31", true],
    ["draft", "2026-01-01", null, false],
    ["active", "2026-08-01", null, false],
    ["ended", "2025-01-01", "2026-07-30", false],
  ] as const)(
    "evaluates %s lease from %s through %s",
    (leaseStatus, startsOn, endsOn, expected) => {
      expect(
        isCurrentTenantLease(
          {
            lease_status: leaseStatus,
            lease_starts_on: startsOn,
            lease_ends_on: endsOn,
          },
          "2026-07-31",
        ),
      ).toBe(expected);
    },
  );

  it("accepts a well-formed reply", () => {
    const result = parseTenantReplyFormData(
      formData({ conversationId, body: "Vielen Dank für die Rückmeldung." }),
    );
    expect(result.success).toBe(true);
  });

  it("does not treat an ended occupancy on an otherwise active lease as current", () => {
    expect(
      isCurrentTenantLease(
        {
          lease_status: "active",
          lease_starts_on: "2025-01-01",
          lease_ends_on: null,
          occupancy_starts_on: "2025-01-01",
          occupancy_ends_on: "2026-07-30",
        },
        "2026-07-31",
      ),
    ).toBe(false);
  });
});
