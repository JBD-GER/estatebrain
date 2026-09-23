import type { ModuleField } from "@/lib/modules";

export const editableModules = new Set([
  "immobilien", "einheiten", "mietverhaeltnisse", "finanzierungen",
  "sanierungen", "markt", "kommunikation", "aufgaben", "mieter",
]);

export function recordFieldValues(fields: ModuleField[], row: Record<string, unknown>) {
  return Object.fromEntries(fields.map((field) => {
    const value = row[field.name];
    if (value === null || value === undefined) return [field.name, ""];
    if (field.type === "date") return [field.name, String(value).slice(0, 10)];
    if (field.type === "money") return [field.name, (Number(value) / 100).toFixed(2)];
    if (field.percentageRate) return [field.name, String(Number(value) * 100)];
    return [field.name, String(value)];
  }));
}
