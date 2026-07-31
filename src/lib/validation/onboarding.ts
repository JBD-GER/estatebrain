import { z } from "zod";

const money = z.number().finite().min(0);

function normalizedUnitNumber(value: string) {
  return value.trim().toLocaleLowerCase("de-DE");
}

export function nextOnboardingUnitNumber(
  units: Array<{ unitNumber?: string }>,
) {
  const used = new Set(
    units.map((unit) => normalizedUnitNumber(unit.unitNumber ?? "")),
  );
  let sequence = 1;
  while (used.has(normalizedUnitNumber(`Wohnung ${sequence}`))) {
    sequence += 1;
  }
  return `Wohnung ${sequence}`;
}

function isDateInput(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export const onboardingOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Bitte gib einen Namen ein.").max(120),
  organizationType: z.enum(["private", "company"]),
  street: z.string().trim().max(160),
  postalCode: z.string().trim().max(12),
  city: z.string().trim().max(100),
  currency: z.literal("EUR"),
  taxYear: z.number().int().min(2000).max(2100),
});

export const onboardingTaxSchema = z.object({
  calculationsEnabled: z.boolean(),
  marginalTaxRate: z.number().min(0).max(60).nullable(),
  effectiveTaxRate: z.number().min(0).max(60).nullable(),
  churchTax: z.boolean(),
  solidaritySurcharge: z.boolean(),
  taxableIncome: money.nullable(),
  filingStatus: z.enum(["single", "joint"]),
});

const onboardingPropertySchema = z.object({
  name: z.string().trim().min(2, "Bitte benenne die Immobilie.").max(140),
  street: z.string().trim().min(3, "Bitte gib die Straße ein.").max(160),
  postalCode: z.string().trim().min(4, "Bitte gib die Postleitzahl ein.").max(12),
  city: z.string().trim().min(2, "Bitte gib den Ort ein.").max(100),
  propertyType: z.enum([
    "apartment_building",
    "condominium",
    "single_family",
    "mixed_use",
    "commercial",
  ]),
  purchaseDate: z.string(),
  purchasePrice: money,
  acquisitionCosts: money,
  landValue: money,
  buildingValue: money,
  totalArea: z
    .number()
    .positive("Die Gesamtfläche muss größer als 0 sein."),
  currentFinancing: money,
  marketValue: money,
  expectedMonthlyRent: money,
});

const onboardingUnitSchema = z
  .object({
    unitNumber: z.string().trim().min(1, "Bitte gib eine Bezeichnung ein."),
    floor: z.string().trim().max(40),
    area: z.number().positive("Die Wohnfläche muss größer als 0 sein."),
    rooms: z.number().min(0.5).max(30),
    baseRent: money,
    serviceCharge: money,
    parkingRent: money,
    leaseStart: z.string().trim(),
    status: z.enum(["occupied", "vacant", "renovation"]),
  })
  .superRefine((unit, context) => {
    if (unit.status !== "occupied") return;

    if (unit.leaseStart === "") {
      context.addIssue({
        code: "custom",
        path: ["leaseStart"],
        message: "Bitte gib den Mietbeginn an.",
      });
      return;
    }

    if (!isDateInput(unit.leaseStart)) {
      context.addIssue({
        code: "custom",
        path: ["leaseStart"],
        message: "Bitte gib ein gültiges Datum ein.",
      });
    }
  });

export const onboardingSchema = z
  .object({
    organization: onboardingOrganizationSchema,
    tax: onboardingTaxSchema,
    property: z.object({
      ...onboardingPropertySchema.shape,
    }),
    units: z.array(onboardingUnitSchema).min(1).max(100),
    importMode: z.enum(["none", "demo"]),
  })
  .superRefine((input, context) => {
    const indicesByNumber = new Map<string, number[]>();
    input.units.forEach((unit, index) => {
      const key = normalizedUnitNumber(unit.unitNumber);
      const indices = indicesByNumber.get(key) ?? [];
      indices.push(index);
      indicesByNumber.set(key, indices);
    });

    for (const indices of indicesByNumber.values()) {
      if (indices.length < 2) continue;
      for (const index of indices) {
        context.addIssue({
          code: "custom",
          path: ["units", index, "unitNumber"],
          message: "Diese Einheitenbezeichnung ist bereits vergeben.",
        });
      }
    }
  });

export const emptyOnboardingSchema = z.object({
  organization: onboardingOrganizationSchema,
  tax: onboardingTaxSchema,
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
export type EmptyOnboardingInput = z.infer<typeof emptyOnboardingSchema>;
