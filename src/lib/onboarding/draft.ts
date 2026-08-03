import { z } from "zod";
import type { OnboardingInput } from "@/lib/validation/onboarding";

export const legacyOnboardingDraftKey = "estatebrain:onboarding:v1";
export const onboardingDraftVersion = 3;

const record = z.record(z.string(), z.unknown());
const storedDraftSchema = z.object({
  version: z.literal(onboardingDraftVersion),
  step: z.number().int(),
  values: z.object({
    organization: record,
    tax: record,
    property: record,
    units: z.array(record).min(1).max(100),
    financing: record,
    importMode: z.literal("none"),
    confirmation: z.boolean(),
  }),
});

export function onboardingDraftKey(userId: string) {
  return `estatebrain:onboarding:v${onboardingDraftVersion}:${encodeURIComponent(userId)}`;
}

export function parseOnboardingDraft(
  rawValue: string | null,
  stepCount: number,
): { step: number; values: OnboardingInput } | null {
  if (!rawValue || rawValue.length > 100_000 || stepCount < 1) return null;

  try {
    const parsed = storedDraftSchema.safeParse(JSON.parse(rawValue));
    if (!parsed.success) return null;

    return {
      step: Math.min(Math.max(parsed.data.step, 0), stepCount - 1),
      values: parsed.data.values as unknown as OnboardingInput,
    };
  } catch {
    return null;
  }
}
