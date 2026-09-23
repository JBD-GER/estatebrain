import { z } from "zod";
import {
  validateInvestmentTaxInput,
  type InvestmentTaxInput,
} from "@/lib/domain/investment-tax";

const cents = z.number().finite().int().min(0).max(1_000_000_000_000);
const date = z.string().length(10).refine((value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return year >= 1000 && year <= 2200 &&
    Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Bitte ein gültiges Datum eingeben.");
const optionalDate = z.preprocess((value) => value === "" ? undefined : value, date.optional());

/** Shared by browser imports and Server Actions. Unknown fields are rejected. */
export const investmentTaxInputSchema = z.strictObject({
  purchasePriceCents: cents,
  acquisitionCostsCents: cents,
  landShareRate: z.number().finite().min(0).max(1),
  capitalizedMeasuresCents: cents,
  completionDate: date,
  acquisitionDate: date,
  usage: z.enum(["rented", "owner_occupied"]),
  propertyKind: z.enum(["existing", "new_build", "heritage"]),
  marginalTaxRate: z.number().finite().min(0).max(0.6),
  years: z.number().int().min(1).max(60),
  contractDate: optionalDate,
  degressiveEligibilityConfirmed: z.boolean().optional(),
  certifiedHeritageCostsCents: cents.optional(),
  heritageCompletionDate: optionalDate,
  heritageEligibilityConfirmed: z.boolean().optional(),
  special7bEnabled: z.boolean().optional(),
  buildingApplicationDate: optionalDate,
  livingAreaSquareMeters: z.number().finite().min(0).max(1_000_000).optional(),
  special7bEligibilityConfirmed: z.boolean().optional(),
  qngCertified: z.boolean().optional(),
  tenYearRentalConfirmed: z.boolean().optional(),
  autoSwitchToLinear: z.boolean().optional(),
  linearSwitchAfterYears: z.number().int().min(4).max(50).optional(),
  cashflow: z.strictObject({
    monthlyColdRentCents: cents.max(100_000_000),
    rentStartsOn: optionalDate,
    annualRentGrowthRate: z.number().finite().min(0).max(0.1),
    vacancyRate: z.number().finite().min(0).max(1),
    monthlyOwnerCostsCents: cents.max(100_000_000),
    loanAmountCents: cents,
    annualInterestRate: z.number().finite().min(0).max(0.3),
    initialRepaymentRate: z.number().finite().min(0).max(1),
    loanStartsOn: optionalDate,
  }).optional(),
}).superRefine((input, context) => {
  for (const issue of validateInvestmentTaxInput(input)) {
    context.addIssue({ code: "custom", path: [issue.field], message: issue.message });
  }
});

export const investmentMethodSchema = z.enum([
  "linear", "degressive", "linear_7b", "degressive_7b", "heritage", "owner_occupied",
]);

export const investmentScenarioSaveSchema = z.strictObject({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Bitte einen Namen eingeben.").max(120),
  input: investmentTaxInputSchema,
  selectedMethod: investmentMethodSchema.default("linear"),
});

export type InvestmentScenario = {
  id: string;
  name: string;
  input: InvestmentTaxInput;
  selectedMethod: z.infer<typeof investmentMethodSchema>;
  createdAt: string;
  updatedAt: string;
};

export type SaveInvestmentScenarioResult =
  | { success: true; scenario: InvestmentScenario }
  | { success: false; error: string };

export type DeleteInvestmentScenarioResult =
  | { success: true; id: string }
  | { success: false; error: string };
