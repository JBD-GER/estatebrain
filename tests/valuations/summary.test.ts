import { describe, expect, it } from "vitest";
import { valuationSummaryMetrics } from "@/lib/valuations/summary";

describe("valuation history summary", () => {
  it("shows the current 275,429 EUR value once despite two historical reports", () => {
    const metrics = valuationSummaryMetrics([{ current_market_value_cents: 27542900 }], 2);
    expect(metrics[0].value).toBe("1");
    expect(metrics[1].label).toBe("Aktueller Marktwert");
    expect(metrics[1].value.replace(/\s/g, " ")).toBe("275.429,00 €");
    expect(metrics[2].value).toBe("2");
  });
  it("adds the current values of separate properties, not the number of reports", () => {
    const metrics = valuationSummaryMetrics([{ current_market_value_cents: 27542900 }, { current_market_value_cents: 12001000 }, { current_market_value_cents: null }], 17);
    expect(metrics[0].value).toBe("2");
    expect(metrics[1].label).toBe("Aktueller Gesamtwert");
    expect(metrics[1].value.replace(/\s/g, " ")).toBe("395.439,00 €");
  });
  it("distinguishes missing valuations from unavailable data and a saved zero", () => {
    expect(valuationSummaryMetrics([{ current_market_value_cents: null }], 0)[1].value).toBe("Noch kein Marktwert");
    expect(valuationSummaryMetrics(null, 0)[1].value).toBe("Nicht geladen");
    expect(valuationSummaryMetrics([{ current_market_value_cents: 0 }], 1)[1].value.replace(/\s/g, " ")).toBe("0,00 €");
  });
});
