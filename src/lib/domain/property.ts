import {
  assertDecimalRate,
  assertMoneyCents,
  DomainValidationError,
  roundHalfAwayFromZero,
  sumCents,
} from "./money";
import type { DecimalRate, MoneyCents } from "./types";

export const propertyTypeOptions = [
  {
    value: "condominium",
    abbreviation: "ETW",
    label: "Eigentumswohnung",
  },
  {
    value: "apartment_building",
    abbreviation: "MFH",
    label: "Mehrfamilienhaus",
  },
  {
    value: "single_family",
    abbreviation: "EFH",
    label: "Einfamilienhaus",
  },
  {
    value: "semi_detached",
    abbreviation: "DHH",
    label: "Doppelhaushälfte",
  },
  {
    value: "terraced_house",
    abbreviation: "RH",
    label: "Reihenhaus",
  },
  {
    value: "commercial",
    abbreviation: "GEW",
    label: "Gewerbeimmobilie",
  },
] as const;

export type PropertyType = (typeof propertyTypeOptions)[number]["value"];

const legacyPropertyTypes: Record<
  string,
  { abbreviation: string; label: string }
> = {
  mixed_use: {
    abbreviation: "WGH",
    label: "Wohn- und Geschäftshaus",
  },
};

export function propertyTypeDetails(value: unknown) {
  if (typeof value !== "string") {
    return { abbreviation: "–", label: "Nicht hinterlegt" };
  }
  return (
    propertyTypeOptions.find((option) => option.value === value) ??
    legacyPropertyTypes[value] ?? {
      abbreviation: value.toUpperCase(),
      label: value.replaceAll("_", " "),
    }
  );
}

export function propertyTypeLabel(value: unknown, includeAbbreviation = true) {
  const details = propertyTypeDetails(value);
  return includeAbbreviation
    ? `${details.abbreviation} · ${details.label}`
    : details.label;
}

export function propertySupportsMultipleUnits(value: unknown) {
  return value === "apartment_building";
}

export interface AcquisitionAllocationInput {
  purchasePriceCents: MoneyCents;
  landAreaSquareMeters: number;
  standardLandValueCentsPerSquareMeter: MoneyCents;
  landOwnershipShare?: DecimalRate;
  realEstateTransferTaxRate: DecimalRate;
  brokerFeeCents: MoneyCents;
  notaryAndLandRegistryFeeCents: MoneyCents;
  otherAcquisitionCostsCents?: MoneyCents;
}

export interface AcquisitionAllocationResult {
  landValueCents: MoneyCents;
  buildingPurchasePriceCents: MoneyCents;
  realEstateTransferTaxCents: MoneyCents;
  acquisitionCostsCents: MoneyCents;
  totalAcquisitionCostCents: MoneyCents;
  buildingValueCents: MoneyCents;
}

/**
 * Transparente Kaufpreisaufteilung für die Erfassung. Der Bodenwert ist die
 * editierbare Annahme aus Bodenrichtwert × Grundstücksfläche. Die Funktion
 * ersetzt keine steuerlich verbindliche Kaufpreisaufteilung.
 */
export function calculateAcquisitionAllocation(
  input: AcquisitionAllocationInput,
): AcquisitionAllocationResult {
  assertMoneyCents(input.purchasePriceCents, "purchasePriceCents");
  assertMoneyCents(
    input.standardLandValueCentsPerSquareMeter,
    "standardLandValueCentsPerSquareMeter",
  );
  assertMoneyCents(input.brokerFeeCents, "brokerFeeCents");
  assertMoneyCents(
    input.notaryAndLandRegistryFeeCents,
    "notaryAndLandRegistryFeeCents",
  );
  const otherAcquisitionCostsCents =
    input.otherAcquisitionCostsCents ?? 0;
  assertMoneyCents(
    otherAcquisitionCostsCents,
    "otherAcquisitionCostsCents",
  );
  assertDecimalRate(
    input.realEstateTransferTaxRate,
    "realEstateTransferTaxRate",
    { maximum: 1 },
  );
  const landOwnershipShare = input.landOwnershipShare ?? 1;
  assertDecimalRate(landOwnershipShare, "landOwnershipShare", {
    maximum: 1,
  });
  if (
    !Number.isFinite(input.landAreaSquareMeters) ||
    input.landAreaSquareMeters < 0
  ) {
    throw new DomainValidationError(
      "landAreaSquareMeters muss eine nicht negative Zahl sein.",
      "landAreaSquareMeters",
    );
  }

  const landValueCents = roundHalfAwayFromZero(
    input.landAreaSquareMeters *
      input.standardLandValueCentsPerSquareMeter *
      landOwnershipShare,
  );
  const realEstateTransferTaxCents = roundHalfAwayFromZero(
    input.purchasePriceCents * input.realEstateTransferTaxRate,
  );
  const acquisitionCostsCents = sumCents([
    realEstateTransferTaxCents,
    input.brokerFeeCents,
    input.notaryAndLandRegistryFeeCents,
    otherAcquisitionCostsCents,
  ]);
  const totalAcquisitionCostCents = sumCents([
    input.purchasePriceCents,
    acquisitionCostsCents,
  ]);

  if (landValueCents > totalAcquisitionCostCents) {
    throw new DomainValidationError(
      "Der berechnete Grundstücksanteil darf Kaufpreis und Kaufnebenkosten nicht übersteigen.",
      "standardLandValueCentsPerSquareMeter",
    );
  }

  return {
    landValueCents,
    buildingPurchasePriceCents: Math.max(
      0,
      input.purchasePriceCents - landValueCents,
    ),
    realEstateTransferTaxCents,
    acquisitionCostsCents,
    totalAcquisitionCostCents,
    buildingValueCents: totalAcquisitionCostCents - landValueCents,
  };
}
