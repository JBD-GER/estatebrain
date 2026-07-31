export type CsvValue = string | number | boolean | null | undefined;

const FORMULA_PREFIX = /^[\u0000-\u0020]*[=+\-@]/;

export function protectSpreadsheetCell(value: CsvValue) {
  const text =
    value === null || value === undefined
      ? ""
      : typeof value === "boolean"
        ? value
          ? "Ja"
          : "Nein"
        : String(value);

  return FORMULA_PREFIX.test(text) ? `'${text}` : text;
}

export function encodeCsvCell(value: CsvValue) {
  const protectedValue = protectSpreadsheetCell(value);
  return /[",\r\n]/.test(protectedValue)
    ? `"${protectedValue.replaceAll('"', '""')}"`
    : protectedValue;
}

export function rowsToCsv({
  columns,
  rows,
}: {
  columns: ReadonlyArray<{ key: string; label: string }>;
  rows: Array<Record<string, unknown>>;
}) {
  const header = columns.map((column) => encodeCsvCell(column.label)).join(",");
  const body = rows.map((row) =>
    columns
      .map((column) => {
        const value = row[column.key];
        if (
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean" ||
          value === null ||
          value === undefined
        ) {
          return encodeCsvCell(value);
        }
        return encodeCsvCell(JSON.stringify(value));
      })
      .join(","),
  );

  return `\uFEFF${[header, ...body].join("\r\n")}\r\n`;
}
