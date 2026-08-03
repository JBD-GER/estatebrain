import { z } from "zod";
import {
  calculateAcquisitionAllocation,
  propertySupportsMultipleUnits,
} from "@/lib/domain";

const money = z.number().finite().min(0);
const percentage = z.number().finite().min(0).max(100);

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

const optionalDate = z
  .string()
  .trim()
  .refine((value) => value === "" || isDateInput(value), {
    message: "Bitte gib ein gültiges Datum ein.",
  });

const requiredDate = z
  .string()
  .trim()
  .refine(isDateInput, {
    message: "Bitte gib ein gültiges Datum ein.",
  });

export const onboardingOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Bitte gib einen Namen ein.").max(120),
  organizationType: z.enum(["private", "company"]),
  street: z.string().trim().max(160),
  postalCode: z.string().trim().max(12),
  city: z.string().trim().max(100),
  currency: z.literal("EUR"),
  taxYear: z.number().int().min(2026).max(2100),
});

export const onboardingTaxSchema = z
  .object({
    calculationMode: z.enum(["automatic", "manual"]),
    manualEffectiveTaxRate: percentage.nullable(),
    otherTaxableIncome: money.nullable(),
    filingStatus: z.enum(["single", "joint"]),
    rentalIncomeComplete: z.boolean(),
    churchTax: z.boolean(),
    solidaritySurcharge: z.boolean(),
  })
  .superRefine((tax, context) => {
    if (
      tax.calculationMode === "manual" &&
      tax.manualEffectiveTaxRate === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["manualEffectiveTaxRate"],
        message: "Bitte gib den effektiven Steuersatz an.",
      });
    }
    if (
      tax.calculationMode === "automatic" &&
      tax.otherTaxableIncome === null
    ) {
      context.addIssue({
        code: "custom",
        path: ["otherTaxableIncome"],
        message:
          "Bitte gib deine weiteren steuerpflichtigen Einkünfte p. a. an.",
      });
    }
    if (
      tax.calculationMode === "automatic" &&
      !tax.rentalIncomeComplete
    ) {
      context.addIssue({
        code: "custom",
        path: ["rentalIncomeComplete"],
        message:
          "Bestätige zuerst, dass alle Vertragsmieten erfasst sind.",
      });
    }
  });

const onboardingPropertySchema = z.object({
  propertyMode: z.enum(["existing", "scenario"]),
  name: z.string().trim().min(2, "Bitte benenne die Immobilie.").max(140),
  street: z.string().trim().min(3, "Bitte gib die Straße ein.").max(160),
  postalCode: z
    .string()
    .trim()
    .min(4, "Bitte gib die Postleitzahl ein.")
    .max(12),
  city: z.string().trim().min(2, "Bitte gib den Ort ein.").max(100),
  propertyType: z.enum([
    "apartment_building",
    "condominium",
    "single_family",
    "semi_detached",
    "terraced_house",
    "commercial",
  ]),
  constructionYear: z.number().int().min(1000).max(2100),
  purchaseDate: requiredDate,
  purchasePrice: money.positive("Der Kaufpreis muss größer als 0 sein."),
  landArea: z
    .number()
    .finite()
    .positive("Die Grundstücksfläche muss größer als 0 sein."),
  standardLandValue: money.positive(
    "Der Bodenrichtwert muss größer als 0 sein.",
  ),
  landOwnershipSharePercent: percentage,
  realEstateTransferTaxRate: percentage.max(10),
  brokerFee: money,
  notaryFee: money,
  landRegistryFee: money,
  otherAcquisitionCosts: money,
  totalArea: z
    .number()
    .positive("Die Gesamtfläche muss größer als 0 sein."),
  depreciationMode: z.enum(["calculated", "tax_return"]),
  existingAnnualDepreciation: money.nullable(),
});

const onboardingUnitSchema = z
  .object({
    unitNumber: z.string().trim().min(1, "Bitte gib eine Bezeichnung ein."),
    floor: z.string().trim().max(40),
    area: z.number().positive("Die Wohnfläche muss größer als 0 sein."),
    rooms: z.number().min(0.5).max(100),
    contractColdRent: money,
    targetColdRent: money.positive(
      "Bitte gib eine Markt-/Ziel-Kaltmiete größer als 0 ein.",
    ),
    serviceCharge: money,
    ancillaryChargeType: z.enum(["advance", "flat_rate", "none"]),
    parkingRent: money,
    leaseStart: z.string().trim(),
    status: z.enum(["occupied", "vacant", "renovation"]),
  })
  .superRefine((unit, context) => {
    if (unit.status !== "occupied") return;

    if (unit.contractColdRent <= 0) {
      context.addIssue({
        code: "custom",
        path: ["contractColdRent"],
        message:
          "Für eine vermietete Einheit ist die Vertrags-Kaltmiete erforderlich.",
      });
    }
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

export const onboardingFinancingSchema = z
  .object({
    enabled: z.boolean(),
    loanType: z.enum([
      "annuity",
      "repayment",
      "interest_only",
      "variable",
      "other",
    ]),
    lenderName: z.string().trim().max(160),
    originalPrincipal: money,
    currentBalance: money,
    nominalInterestRate: percentage,
    initialRepaymentRate: percentage.nullable(),
    monthlyPayment: money,
    disbursedOn: optionalDate,
    fixedRateUntil: optionalDate,
  })
  .superRefine((financing, context) => {
    if (!financing.enabled) return;
    if (financing.lenderName.length < 2) {
      context.addIssue({
        code: "custom",
        path: ["lenderName"],
        message: "Bitte gib den Darlehensgeber an.",
      });
    }
    if (financing.originalPrincipal <= 0) {
      context.addIssue({
        code: "custom",
        path: ["originalPrincipal"],
        message: "Der ursprüngliche Darlehensbetrag muss größer als 0 sein.",
      });
    }
    if (financing.currentBalance <= 0) {
      context.addIssue({
        code: "custom",
        path: ["currentBalance"],
        message: "Die aktuelle Restschuld muss größer als 0 sein.",
      });
    }
    if (financing.currentBalance > financing.originalPrincipal) {
      context.addIssue({
        code: "custom",
        path: ["currentBalance"],
        message:
          "Die Restschuld darf den ursprünglichen Darlehensbetrag nicht übersteigen.",
      });
    }
    if (financing.monthlyPayment <= 0) {
      context.addIssue({
        code: "custom",
        path: ["monthlyPayment"],
        message: "Bitte gib die monatliche Finanzierungsrate an.",
      });
    }
    if (
      financing.fixedRateUntil &&
      financing.disbursedOn &&
      financing.fixedRateUntil < financing.disbursedOn
    ) {
      context.addIssue({
        code: "custom",
        path: ["fixedRateUntil"],
        message: "Die Zinsbindung darf nicht vor der Auszahlung enden.",
      });
    }
  });

export const onboardingSchema = z
  .object({
    organization: onboardingOrganizationSchema,
    property: onboardingPropertySchema,
    units: z.array(onboardingUnitSchema).min(1).max(100),
    financing: onboardingFinancingSchema,
    tax: onboardingTaxSchema,
    importMode: z.literal("none"),
    confirmation: z.boolean(),
  })
  .superRefine((input, context) => {
    if (
      input.tax.calculationMode === "automatic" &&
      input.organization.taxYear !== 2026
    ) {
      context.addIssue({
        code: "custom",
        path: ["organization", "taxYear"],
        message:
          "Die automatische Tarifberechnung ist derzeit für das Steuerjahr 2026 verfügbar.",
      });
    }

    if (!input.confirmation) {
      context.addIssue({
        code: "custom",
        path: ["confirmation"],
        message: "Bitte bestätige die Zusammenfassung.",
      });
    }

    if (
      !propertySupportsMultipleUnits(input.property.propertyType) &&
      input.units.length !== 1
    ) {
      context.addIssue({
        code: "custom",
        path: ["units"],
        message:
          "Für diesen Immobilientyp wird genau eine Mietfläche geführt.",
      });
    }

    if (
      input.property.propertyMode === "existing" &&
      input.property.depreciationMode === "tax_return" &&
      !input.property.existingAnnualDepreciation
    ) {
      context.addIssue({
        code: "custom",
        path: ["property", "existingAnnualDepreciation"],
        message:
          "Bitte übernimm die jährliche AfA aus der letzten Steuererklärung.",
      });
    }

    try {
      calculateAcquisitionAllocation({
        purchasePriceCents: Math.round(input.property.purchasePrice * 100),
        landAreaSquareMeters: input.property.landArea,
        standardLandValueCentsPerSquareMeter: Math.round(
          input.property.standardLandValue * 100,
        ),
        landOwnershipShare:
          input.property.landOwnershipSharePercent / 100,
        realEstateTransferTaxRate:
          input.property.realEstateTransferTaxRate / 100,
        brokerFeeCents: Math.round(input.property.brokerFee * 100),
        notaryAndLandRegistryFeeCents: Math.round(
          (input.property.notaryFee + input.property.landRegistryFee) * 100,
        ),
        otherAcquisitionCostsCents: Math.round(
          input.property.otherAcquisitionCosts * 100,
        ),
      });
    } catch {
      context.addIssue({
        code: "custom",
        path: ["property", "standardLandValue"],
        message:
          "Der Grundstücksanteil darf die gesamten Anschaffungskosten nicht übersteigen.",
      });
    }

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

export type OnboardingInput = z.infer<typeof onboardingSchema>;
