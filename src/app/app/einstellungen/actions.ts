"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOrganization } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

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
  retentionDays: z.coerce.number().int().min(0).max(3650).nullable(),
});

export async function updateProfileAction(formData: FormData) {
  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
  });
  if (!parsed.success) redirect("/app/einstellungen?error=profile");

  const viewer = await requireOrganization();
  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.fullName,
      phone: parsed.data.phone || null,
    })
    .eq("id", viewer.userId);
  if (error) redirect("/app/einstellungen?error=profile");

  revalidatePath("/app", "layout");
  redirect("/app/einstellungen?saved=profile");
}

export async function updatePasswordAction(formData: FormData) {
  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    password: formData.get("password"),
    passwordConfirmation: formData.get("passwordConfirmation"),
  });
  if (!parsed.success) redirect("/app/einstellungen?error=password");

  const viewer = await requireOrganization();
  if (!viewer.email) redirect("/app/einstellungen?error=password");

  const supabase = await createClient();
  const { error: reauthenticationError } =
    await supabase.auth.signInWithPassword({
      email: viewer.email,
      password: parsed.data.currentPassword,
    });
  if (reauthenticationError) {
    redirect("/app/einstellungen?error=password");
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });
  if (error) redirect("/app/einstellungen?error=password");
  redirect("/app/einstellungen?saved=password");
}

export async function updateOrganizationAction(formData: FormData) {
  const retentionValue = formData.get("retentionDays");
  const parsed = organizationSchema.safeParse({
    name: formData.get("name"),
    street: formData.get("street"),
    houseNumber: formData.get("houseNumber"),
    postalCode: formData.get("postalCode"),
    city: formData.get("city"),
    retentionDays:
      typeof retentionValue === "string" && retentionValue.trim()
        ? retentionValue
        : null,
  });
  if (!parsed.success) redirect("/app/einstellungen?error=organization");

  const viewer = await requireOrganization();
  if (!hasPermission(viewer.role, "organization.manage")) {
    redirect("/app/einstellungen?error=permission");
  }
  const supabase = await createClient();
  const { error } = await supabase
    .from("organizations")
    .update({
      name: parsed.data.name,
      street: parsed.data.street || null,
      house_number: parsed.data.houseNumber || null,
      postal_code: parsed.data.postalCode || null,
      city: parsed.data.city || null,
      retention_days: parsed.data.retentionDays,
    })
    .eq("id", viewer.organizationId);
  if (error) redirect("/app/einstellungen?error=organization");

  revalidatePath("/app", "layout");
  redirect("/app/einstellungen?saved=organization");
}
