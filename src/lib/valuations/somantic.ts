import { z } from "zod";

export const propertyTypes = [
  ["einfamilienhaus", "Einfamilienhaus", "haus"],
  ["doppelhaushaelfte", "Doppelhaushälfte", "haus"],
  ["reihenhaus", "Reihenhaus", "haus"],
  ["zweifamilienhaus", "Zweifamilienhaus", "haus"],
  ["mehrfamilienhaus", "Mehrfamilienhaus", "haus"],
  ["bungalow", "Bungalow", "haus"], ["villa", "Villa", "haus"],
  ["bauernhaus", "Bauernhaus", "haus"],
  ["etagenwohnung", "Etagenwohnung", "wohnung"],
  ["erdgeschosswohnung", "Erdgeschosswohnung", "wohnung"],
  ["dachgeschosswohnung", "Dachgeschosswohnung", "wohnung"],
  ["maisonette", "Maisonette", "wohnung"], ["penthouse", "Penthouse", "wohnung"],
  ["souterrainwohnung", "Souterrainwohnung", "wohnung"],
  ["loft", "Loft", "wohnung"], ["apartment", "Apartment", "wohnung"],
] as const;
export const featureLabels = {
  balcony: "Balkon", terrace: "Terrasse", basement: "Keller", elevator: "Aufzug",
  garden: "Garten", kitchen: "Einbauküche", parking: "Stellplatz", new_building: "Neubau",
} as const;
const optionalNumber = <T extends z.ZodType<number>>(schema: T) => z.preprocess(
  value => value === "" || value == null ? undefined : value, schema.optional(),
);
export const valuationInputSchema = z.object({
  comparison_scope: z.enum(["detailed", "broader"]).default("detailed"),
  typ: z.enum(["wohnung", "haus"], { error: "Bitte Wohnung oder Haus wählen." }),
  street: z.string().trim().min(3, "Straße und Hausnummer ergänzen.").max(200),
  postcode: z.string().regex(/^\d{5}$/, "Bitte eine fünfstellige deutsche PLZ eingeben."),
  city: z.string().trim().min(2, "Bitte den Ort ergänzen.").max(120),
  square_meters: z.coerce.number().positive("Bitte die Wohnfläche ergänzen.").max(100000),
  rooms: optionalNumber(z.coerce.number().positive().max(1000)),
  year_of_construction: optionalNumber(z.coerce.number().int().min(1000).max(2200)),
  property_type: z.string().optional(),
  rented: z.boolean().optional(),
  features: z.object(Object.fromEntries(Object.keys(featureLabels).map(key => [key, z.boolean().optional()])) as Record<keyof typeof featureLabels, z.ZodOptional<z.ZodBoolean>>).optional(),
}).superRefine((value, ctx) => {
  if (value.property_type && !propertyTypes.some(([id, , typ]) => id === value.property_type && typ === value.typ)) {
    ctx.addIssue({code: "custom", path: ["property_type"], message: "Die Objektart passt nicht zu Haus/Wohnung."});
  }
});
export type ValuationInput = z.infer<typeof valuationInputSchema>;

const positive = z.number().finite().nonnegative();
const range = z.object({ low: positive, high: positive });
const statistics = z.object({ count: z.number().int().nonnegative(), mean: positive.nullish(), median: positive.nullish(), p25: positive.nullish(), p75: positive.nullish(), min: positive.nullish(), max: positive.nullish() });
export const valuationResponseSchema = z.object({
  estimates: z.object({
    price: positive.nullish(), rent: positive.nullish(),
    price_range: range.nullish(), rent_range: range.nullish(),
    price_per_square_meter: statistics.nullish(), rent_per_square_meter: statistics.nullish(),
  }),
  confidence: z.object({
    price: z.enum(["high", "medium", "low", "none"]),
    rent: z.enum(["high", "medium", "low", "none"]),
    sample_size: z.number().int().nonnegative(), cluster_size: z.number().int().nonnegative().optional(),
    recency_window_months: z.number().nonnegative().nullish(),
    date_span: z.object({ oldest: z.string().nullish(), newest: z.string().nullish() }).nullish(),
    filters_applied: z.array(z.string()).optional(), filters_skipped: z.array(z.string()).optional(),
  }),
});
export type ValuationResponse = z.infer<typeof valuationResponseSchema>;

// Keep the actual property details in the report; only broaden the provider's filters.
export function somanticRequestBody(input: ValuationInput) {
  const { comparison_scope, property_type, features, ...core } = input;
  return comparison_scope === "broader" ? core : { ...core, property_type, features };
}

export function valuationAvailability(response: ValuationResponse, side: "price" | "rent") {
  if (response.estimates[side] != null) return null;
  const count = response.estimates[side === "price" ? "price_per_square_meter" : "rent_per_square_meter"]?.count;
  const label = side === "price" ? "Kauf" : "Miete";
  return count == null
    ? `Somantic liefert keinen ${side === "price" ? "Kaufpreis" : "Mietwert"}. Für diese Auswahl liegen keine ausreichenden Vergleichsdaten vor; der Anbieter weist keine Vergleichsanzahl aus.`
    : count < 5
      ? `${label}: ${count} passende Vergleichsobjekte. Somantic benötigt mindestens 5 für eine Schätzung. Es fehlen Vergleichsdaten beim Anbieter, keine Pflichtangaben zum Objekt.`
      : `${label}: ${count} Vergleichsobjekte, aber Somantic liefert keinen Schätzwert. Bitte Objektdaten und Auswahl prüfen.`;
}

export function valuationFilterLabel(filter: string) {
  const [key, value] = filter.split("=");
  if (key === "recency" && /^\d+m$/.test(value ?? "")) return `Inserate der letzten ${value.slice(0, -1)} Monate`;
  if (key === "property_type") return `Objektart: ${propertyTypes.find(([id]) => id === value)?.[1] ?? value}`;
  if (key === "tenancy") return value === "rented" ? "Vermietete Kaufobjekte" : value === "vacant" ? "Bezugsfreie Kaufobjekte" : filter;
  return featureLabels[key as keyof typeof featureLabels] ?? filter;
}

export function valuationDefaults(property: Record<string, unknown>, units: Array<{area_sqm: number | null; rooms: number | null; unit_type: string}> = []): Partial<ValuationInput> {
  const details = property.valuation_details as Partial<ValuationInput> | null;
  const types: Record<string, Partial<ValuationInput>> = {
    apartment_building: {typ: "haus", property_type: "mehrfamilienhaus"},
    multi_family: {typ: "haus", property_type: "mehrfamilienhaus"},
    single_family: {typ: "haus", property_type: "einfamilienhaus"},
    condominium: {typ: "wohnung"}, apartment: {typ: "wohnung"},
    semi_detached: {typ: "haus", property_type: "doppelhaushaelfte"},
    terraced_house: {typ: "haus", property_type: "reihenhaus"},
  };
  const residentialUnits = units.length > 0 && units.every(unit=>unit.unit_type === "apartment");
  const knownArea = residentialUnits && units.every(unit=>Number(unit.area_sqm)>0) ? units.reduce((sum,unit)=>sum+Number(unit.area_sqm),0) : undefined;
  const knownRooms = residentialUnits && units.every(unit=>Number(unit.rooms)>0) ? units.reduce((sum,unit)=>sum+Number(unit.rooms),0) : undefined;
  return {
    rooms: knownRooms,
    ...types[String(property.property_type)],
    street: [property.street, property.house_number].filter(Boolean).join(" "),
    postcode: String(property.postal_code ?? ""), city: String(property.city ?? ""),
    // Total/rentable areas can contain commercial space; never silently use them as living area.
    square_meters: Number(property.living_area_sqm) || knownArea,
    year_of_construction: Number(property.construction_year) || undefined,
    ...details,
  };
}
