import {
  calculateAcquisitionAllocation,
  calculateGermanRentalTaxEstimate2026,
  recommendedBuildingDepreciationRate,
} from "@/lib/domain";
import type { OnboardingInput } from "@/lib/validation/onboarding";

export function prepareOnboardingPersistence(input: OnboardingInput) {
  const acquisition = calculateAcquisitionAllocation({
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

  const annualContractRentCents = Math.round(
    input.units.reduce(
      (total, unit) =>
        total +
        (unit.status === "occupied"
          ? unit.contractColdRent
          : 0),
      0,
    ) *
      12 *
      100,
  );
  const annualTargetRentCents = Math.round(
    input.units.reduce(
      (total, unit) => total + unit.targetColdRent,
      0,
    ) *
      12 *
      100,
  );
  const annualParkingRentCents = Math.round(
    input.units.reduce(
      (total, unit) =>
        total +
        (input.property.propertyMode === "scenario" ||
        unit.status === "occupied"
          ? unit.parkingRent
          : 0),
      0,
    ) *
      12 *
      100,
  );
  const annualAncillaryIncomeCents = Math.round(
    input.units.reduce(
      (total, unit) =>
        total +
        (input.property.propertyMode === "existing" &&
        unit.status === "occupied" &&
        unit.ancillaryChargeType !== "none"
          ? unit.serviceCharge
          : 0),
      0,
    ) *
      12 *
      100,
  );
  const annualDepreciationCents =
    input.property.propertyMode === "existing" &&
    input.property.depreciationMode === "tax_return"
      ? Math.round((input.property.existingAnnualDepreciation ?? 0) * 100)
      : Math.round(
          acquisition.buildingValueCents *
            recommendedBuildingDepreciationRate(
              input.property.propertyType,
              input.property.constructionYear,
            ),
        );
  const annualInterestCents = input.financing.enabled
    ? Math.round(
        input.financing.currentBalance *
          100 *
          (input.financing.nominalInterestRate / 100),
      )
    : 0;
  const taxableRentalResultCents =
    input.property.propertyMode === "existing"
      ? annualContractRentCents +
        annualAncillaryIncomeCents +
        annualParkingRentCents -
        annualInterestCents -
        annualDepreciationCents
      : 0;
  const automaticTaxEstimate =
    input.tax.calculationMode === "automatic" &&
    input.tax.otherTaxableIncome !== null
      ? calculateGermanRentalTaxEstimate2026({
          otherTaxableIncomeCents: Math.round(
            input.tax.otherTaxableIncome * 100,
          ),
          taxableRentalResultCents,
          assessmentType:
            input.tax.filingStatus === "joint" ? "joint" : "individual",
        })
      : null;

  const legacyTax = {
    calculationsEnabled: true,
    marginalTaxRate:
      input.tax.calculationMode === "automatic"
        ? (automaticTaxEstimate?.marginalTaxRate ?? 0) * 100
        : null,
    effectiveTaxRate:
      input.tax.calculationMode === "automatic"
        ? (automaticTaxEstimate?.effectiveTaxRate ?? 0) * 100
        : input.tax.manualEffectiveTaxRate,
    taxableIncome: input.tax.otherTaxableIncome,
    filingStatus: input.tax.filingStatus,
    churchTax: input.tax.churchTax,
    solidaritySurcharge: input.tax.solidaritySurcharge,
  };

  const legacyPayload = {
    organization: input.organization,
    tax: legacyTax,
    property: {
      ...input.property,
      acquisitionCosts: acquisition.acquisitionCostsCents / 100,
      landValue: acquisition.landValueCents / 100,
      buildingValue: acquisition.buildingValueCents / 100,
      currentFinancing: input.financing.enabled
        ? input.financing.currentBalance
        : 0,
      // A transparent purchase-price proxy is created during onboarding. It
      // is explicitly marked as such by finalize_onboarding_v2.
      marketValue: input.property.purchasePrice,
      expectedMonthlyRent:
        input.units.reduce(
          (total, unit) => total + unit.targetColdRent + unit.parkingRent,
          0,
        ),
      unitCount: input.units.length,
    },
    units: input.units.map((unit) => ({
      ...unit,
      // The legacy boundary has one rent field. The v2 finalizer immediately
      // separates this into contractual and target rent again.
      baseRent: unit.contractColdRent,
      status:
        input.property.propertyMode === "scenario" ? "vacant" : unit.status,
    })),
    financing: input.financing,
    importMode: "none" as const,
    confirmation: input.confirmation,
    setupMode: "portfolio" as const,
  };

  return {
    legacyPayload,
    finalPayload: {
      ...input,
      derived: {
        acquisition,
        annualContractRentCents,
        annualTargetRentCents,
        annualParkingRentCents,
        annualAncillaryIncomeCents,
        annualDepreciationCents,
        annualInterestCents,
        taxableRentalResultCents,
        automaticTaxEstimate,
      },
    },
  };
}
