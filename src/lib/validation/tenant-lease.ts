import { z } from "zod";

const MAX_AMOUNT_CENTS = 100_000_000_000;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const EURO_INPUT_PATTERN = /^\d+(?:[.,]\d{1,2})?$/;

function formText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

function emptyToUndefined(value: unknown) {
  return typeof value === "string" && value.trim() === "" ? undefined : value;
}

function optionalText(max: number, message: string) {
  return z.preprocess(
    emptyToUndefined,
    z.string().trim().max(max, message).optional(),
  );
}

function isRealIsoDate(value: string) {
  if (!ISO_DATE_PATTERN.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}

function isoDate(message: string) {
  return z.string().refine(isRealIsoDate, message);
}

export function euroInputToCents(value: string) {
  const normalized = value.trim().replace(",", ".");
  const [euros, decimals = ""] = normalized.split(".");
  return Number(euros) * 100 + Number(`${decimals}00`.slice(0, 2));
}

function moneyInput({
  minimumCents = 0,
  requiredMessage,
}: {
  minimumCents?: number;
  requiredMessage: string;
}) {
  return z
    .string()
    .trim()
    .min(1, requiredMessage)
    .regex(EURO_INPUT_PATTERN, "Bitte gib einen gültigen Euro-Betrag ein.")
    .transform(euroInputToCents)
    .refine(
      (value) => value >= minimumCents,
      minimumCents > 0
        ? "Der Betrag muss größer als 0 € sein."
        : "Der Betrag darf nicht negativ sein.",
    )
    .refine(
      (value) => Number.isSafeInteger(value) && value <= MAX_AMOUNT_CENTS,
      "Der Betrag ist zu hoch.",
    );
}

function integerInput(minimum: number, maximum: number, message: string) {
  return z
    .string()
    .trim()
    .regex(/^\d+$/, message)
    .transform(Number)
    .refine(
      (value) =>
        Number.isSafeInteger(value) && value >= minimum && value <= maximum,
      message,
    );
}

export const tenantLeaseFormSchema = z
  .object({
    propertyId: z.string().uuid("Bitte wähle eine Immobilie aus."),
    unitId: z.string().uuid("Bitte wähle eine Einheit aus."),
    tenantType: z.enum(["person", "company"], {
      error: "Bitte wähle Person oder Firma.",
    }),
    firstName: optionalText(100, "Der Vorname ist zu lang."),
    lastName: optionalText(100, "Der Nachname ist zu lang."),
    companyName: optionalText(200, "Der Firmenname ist zu lang."),
    email: z.preprocess(
      emptyToUndefined,
      z
        .string()
        .trim()
        .toLowerCase()
        .email("Bitte gib eine gültige E-Mail-Adresse ein.")
        .max(254, "Die E-Mail-Adresse ist zu lang.")
        .optional(),
    ),
    phone: optionalText(80, "Die Telefonnummer ist zu lang."),
    street: optionalText(160, "Die Straße ist zu lang."),
    houseNumber: optionalText(30, "Die Hausnummer ist zu lang."),
    postalCode: optionalText(20, "Die Postleitzahl ist zu lang."),
    city: optionalText(100, "Der Ort ist zu lang."),
    leaseNumber: optionalText(100, "Die Vertragsnummer ist zu lang."),
    startsOn: isoDate("Bitte gib einen gültigen Mietbeginn ein."),
    endsOn: z.preprocess(
      emptyToUndefined,
      isoDate("Bitte gib ein gültiges Mietende ein.").optional(),
    ),
    noticePeriodMonths: integerInput(
      0,
      120,
      "Die Kündigungsfrist muss zwischen 0 und 120 Monaten liegen.",
    ),
    dueDay: integerInput(
      1,
      31,
      "Der Fälligkeitstag muss zwischen 1 und 31 liegen.",
    ),
    coldRentCents: moneyInput({
      minimumCents: 1,
      requiredMessage: "Bitte gib die monatliche Vertrags-Kaltmiete ein.",
    }),
    ancillaryChargeType: z.enum(["advance", "flat_rate", "none"], {
      error: "Bitte wähle die Nebenkostenart aus.",
    }),
    ancillaryPrepaymentCents: moneyInput({
      requiredMessage: "Bitte gib den monatlichen Nebenkostenbetrag ein.",
    }),
    parkingRentCents: moneyInput({
      requiredMessage: "Bitte gib die monatliche Stellplatzmiete ein.",
    }),
    otherRentCents: moneyInput({
      requiredMessage: "Bitte gib monatliche sonstige Mietbestandteile ein.",
    }),
    depositCents: moneyInput({
      requiredMessage: "Bitte gib die Kaution ein.",
    }),
  })
  .superRefine((value, context) => {
    if (value.tenantType === "person" && !value.firstName) {
      context.addIssue({
        code: "custom",
        path: ["firstName"],
        message: "Bitte gib den Vornamen ein.",
      });
    }
    if (value.tenantType === "person" && !value.lastName) {
      context.addIssue({
        code: "custom",
        path: ["lastName"],
        message: "Bitte gib den Nachnamen ein.",
      });
    }
    if (value.tenantType === "company" && !value.companyName) {
      context.addIssue({
        code: "custom",
        path: ["companyName"],
        message: "Bitte gib den Firmennamen ein.",
      });
    }
    if (value.endsOn && value.endsOn < value.startsOn) {
      context.addIssue({
        code: "custom",
        path: ["endsOn"],
        message: "Das Mietende darf nicht vor dem Mietbeginn liegen.",
      });
    }
    if (
      value.ancillaryChargeType === "none" &&
      value.ancillaryPrepaymentCents !== 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["ancillaryPrepaymentCents"],
        message:
          "Ohne gesonderte Nebenkosten muss der monatliche Betrag 0 € sein.",
      });
    }
  });

export type TenantLeaseInput = z.infer<typeof tenantLeaseFormSchema>;

export type CreateTenantLeasePayload = {
  property_id: string;
  unit_id: string;
  tenant_type: "person" | "company";
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  country_code: "DE";
  lease_number: string | null;
  starts_on: string;
  ends_on: string | null;
  notice_period_months: number;
  due_day: number;
  cold_rent_cents: number;
  ancillary_charge_type: "advance" | "flat_rate" | "none";
  ancillary_prepayment_cents: number;
  parking_rent_cents: number;
  other_rent_cents: number;
  deposit_cents: number;
};

export function parseTenantLeaseFormData(formData: FormData) {
  return tenantLeaseFormSchema.safeParse({
    propertyId: formText(formData, "propertyId"),
    unitId: formText(formData, "unitId"),
    tenantType: formText(formData, "tenantType"),
    firstName: formText(formData, "firstName"),
    lastName: formText(formData, "lastName"),
    companyName: formText(formData, "companyName"),
    email: formText(formData, "email"),
    phone: formText(formData, "phone"),
    street: formText(formData, "street"),
    houseNumber: formText(formData, "houseNumber"),
    postalCode: formText(formData, "postalCode"),
    city: formText(formData, "city"),
    leaseNumber: formText(formData, "leaseNumber"),
    startsOn: formText(formData, "startsOn"),
    endsOn: formText(formData, "endsOn"),
    noticePeriodMonths: formText(formData, "noticePeriodMonths"),
    dueDay: formText(formData, "dueDay"),
    coldRentCents: formText(formData, "coldRentCents"),
    ancillaryChargeType: formText(formData, "ancillaryChargeType"),
    ancillaryPrepaymentCents: formText(
      formData,
      "ancillaryPrepaymentCents",
    ),
    parkingRentCents: formText(formData, "parkingRentCents"),
    otherRentCents: formText(formData, "otherRentCents"),
    depositCents: formText(formData, "depositCents"),
  });
}

export function toCreateTenantLeasePayload(
  input: TenantLeaseInput,
): CreateTenantLeasePayload {
  const isPerson = input.tenantType === "person";
  return {
    property_id: input.propertyId,
    unit_id: input.unitId,
    tenant_type: input.tenantType,
    first_name: isPerson ? (input.firstName ?? null) : null,
    last_name: isPerson ? (input.lastName ?? null) : null,
    company_name: isPerson ? null : (input.companyName ?? null),
    email: input.email ?? null,
    phone: input.phone ?? null,
    street: input.street ?? null,
    house_number: input.houseNumber ?? null,
    postal_code: input.postalCode ?? null,
    city: input.city ?? null,
    country_code: "DE",
    lease_number: input.leaseNumber ?? null,
    starts_on: input.startsOn,
    ends_on: input.endsOn ?? null,
    notice_period_months: input.noticePeriodMonths,
    due_day: input.dueDay,
    cold_rent_cents: input.coldRentCents,
    ancillary_charge_type: input.ancillaryChargeType,
    ancillary_prepayment_cents: input.ancillaryPrepaymentCents,
    parking_rent_cents: input.parkingRentCents,
    other_rent_cents: input.otherRentCents,
    deposit_cents: input.depositCents,
  };
}
