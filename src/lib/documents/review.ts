import { z } from "zod";

const optionalUuid = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() ? value.trim() : undefined,
  z.uuid("Ungültige Zuordnung.").optional(),
);

const requiredUuid = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() ? value.trim() : undefined,
  z.uuid("Bitte eine gültige Zuordnung auswählen."),
);

const optionalDate = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() ? value.trim() : undefined,
  z.iso.date("Bitte ein gültiges Datum angeben.").optional(),
);

const checkedBoolean = z.preprocess(
  (value) =>
    value === true || value === "true" || value === "on" || value === "1",
  z.boolean(),
);

function optionalText(maximum: number, message: string) {
  return z.preprocess(
    (value) =>
      typeof value === "string" && value.trim() ? value.trim() : undefined,
    z.string().max(maximum, message).optional(),
  );
}

export function parseMoneyToCents(value: unknown) {
  if (typeof value !== "string") return null;
  const raw = value.replace(/[€\s\u00a0']/g, "").trim();
  if (!raw) return null;

  let normalized: string;
  if (/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(raw)) {
    normalized = raw.replaceAll(".", "").replace(",", ".");
  } else if (/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(raw)) {
    normalized = raw.replaceAll(",", "");
  } else if (/^\d+(?:[.,]\d{1,2})?$/.test(raw)) {
    normalized = raw.replace(",", ".");
  } else {
    return null;
  }

  const [euros, decimals = ""] = normalized.split(".");
  const centsText = `${euros}${decimals.padEnd(2, "0")}`;
  const cents = Number(centsText);
  return Number.isSafeInteger(cents) ? cents : null;
}

const requiredMoney = z.string().transform((value, context) => {
  const cents = parseMoneyToCents(value);
  if (cents === null || cents <= 0) {
    context.addIssue({
      code: "custom",
      message: "Bitte einen positiven Betrag mit höchstens zwei Nachkommastellen angeben.",
    });
    return z.NEVER;
  }
  return cents;
});

const optionalMoney = z.preprocess(
  (value) =>
    typeof value === "string" && value.trim() ? value.trim() : undefined,
  z
    .string()
    .transform((value, context) => {
      const cents = parseMoneyToCents(value);
      if (cents === null || cents < 0) {
        context.addIssue({
          code: "custom",
          message:
            "Bitte einen Betrag mit höchstens zwei Nachkommastellen angeben.",
        });
        return z.NEVER;
      }
      return cents;
    })
    .optional(),
);

export const documentReviewSchema = z
  .object({
    documentId: requiredUuid,
    propertyId: requiredUuid,
    renovationProjectId: optionalUuid,
    unitId: optionalUuid,
    leaseId: optionalUuid,
    categoryId: requiredUuid,
    documentType: z.enum([
      "invoice",
      "receipt",
      "contract",
      "lease",
      "bank_statement",
      "tax",
      "insurance",
      "handover",
      "correspondence",
      "other",
    ]),
    title: optionalText(
      160,
      "Der Titel darf höchstens 160 Zeichen lang sein.",
    ),
    vendorName: z
      .string()
      .trim()
      .min(1, "Bitte den Rechnungssteller angeben.")
      .max(160, "Der Rechnungssteller ist zu lang."),
    invoiceNumber: optionalText(100, "Die Rechnungsnummer ist zu lang."),
    invoiceDate: optionalDate,
    serviceDate: optionalDate,
    recognizedAddress: optionalText(
      500,
      "Die erkannte Adresse ist zu lang.",
    ),
    grossAmountCents: requiredMoney,
    netAmountCents: optionalMoney,
    taxAmountCents: optionalMoney,
    currency: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}$/, "Bitte einen gültigen Währungscode angeben."),
    description: z
      .string()
      .trim()
      .min(2, "Bitte eine Beschreibung angeben.")
      .max(500, "Die Beschreibung ist zu lang."),
    entryDate: z.iso.date("Bitte ein gültiges Buchungsdatum angeben."),
    paymentStatus: z.enum([
      "open",
      "partial",
      "paid",
      "overpaid",
      "cancelled",
    ]),
    tenantVisible: checkedBoolean,
    isCashEffective: checkedBoolean,
    isTaxRelevant: checkedBoolean,
    isInterest: checkedBoolean,
    isPrincipal: checkedBoolean,
    isCapitalizable: checkedBoolean,
    isDeductible: checkedBoolean,
    isRecoverable: checkedBoolean,
    notes: optionalText(2000, "Die Notiz ist zu lang."),
  })
  .superRefine((value, context) => {
    if (value.unitId && !value.propertyId) {
      context.addIssue({
        code: "custom",
        path: ["unitId"],
        message: "Bitte zuerst eine Immobilie auswählen.",
      });
    }
    if (value.leaseId && !value.unitId) {
      context.addIssue({
        code: "custom",
        path: ["leaseId"],
        message: "Bitte zuerst eine Einheit auswählen.",
      });
    }
    if (value.tenantVisible && !value.leaseId) {
      context.addIssue({
        code: "custom",
        path: ["tenantVisible"],
        message:
          "Für die Sichtbarkeit im Mieterportal ist ein Mietverhältnis erforderlich.",
      });
    }
    const hasNet = value.netAmountCents !== undefined;
    const hasTax = value.taxAmountCents !== undefined;
    if (hasNet !== hasTax) {
      context.addIssue({
        code: "custom",
        path: [hasNet ? "taxAmountCents" : "netAmountCents"],
        message: "Netto- und Steuerbetrag bitte gemeinsam angeben.",
      });
    }
    if (
      hasNet &&
      hasTax &&
      value.netAmountCents! + value.taxAmountCents! !==
        value.grossAmountCents
    ) {
      context.addIssue({
        code: "custom",
        path: ["grossAmountCents"],
        message: "Netto- und Steuerbetrag müssen zusammen dem Bruttobetrag entsprechen.",
      });
    }
    if (value.isInterest && value.isPrincipal) {
      context.addIssue({
        code: "custom",
        path: ["isPrincipal"],
        message: "Eine Ausgabe kann nicht zugleich Zins und Tilgung sein.",
      });
    }
  });

export type DocumentReviewInput = z.output<typeof documentReviewSchema>;

export function parseDocumentReviewFormData(formData: FormData) {
  return documentReviewSchema.safeParse({
    documentId: formData.get("documentId"),
    propertyId: formData.get("propertyId"),
    renovationProjectId: formData.get("renovationProjectId"),
    unitId: formData.get("unitId"),
    leaseId: formData.get("leaseId"),
    categoryId: formData.get("categoryId"),
    documentType: formData.get("documentType"),
    title: formData.get("title"),
    vendorName: formData.get("vendorName"),
    invoiceNumber: formData.get("invoiceNumber"),
    invoiceDate: formData.get("invoiceDate"),
    serviceDate: formData.get("serviceDate"),
    recognizedAddress: formData.get("recognizedAddress"),
    grossAmountCents: formData.get("grossAmount"),
    netAmountCents: formData.get("netAmount"),
    taxAmountCents: formData.get("taxAmount"),
    currency: formData.get("currency"),
    description: formData.get("description"),
    entryDate: formData.get("entryDate"),
    paymentStatus: formData.get("paymentStatus"),
    tenantVisible: formData.get("tenantVisible"),
    isCashEffective: formData.get("isCashEffective"),
    isTaxRelevant: formData.get("isTaxRelevant"),
    isInterest: formData.get("isInterest"),
    isPrincipal: formData.get("isPrincipal"),
    isCapitalizable: formData.get("isCapitalizable"),
    isDeductible: formData.get("isDeductible"),
    isRecoverable: formData.get("isRecoverable"),
    notes: formData.get("notes"),
  });
}
