"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrganization, requireViewer } from "@/lib/auth/dal";
import {
  canRequestOrganizationDeletion,
  hasPermission,
  type OrganizationRole,
} from "@/lib/auth/permissions";
import {
  readAccountDeletionRequest,
  withAccountDeletionRequest,
  withConsentPreferences,
} from "@/lib/settings/privacy";
import {
  personalSettingsLocation,
  personalSettingsPath,
} from "@/lib/settings/routes";
import { createClient } from "@/lib/supabase/server";

const CONSENT_POLICY_VERSION = "2026-07";

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(160),
  phone: z.string().trim().max(40).optional(),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1).max(128),
    password: z.string().min(12).max(128),
    passwordConfirmation: z.string().min(12).max(128),
  })
  .refine((value) => value.password === value.passwordConfirmation, {
    path: ["passwordConfirmation"],
  });

const organizationSchema = z.object({
  name: z.string().trim().min(2).max(160),
  street: z.string().trim().max(160).optional(),
  houseNumber: z.string().trim().max(30).optional(),
  postalCode: z.string().trim().max(12).optional(),
  city: z.string().trim().max(100).optional(),
});

const retentionSchema = z.object({
  retentionDays: z
    .coerce
    .number()
    .int()
    .min(0)
    .max(3650)
    .refine(
      (value) => value === 0 || value >= 30,
      "Verwende 0 oder mindestens 30 Tage.",
    )
    .nullable(),
});

const consentSchema = z.object({
  productUpdates: z.literal("accepted").optional(),
});

const accountDeletionSchema = z.object({
  reason: z.string().trim().max(1_000).optional(),
  acknowledgement: z.literal("confirm"),
});

const organizationDeletionSchema = z.object({
  organizationName: z.string().trim().min(2).max(160),
  acknowledgement: z.literal("confirm"),
});

const organizationDeletionCancellationSchema = z.object({
  requestId: z.string().uuid(),
});

type PersonalSettingsViewer = {
  role: OrganizationRole | null;
  organizationId: string | null;
};

function redirectToPersonalSettings(
  viewer: PersonalSettingsViewer,
  parameter: "saved" | "error",
  value: string,
  hash?: string,
): never {
  redirect(personalSettingsLocation(viewer, parameter, value, hash));
}

export async function updateProfileAction(formData: FormData) {
  const viewer = await requireViewer();
  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) {
    redirectToPersonalSettings(viewer, "error", "profile");
  }

  const supabase = await createClient();
  const { data: updatedProfile, error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone || null,
    })
    .eq("id", viewer.userId)
    .select("id")
    .maybeSingle();
  if (error || !updatedProfile) {
    redirectToPersonalSettings(viewer, "error", "profile");
  }

  revalidatePath("/app", "layout");
  revalidatePath(personalSettingsPath(viewer));
  redirectToPersonalSettings(viewer, "saved", "profile");
}

export async function updatePasswordAction(formData: FormData) {
  const viewer = await requireViewer();
  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
  });
  if (!parsed.success) {
    redirectToPersonalSettings(viewer, "error", "password");
  }

  if (!viewer.email) {
    redirectToPersonalSettings(viewer, "error", "password");
  }

  const supabase = await createClient();
  const { error: reauthenticationError } =
    await supabase.auth.signInWithPassword({
      email: viewer.email,
      password: parsed.data.currentPassword,
    });
  if (reauthenticationError) {
    redirectToPersonalSettings(viewer, "error", "password");
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) redirectToPersonalSettings(viewer, "error", "password");
  redirectToPersonalSettings(viewer, "saved", "password");
}

export async function updateOrganizationAction(formData: FormData) {
  const parsed = organizationSchema.safeParse({
    name: formData.get("name"),
    street: formData.get("street"),
    houseNumber: formData.get("houseNumber"),
    postalCode: formData.get("postalCode"),
    city: formData.get("city"),
  });
  if (!parsed.success) redirect("/app/einstellungen?error=organization");

  const viewer = await requireOrganization();
  if (!hasPermission(viewer.role, "organization.manage")) {
    redirect("/app/einstellungen?error=permission");
  }
  const supabase = await createClient();
  const { data: updatedOrganization, error } = await supabase
    .from("organizations")
    .update({
      name: parsed.data.name,
      street: parsed.data.street || null,
      house_number: parsed.data.houseNumber || null,
      postal_code: parsed.data.postalCode || null,
      city: parsed.data.city || null,
    })
    .eq("id", viewer.organizationId)
    .select("id")
    .maybeSingle();
  if (error || !updatedOrganization) {
    redirect("/app/einstellungen?error=organization");
  }

  revalidatePath("/app", "layout");
  redirect("/app/einstellungen?saved=organization");
}

export async function updateRetentionPolicyAction(formData: FormData) {
  const retentionValue = formData.get("retentionDays");
  const parsed = retentionSchema.safeParse({
    retentionDays:
      typeof retentionValue === "string" && retentionValue.trim()
        ? retentionValue
        : null,
  });
  if (!parsed.success) redirect("/app/einstellungen?error=retention");

  const viewer = await requireOrganization();
  if (!hasPermission(viewer.role, "organization.manage")) {
    redirect("/app/einstellungen?error=permission");
  }

  const supabase = await createClient();
  const { data: updatedOrganization, error } = await supabase
    .from("organizations")
    .update({ retention_days: parsed.data.retentionDays })
    .eq("id", viewer.organizationId)
    .select("id")
    .maybeSingle();
  if (error || !updatedOrganization) {
    redirect("/app/einstellungen?error=retention");
  }

  revalidatePath("/app/einstellungen");
  redirect("/app/einstellungen?saved=retention#aufbewahrung");
}

export async function updateConsentPreferencesAction(formData: FormData) {
  const viewer = await requireViewer();
  const rawProductUpdates = formData.get("productUpdates");
  const parsed = consentSchema.safeParse({
    productUpdates:
      rawProductUpdates === null ? undefined : rawProductUpdates,
  });
  if (!parsed.success) {
    redirectToPersonalSettings(viewer, "error", "consents");
  }

  const supabase = await createClient();
  const { data: userResult, error: userError } =
    await supabase.auth.getUser();
  if (userError || !userResult.user) {
    redirectToPersonalSettings(viewer, "error", "consents");
  }

  const metadata = withConsentPreferences(userResult.user.user_metadata, {
    productUpdates: parsed.data.productUpdates === "accepted",
    // No analytics provider is connected in the first release. Keep this
    // explicit and opt-out by default instead of collecting future consent.
    usageAnalytics: false,
    updatedAt: new Date().toISOString(),
    policyVersion: CONSENT_POLICY_VERSION,
  });
  const { error } = await supabase.auth.updateUser({ data: metadata });
  if (error) redirectToPersonalSettings(viewer, "error", "consents");

  revalidatePath(personalSettingsPath(viewer));
  redirectToPersonalSettings(
    viewer,
    "saved",
    "consents",
    "einwilligungen",
  );
}

export async function requestAccountDeletionAction(formData: FormData) {
  const viewer = await requireViewer();
  const parsed = accountDeletionSchema.safeParse({
    reason: formData.get("reason"),
    acknowledgement: formData.get("acknowledgement"),
  });
  if (!parsed.success) {
    redirectToPersonalSettings(
      viewer,
      "error",
      "account-deletion",
      "konto-loeschen",
    );
  }

  const supabase = await createClient();
  const { data: userResult, error: userError } =
    await supabase.auth.getUser();
  if (userError || !userResult.user) {
    redirectToPersonalSettings(
      viewer,
      "error",
      "account-deletion",
      "konto-loeschen",
    );
  }

  const currentRequest = readAccountDeletionRequest(
    userResult.user.user_metadata,
  );
  if (currentRequest.status === "requested") {
    redirectToPersonalSettings(
      viewer,
      "saved",
      "account-deletion",
      "konto-loeschen",
    );
  }

  const metadata = withAccountDeletionRequest(
    userResult.user.user_metadata,
    {
      status: "requested",
      requestedAt: new Date().toISOString(),
      cancelledAt: null,
      organizationId: viewer.organizationId,
      reason: parsed.data.reason || null,
    },
  );
  const { error } = await supabase.auth.updateUser({ data: metadata });
  if (error) {
    redirectToPersonalSettings(
      viewer,
      "error",
      "account-deletion",
      "konto-loeschen",
    );
  }

  revalidatePath(personalSettingsPath(viewer));
  redirectToPersonalSettings(
    viewer,
    "saved",
    "account-deletion",
    "konto-loeschen",
  );
}

export async function cancelAccountDeletionAction() {
  const viewer = await requireViewer();
  const supabase = await createClient();
  const { data: userResult, error: userError } =
    await supabase.auth.getUser();
  if (userError || !userResult.user) {
    redirectToPersonalSettings(
      viewer,
      "error",
      "account-deletion",
      "konto-loeschen",
    );
  }

  const currentRequest = readAccountDeletionRequest(
    userResult.user.user_metadata,
  );
  if (currentRequest.status !== "requested") {
    redirectToPersonalSettings(
      viewer,
      "saved",
      "account-deletion-cancelled",
      "konto-loeschen",
    );
  }

  const metadata = withAccountDeletionRequest(
    userResult.user.user_metadata,
    {
      status: "cancelled",
      requestedAt: currentRequest.requestedAt,
      cancelledAt: new Date().toISOString(),
      organizationId: viewer.organizationId,
      reason: null,
    },
  );
  const { error } = await supabase.auth.updateUser({ data: metadata });
  if (error) {
    redirectToPersonalSettings(
      viewer,
      "error",
      "account-deletion",
      "konto-loeschen",
    );
  }

  revalidatePath(personalSettingsPath(viewer));
  redirectToPersonalSettings(
    viewer,
    "saved",
    "account-deletion-cancelled",
    "konto-loeschen",
  );
}

export async function requestOrganizationDeletionAction(formData: FormData) {
  const parsed = organizationDeletionSchema.safeParse({
    organizationName: formData.get("organizationName"),
    acknowledgement: formData.get("acknowledgement"),
  });
  if (!parsed.success) {
    redirect(
      "/app/einstellungen?error=organization-deletion#organisation-loeschen",
    );
  }

  const viewer = await requireOrganization();
  if (!canRequestOrganizationDeletion(viewer.role)) {
    redirect(
      "/app/einstellungen?error=permission#organisation-loeschen",
    );
  }

  const supabase = await createClient();
  const { data: requestId, error } = await supabase.rpc(
    "request_organization_deletion",
    {
      p_organization_id: viewer.organizationId,
      p_organization_name: parsed.data.organizationName,
    },
  );
  if (error || typeof requestId !== "string") {
    redirect(
      "/app/einstellungen?error=organization-deletion#organisation-loeschen",
    );
  }

  revalidatePath("/app/einstellungen");
  revalidatePath("/app/aufgaben");
  redirect(
    "/app/einstellungen?saved=organization-deletion#organisation-loeschen",
  );
}

export async function cancelOrganizationDeletionAction(
  formData: FormData,
) {
  const parsed = organizationDeletionCancellationSchema.safeParse({
    requestId: formData.get("requestId"),
  });
  if (!parsed.success) {
    redirect(
      "/app/einstellungen?error=organization-deletion#organisation-loeschen",
    );
  }

  const viewer = await requireOrganization();
  if (!canRequestOrganizationDeletion(viewer.role)) {
    redirect(
      "/app/einstellungen?error=permission#organisation-loeschen",
    );
  }

  const supabase = await createClient();
  const { data: cancelled, error } = await supabase.rpc(
    "cancel_organization_deletion",
    {
      p_organization_id: viewer.organizationId,
      p_request_id: parsed.data.requestId,
    },
  );
  if (error || cancelled !== true) {
    redirect(
      "/app/einstellungen?error=organization-deletion#organisation-loeschen",
    );
  }

  revalidatePath("/app/einstellungen");
  revalidatePath("/app/aufgaben");
  redirect(
    "/app/einstellungen?saved=organization-deletion-cancelled#organisation-loeschen",
  );
}
