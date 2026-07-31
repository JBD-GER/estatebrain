import { z } from "zod";

const money = z.number().finite().min(0);

export const onboardingSchema = z.object({
  organization: z.object({
    name: z.string().trim().min(2, "Bitte gib einen Namen ein.").max(120),
    organizationType: z.enum(["private", "company"]),
    street: z.string().trim().max(160),
    postalCode: z.string().trim().max(12),
    city: z.string().trim().max(100),
    currency: z.literal("EUR"),
    taxYear: z.number().int().min(2000).max(2100),
  }),
  tax: z.object({
    calculationsEnabled: z.boolean(),
    marginalTaxRate: z.number().min(0).max(60).nullable(),
    effectiveTaxRate: z.number().min(0).max(60).nullable(),
    churchTax: z.boolean(),
    solidaritySurcharge: z.boolean(),
    taxableIncome: money.nullable(),
    filingStatus: z.enum(["single", "joint"]),
  }),
  property: z.object({
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
    unitCount: z.number().int().min(1).max(100),
    currentFinancing: money,
    marketValue: money,
    expectedMonthlyRent: money,
  }),
  units: z
    .array(
      z.object({
        unitNumber: z.string().trim().min(1, "Bitte gib eine Bezeichnung ein."),
        floor: z.string().trim().max(40),
        area: z.number().positive("Die Wohnfläche muss größer als 0 sein."),
        rooms: z.number().min(0.5).max(30),
        baseRent: money,
        serviceCharge: money,
        parkingRent: money,
        leaseStart: z.string(),
        status: z.enum(["occupied", "vacant", "renovation"]),
      }),
    )
    .min(1),
  importMode: z.enum(["none", "demo"]),
});

export type OnboardingInput = z.infer<typeof onboardingSchema>;
