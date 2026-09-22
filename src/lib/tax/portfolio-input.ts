import {
  DEFAULT_INVESTMENT_TAX_INPUT,
  validateInvestmentTaxInput,
  type InvestmentTaxInput,
} from "@/lib/domain/investment-tax";
import type { Database } from "@/types/database";

export type InvestmentPropertyRow = Pick<
  Database["public"]["Tables"]["properties"]["Row"],
  | "id" | "name" | "property_type" | "property_mode" | "country_code"
  | "purchase_price_cents" | "acquisition_costs_cents" | "purchase_date"
  | "construction_year" | "land_value_cents" | "land_area_sqm"
  | "standard_land_value_cents_per_sqm" | "land_ownership_share"
  | "rentable_area_sqm" | "total_area_sqm"
>;

export interface InvestmentPropertyOption {
  id: string;
  name: string;
  input: InvestmentTaxInput;
  /** Must be shown when importing: a seed is an editable model, not a tax record. */
  assumptions: string[];
}

const residentialTypes = new Set([
  "condominium", "apartment_building", "single_family", "semi_detached", "terraced_house",
]);

function cents(value: number | null): value is number {
  return value !== null && Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000_000_000;
}

/**
 * Imports original purchase data, never a market valuation or a stored tax basis.
 * The database only knows the construction YEAR. Therefore this mapper only
 * accepts buildings finished in an earlier year than their acquisition; a Jan 1
 * placeholder cannot change their rate or the real acquisition-month proration.
 * Same-year new builds need an exact user-supplied completion date instead.
 */
export function mapInvestmentPropertyToInput(row: InvestmentPropertyRow): InvestmentPropertyOption | null {
  if (!row.id || !row.name.trim() || row.country_code !== "DE"
    || !residentialTypes.has(row.property_type)
    || !["existing", "scenario"].includes(row.property_mode)
    || !cents(row.purchase_price_cents) || row.purchase_price_cents <= 0
    || !cents(row.acquisition_costs_cents)
    || !row.purchase_date || !/^\d{4}-\d{2}-\d{2}$/.test(row.purchase_date)
    || row.construction_year === null || !Number.isInteger(row.construction_year)
    || row.construction_year < 1000 || row.construction_year > 2200
    || row.construction_year >= Number(row.purchase_date.slice(0, 4))) return null;

  let landValueCents = row.land_value_cents;
  let landWasEstimated = false;
  if (landValueCents === null) {
    if (row.land_area_sqm === null || !Number.isFinite(row.land_area_sqm) || row.land_area_sqm <= 0
      || !cents(row.standard_land_value_cents_per_sqm)
      || !Number.isFinite(row.land_ownership_share) || row.land_ownership_share < 0 || row.land_ownership_share > 1) return null;
    landValueCents = Math.round(row.land_area_sqm * row.standard_land_value_cents_per_sqm * row.land_ownership_share);
    landWasEstimated = true;
  }
  // Never replace an invalid saved land amount with a more convenient estimate.
  if (!cents(landValueCents) || landValueCents > row.purchase_price_cents) return null;

  const input: InvestmentTaxInput = {
    ...DEFAULT_INVESTMENT_TAX_INPUT,
    purchasePriceCents: row.purchase_price_cents,
    acquisitionCostsCents: row.acquisition_costs_cents,
    landShareRate: landValueCents / row.purchase_price_cents,
    completionDate: `${row.construction_year}-01-01`,
    acquisitionDate: row.purchase_date,
    propertyKind: "existing",
    usage: "rented",
    // Subsequent works and special entitlements cannot be inferred from an
    // aggregate property value. The user must enter and confirm them separately.
    capitalizedMeasuresCents: 0,
    certifiedHeritageCostsCents: 0,
  };
  // These are optional context fields, so incomplete area does not fabricate a
  // square-metre figure or prevent comparison of ordinary existing buildings.
  const area = row.rentable_area_sqm ?? row.total_area_sqm;
  if (area !== null && Number.isFinite(area) && area > 0 && area <= 1_000_000) {
    input.livingAreaSquareMeters = area;
  }
  if (validateInvestmentTaxInput(input).length) return null;

  return {
    id: row.id,
    name: row.name,
    input,
    assumptions: [
      `Baujahr ${row.construction_year} übernommen. Der 01.01. ist ein Datumsplatzhalter; bei Erwerb in einem späteren Jahr ändert er weder AfA-Satz noch Anschaffungsmonate.`,
      "Vermietung ist eine Modellannahme; tatsächliche Nutzung bitte prüfen.",
      "42 % Grenzsteuersatz und 20 Kalenderjahre ab Anschaffung sind editierbare Modellannahmen, keine Werte aus deinem Steuerprofil.",
      landWasEstimated
        ? "Der Grundstücksanteil wurde aus gespeicherter Grundstücksfläche, Bodenrichtwert und Eigentumsanteil geschätzt. Kaufpreisaufteilung bitte prüfen."
        : "Der gespeicherte Grundstücksanteil wird übernommen; Kaufnebenkosten werden proportional auf Gebäude und Grundstück verteilt.",
      "Zusätzliche Maßnahmen, Denkmalförderung und frühere Steuererklärungen wurden nicht übernommen. Bei Schenkung, Erbschaft, Nutzungswechsel oder gemischter Nutzung ist dieses Erwerbsmodell nicht geeignet.",
    ],
  };
}

export function mapInvestmentProperties(rows: readonly InvestmentPropertyRow[]): {
  properties: InvestmentPropertyOption[];
  skippedCount: number;
} {
  const properties = rows.flatMap((row) => {
    const option = mapInvestmentPropertyToInput(row);
    return option ? [option] : [];
  });
  return { properties, skippedCount: rows.length - properties.length };
}
