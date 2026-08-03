"use server";

import { cookies } from "next/headers";
import { requireViewer } from "@/lib/auth/dal";
import { prepareOnboardingPersistence } from "@/lib/onboarding/payload";
import { createClient } from "@/lib/supabase/server";
import {
  onboardingSchema,
  type OnboardingInput,
} from "@/lib/validation/onboarding";
import type { Json } from "@/types/database";

export type OnboardingResult = {
  success: boolean;
  message: string;
};

type OnboardingV2Client = {
  rpc(
    name: "complete_onboarding_v2" | "resume_portfolio_onboarding_v2",
    args: {
      p_organization_id?: string;
      p_legacy_payload: Json;
      p_payload: Json;
    },
  ): Promise<{
    data: string | null;
    error: { message: string } | null;
  }>;
};

async function persistOnboarding(
  input: OnboardingInput,
): Promise<OnboardingResult> {
  const viewer = await requireViewer();
  if (viewer.organizationId && viewer.role !== "owner") {
    return {
      success: false,
      message: "Nur Eigentümer können die Portfolio-Einrichtung abschließen.",
    };
  }

  const prepared = prepareOnboardingPersistence(input);
  const supabase = await createClient();
  const legacyPayload = prepared.legacyPayload as unknown as Json;
  const finalPayload = prepared.finalPayload as unknown as Json;
  const onboardingClient = supabase as unknown as OnboardingV2Client;
  const { data: organizationId, error } = viewer.organizationId
    ? await onboardingClient.rpc("resume_portfolio_onboarding_v2", {
        p_organization_id: viewer.organizationId,
        p_legacy_payload: legacyPayload,
        p_payload: finalPayload,
      })
    : await onboardingClient.rpc("complete_onboarding_v2", {
        p_legacy_payload: legacyPayload,
        p_payload: finalPayload,
      });

  if (error || typeof organizationId !== "string") {
    return {
      success: false,
      message:
        "Die Einrichtung konnte nicht abgeschlossen werden. Bitte prüfe deine Angaben und versuche es erneut.",
    };
  }

  (await cookies()).set("estatebrain_org", organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });

  return {
    success: true,
    message: "Estate Brain ist eingerichtet. Dein Dashboard wird vorbereitet.",
  };
}

export async function completeOnboardingAction(
  input: OnboardingInput,
): Promise<OnboardingResult> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message:
        parsed.error.issues[0]?.message ??
        "Bitte prüfe die Angaben im Onboarding.",
    };
  }

  return persistOnboarding(parsed.data);
}
