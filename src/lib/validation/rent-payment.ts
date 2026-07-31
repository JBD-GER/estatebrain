import { z } from "zod";
import { parseMoneyToCents } from "@/lib/documents/review";

function isIsoDate(value: string) {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.valueOf()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

const manualRentPaymentSchema = z.object({
  rentClaimId: z.string().uuid("Bitte wähle eine Sollstellung aus."),
  paidOn: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Bitte gib ein gültiges Datum ein.")
    .refine(isIsoDate, "Bitte gib ein gültiges Kalenderdatum ein."),
  amountCents: z
    .number()
    .int()
    .positive("Der Zahlungseingang muss größer als 0 sein."),
  notes: z.string().trim().max(1_000, "Die Notiz ist zu lang.").nullable(),
});

export type ManualRentPaymentInput = z.infer<
  typeof manualRentPaymentSchema
>;

export function parseManualRentPaymentFormData(formData: FormData) {
  const rawAmount = formData.get("amount");
  const amountCents =
    typeof rawAmount === "string" ? parseMoneyToCents(rawAmount) : null;

  return manualRentPaymentSchema.safeParse({
    rentClaimId: formData.get("rentClaimId"),
    paidOn: formData.get("paidOn"),
    amountCents,
    notes:
      typeof formData.get("notes") === "string" &&
      String(formData.get("notes")).trim() !== ""
        ? String(formData.get("notes"))
        : null,
  });
}
