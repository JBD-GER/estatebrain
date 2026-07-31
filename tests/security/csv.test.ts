import { describe, expect, it } from "vitest";
import {
  encodeCsvCell,
  protectSpreadsheetCell,
  rowsToCsv,
} from "@/lib/exports/csv";

describe("CSV export hardening", () => {
  it.each(["=1+1", "+cmd", "-2+3", "@SUM(A1:A2)", "  =HYPERLINK()"])(
    "neutralizes spreadsheet formula input %s",
    (value) => {
      expect(protectSpreadsheetCell(value)).toBe(`'${value}`);
    },
  );

  it("escapes quotes, commas and newlines", () => {
    expect(encodeCsvCell('Müller, "Haus"')).toBe(
      '"Müller, ""Haus"""',
    );
  });

  it("writes an Excel-compatible UTF-8 CSV with stable columns", () => {
    const csv = rowsToCsv({
      columns: [
        { key: "name", label: "Name" },
        { key: "value", label: "Wert" },
      ],
      rows: [{ name: "=IMPORTXML()", value: 42 }],
    });

    expect(csv.startsWith("\uFEFFName,Wert\r\n")).toBe(true);
    expect(csv).toContain("'=IMPORTXML(),42");
  });
});
