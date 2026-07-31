import { describe, expect, it } from "vitest";
import {
  onboardingDraftKey,
  onboardingDraftVersion,
  parseOnboardingDraft,
} from "@/lib/onboarding/draft";

const values = {
  organization: {},
  tax: {},
  property: {},
  units: [{}],
  importMode: "none",
};

describe("onboarding draft isolation", () => {
  it("uses a different storage key for every authenticated user", () => {
    expect(onboardingDraftKey("gregor-user")).not.toBe(
      onboardingDraftKey("christoph-user"),
    );
    expect(onboardingDraftKey("gregor-user")).toContain("gregor-user");
  });

  it("restores only versioned, structurally valid drafts", () => {
    expect(
      parseOnboardingDraft(
        JSON.stringify({
          version: onboardingDraftVersion,
          step: 99,
          values,
        }),
        5,
      ),
    ).toMatchObject({ step: 4, values });

    expect(parseOnboardingDraft("not-json", 5)).toBeNull();
    expect(
      parseOnboardingDraft(
        JSON.stringify({ version: 1, step: 1, values }),
        5,
      ),
    ).toBeNull();
    expect(
      parseOnboardingDraft(
        JSON.stringify({
          version: onboardingDraftVersion,
          step: 1,
          values: { ...values, units: [] },
        }),
        5,
      ),
    ).toBeNull();
  });
});
