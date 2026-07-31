"use server";

import { cookies } from "next/headers";
import {
  emptyOnboardingSchema,
  onboardingSchema,
  type EmptyOnboardingInput,
  type OnboardingInput,
} from "@/lib/validation/onboarding";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth/dal";
import type { Json } from "@/types/database";

export type OnboardingResult = {
  success: boolean;
  message: string;
};

async function persistOnboarding(
  payload: Json,
  successMessage: string,
  resumeExistingOrganization = false,
): Promise<OnboardingResult> {
  const viewer = await requireViewer();
  if (viewer.organizationId && !resumeExistingOrganization) {
    return {
      success: true,
      message: "Deine Organisation ist bereits eingerichtet.",
    };
  }

  const supabase = await createClient();
  const { data: organizationId, error } = viewer.organizationId
    ? await supabase.rpc("resume_portfolio_onboarding", {
        p_organization_id: viewer.organizationId,
        p_payload: payload,
      })
    : await supabase.rpc("complete_onboarding", { p_payload: payload });

  if (error || typeof organizationId !== "string") {
    return {
      success: false,
      message:
        "Die Einrichtung konnte nicht abgeschlossen werden. Es wurden keine unvollständigen Daten gespeichert. Bitte prüfe deine Angaben und versuche es erneut.",
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
    message: successMessage,
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

  return persistOnboarding(
    {
      ...parsed.data,
      setupMode: "portfolio",
    },
    "Estate Brain ist eingerichtet. Dein Dashboard wird vorbereitet.",
    true,
  );
}

export async function completeEmptyOnboardingAction(
  input: EmptyOnboardingInput,
): Promise<OnboardingResult> {
  const parsed = emptyOnboardingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      message:
        parsed.error.issues[0]?.message ??
        "Bitte prüfe die Organisationsdaten.",
    };
  }

  return persistOnboarding(
    {
      ...parsed.data,
      setupMode: "empty",
      importMode: "none",
    },
    "Deine leere Organisation ist eingerichtet. Du kannst jetzt in Ruhe starten.",
  );
}
