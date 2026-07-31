"use server";

import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  forgotPasswordSchema,
  loginSchema,
  registrationSchema,
  resetPasswordSchema,
} from "@/lib/validation/auth";
import {
  safeInternalPath,
  trustedApplicationOrigin,
} from "@/lib/security/redirects";
import { registrationErrorMessage } from "@/lib/auth/errors";
import { loginDestination } from "@/lib/auth/flow";

export type AuthActionState = {
  status: "idle" | "error" | "success";
  message?: string;
  errors?: Record<string, string[]>;
};

async function getBaseUrl() {
  const headerStore = await headers();
  return trustedApplicationOrigin(
    process.env.NEXT_PUBLIC_APP_URL,
    headerStore.get("origin"),
  );
}

function fieldErrors(error: {
  flatten: () => { fieldErrors: Record<string, string[]> };
}) {
  return error.flatten().fieldErrors;
}

async function setOrganizationCookie(organizationId: string) {
  (await cookies()).set("estatebrain_org", organizationId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function loginAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Bitte prüfe deine Eingaben.",
      errors: fieldErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });

  if (error) {
    return {
      status: "error",
      message:
        error.code === "email_not_confirmed"
          ? "Bitte bestätige zuerst deine E-Mail-Adresse."
          : "E-Mail-Adresse oder Passwort ist nicht korrekt.",
    };
  }

  const requestedDestination = safeInternalPath(parsed.data.next, "/app");
  const userId = data.user?.id;
  let selectedRole: string | null = null;
  if (userId) {
    const { data: memberships } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at");
    const existingOrganizationId = (await cookies()).get(
      "estatebrain_org",
    )?.value;
    const selectedMembership =
      (memberships ?? []).find(
        (membership) =>
          membership.organization_id === existingOrganizationId,
      ) ?? memberships?.[0];
    if (selectedMembership) {
      await setOrganizationCookie(selectedMembership.organization_id);
      selectedRole = selectedMembership.role;
    } else {
      (await cookies()).delete("estatebrain_org");
    }
  }

  revalidatePath("/", "layout");
  redirect(loginDestination(requestedDestination, selectedRole));
}

export async function registrationAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = registrationSchema.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Bitte prüfe deine Eingaben.",
      errors: fieldErrors(parsed.error),
    };
  }

  const next = safeInternalPath(parsed.data.next, "/onboarding");
  const supabase = await createClient();
  const baseUrl = await getBaseUrl();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${baseUrl}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    return {
      status: "error",
      message: registrationErrorMessage(error),
    };
  }

  if (data.session) {
    redirect(next);
  }

  return {
    status: "success",
    message:
      "Fast geschafft: Wir haben dir einen Bestätigungslink per E-Mail gesendet.",
  };
}

export async function forgotPasswordAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = forgotPasswordSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Bitte prüfe deine E-Mail-Adresse.",
      errors: fieldErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const baseUrl = await getBaseUrl();
  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${baseUrl}/auth/callback?next=/passwort-zuruecksetzen`,
  });

  return {
    status: "success",
    message:
      "Wenn ein Konto existiert, erhältst du in Kürze einen Link zum Zurücksetzen.",
  };
}

export async function resetPasswordAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
  });

  if (!parsed.success) {
    return {
      status: "error",
      message: "Bitte prüfe dein neues Passwort.",
      errors: fieldErrors(parsed.error),
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return {
      status: "error",
      message:
        "Der Link ist abgelaufen oder ungültig. Fordere bitte einen neuen Link an.",
    };
  }

  return {
    status: "success",
    message: "Dein Passwort wurde aktualisiert. Du kannst jetzt weiterarbeiten.",
  };
}

export async function signOutAction() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  (await cookies()).delete("estatebrain_org");
  revalidatePath("/", "layout");
  redirect("/login");
}

export async function switchOrganizationAction(formData: FormData) {
  const organizationId = formData.get("organizationId");
  if (typeof organizationId !== "string" || !organizationId) return;

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return;

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("organization_id", organizationId)
    .eq("user_id", claims.claims.sub)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) return;

  await setOrganizationCookie(membership.organization_id);
  revalidatePath("/", "layout");
  redirect(membership.role === "tenant" ? "/portal" : "/app");
}

export async function acceptInvitationAction(
  _state: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const token = formData.get("token");
  if (typeof token !== "string" || token.length < 16) {
    return { status: "error", message: "Diese Einladung ist ungültig." };
  }

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) {
    return {
      status: "error",
      message: "Bitte melde dich an, bevor du die Einladung annimmst.",
    };
  }

  const { data: organizationId, error } = await supabase.rpc(
    "accept_invitation",
    {
      raw_token: token,
    },
  );

  if (error || !organizationId) {
    return {
      status: "error",
      message:
        "Die Einladung ist abgelaufen, wurde bereits verwendet oder gehört zu einer anderen E-Mail-Adresse.",
    };
  }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("organization_id", organizationId)
    .eq("user_id", claims.claims.sub)
    .eq("status", "active")
    .maybeSingle();
  if (!membership) {
    return {
      status: "error",
      message:
        "Die Einladung wurde angenommen, aber der Organisationszugriff konnte nicht geladen werden. Bitte melde dich erneut an.",
    };
  }

  await setOrganizationCookie(membership.organization_id);
  revalidatePath("/", "layout");
  redirect(membership.role === "tenant" ? "/portal" : "/app");
}
