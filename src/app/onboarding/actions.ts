"use server";

import { cookies } from "next/headers";
import { onboardingSchema, type OnboardingInput } from "@/lib/validation/onboarding";
import { createClient } from "@/lib/supabase/server";
import { requireViewer } from "@/lib/auth/dal";

export type OnboardingResult = {
  success: boolean;
  message: string;
};

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

  const viewer = await requireViewer();
  if (viewer.organizationId) {
    return {
      success: true,
      message: "Deine Organisation ist bereits eingerichtet.",
    };
  }

  const supabase = await createClient();
  const { data: organizationId, error } = await supabase.rpc(
    "complete_onboarding",
    { p_payload: parsed.data },
  );

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
    message: "Estate Brain ist eingerichtet. Dein Dashboard wird vorbereitet.",
  };
}
