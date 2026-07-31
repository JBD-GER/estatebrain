import { z } from "zod";

function formText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

export const tenantConversationSchema = z.object({
  subject: z
    .string()
    .trim()
    .min(3, "Der Betreff muss mindestens 3 Zeichen enthalten.")
    .max(240, "Der Betreff darf höchstens 240 Zeichen enthalten."),
  body: z
    .string()
    .trim()
    .min(2, "Die Nachricht muss mindestens 2 Zeichen enthalten.")
    .max(20_000, "Die Nachricht ist zu lang."),
  category: z.enum(
    ["repair", "damage", "utilities", "payment", "document", "general"],
    { error: "Bitte wähle eine gültige Kategorie." },
  ),
});

export const tenantReplySchema = z.object({
  conversationId: z
    .string()
    .uuid("Die ausgewählte Unterhaltung ist ungültig."),
  body: z
    .string()
    .trim()
    .min(2, "Die Antwort muss mindestens 2 Zeichen enthalten.")
    .max(20_000, "Die Antwort ist zu lang."),
});

export const tenantMaintenanceRequestSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Der Titel muss mindestens 3 Zeichen enthalten.")
    .max(240, "Der Titel darf höchstens 240 Zeichen enthalten."),
  description: z
    .string()
    .trim()
    .min(5, "Die Beschreibung muss mindestens 5 Zeichen enthalten.")
    .max(20_000, "Die Beschreibung ist zu lang."),
  category: z.enum(
    [
      "repair",
      "damage",
      "heating",
      "water",
      "electrical",
      "security",
      "other",
    ],
    { error: "Bitte wähle eine gültige Kategorie." },
  ),
});

export function parseTenantConversationFormData(formData: FormData) {
  return tenantConversationSchema.safeParse({
    subject: formText(formData, "subject"),
    body: formText(formData, "body"),
    category: formText(formData, "category"),
  });
}

export function parseTenantReplyFormData(formData: FormData) {
  return tenantReplySchema.safeParse({
    conversationId: formText(formData, "conversationId"),
    body: formText(formData, "body"),
  });
}

export function parseTenantMaintenanceRequestFormData(formData: FormData) {
  return tenantMaintenanceRequestSchema.safeParse({
    title: formText(formData, "title"),
    description: formText(formData, "description"),
    category: formText(formData, "category"),
  });
}
