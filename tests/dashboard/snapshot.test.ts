import { describe, expect, it } from "vitest";
import { getDemoDashboardSnapshot } from "@/lib/dashboard/demo";
import {
  buildDashboardSnapshot,
  type DashboardSource,
} from "@/lib/dashboard/snapshot";

function liveSource(
  overrides: Partial<DashboardSource> = {},
): DashboardSource {
  return {
    mode: "live",
    organizationName: "Testverwaltung",
    asOfDate: "2026-07-31",
    sourceState: "ready",
    properties: [],
    units: [],
    leases: [],
    rentClaims: [],
    rentPayments: [],
    income: [],
    expenses: [],
    loans: [],
    loansAvailable: true,
    unresolvedDocuments: 0,
    tasks: [],
    renovations: [],
    taxRate: null,
    monthlyDepreciationCents: 0,
    ...overrides,
  };
}

describe("dashboard snapshot", () => {
  it("reconciles the fictional demo portfolio without mixing cashflow layers", () => {
    const snapshot = getDemoDashboardSnapshot();

    expect(snapshot.mode).toBe("demo");
    expect(snapshot.sourceState).toBe("ready");
    expect(snapshot.metrics.propertyCount).toBe(2);
    expect(snapshot.metrics.unitCount).toBe(6);
    expect(snapshot.metrics.occupiedUnitCount).toBe(5);
    expect(snapshot.metrics.vacantUnitCount).toBe(1);
    expect(snapshot.metrics.vacancyRate).toBeCloseTo(1 / 6, 6);
    expect(snapshot.metrics.monthlyTargetRentCents).toBe(506_000);
    expect(snapshot.metrics.monthlyActualRentCents).toBe(379_000);
    expect(snapshot.metrics.openRentCents).toBe(127_000);
    expect(snapshot.metrics.monthlyExpensesCents).toBe(729_400);
    expect(snapshot.metrics.operatingCashflowCents).toBe(194_600);
    expect(snapshot.metrics.financingCashflowCents).toBe(-400);
    expect(snapshot.metrics.estimatedAfterTaxCents).toBe(19_680);
    expect(snapshot.metrics.portfolioValueCents).toBe(135_800_000);
    expect(snapshot.metrics.loanBalanceCents).toBe(66_180_000);
    expect(snapshot.metrics.equityCents).toBe(69_620_000);
  });

  it("never invents historic actual payments for the demo chart", () => {
    const snapshot = getDemoDashboardSnapshot();
    const january = snapshot.months.find((point) => point.month === "2026-01");

    expect(january?.targetRentCents).toBeGreaterThan(0);
    expect(january?.actualRentCents).toBe(0);
    expect(january?.incomeCents).toBe(0);
  });

  it("keeps a real empty organization empty instead of substituting demo data", () => {
    const snapshot = buildDashboardSnapshot(liveSource({
      organizationName: "Leere Organisation",
      sourceState: "empty",
    }));

    expect(snapshot.sourceState).toBe("empty");
    expect(snapshot.metrics.propertyCount).toBe(0);
    expect(snapshot.metrics.portfolioValueCents).toBeNull();
    expect(snapshot.metrics.vacancyRate).toBeNull();
    expect(snapshot.metrics.estimatedAfterTaxCents).toBeNull();
    expect(snapshot.months.every((point) => point.actualRentCents === 0)).toBe(
      true,
    );
  });

  it("deduplicates hybrid rent sources only by stable bank transaction id", () => {
    const snapshot = buildDashboardSnapshot(
      liveSource({
        rentPayments: [
          {
            paidOn: "2026-07-02",
            amountCents: 100_000,
            bankTransactionId: "bank-transaction-1",
          },
        ],
        income: [
          {
            propertyId: null,
            entryDate: "2026-07-02",
            amountCents: 100_000,
            category: "rent",
            bankTransactionId: "bank-transaction-1",
          },
          {
            propertyId: null,
            entryDate: "2026-07-03",
            amountCents: 50_000,
            category: "rent",
            bankTransactionId: "bank-transaction-2",
          },
          {
            propertyId: null,
            entryDate: "2026-07-04",
            amountCents: 40_000,
            category: "rent",
            bankTransactionId: null,
          },
        ],
      }),
    );

    expect(snapshot.metrics.monthlyActualRentCents).toBe(150_000);
  });

  it("marks loan-derived metrics unavailable instead of inventing zero debt", () => {
    const snapshot = buildDashboardSnapshot(
      liveSource({
        sourceState: "partial",
        properties: [
          {
            id: "property-1",
            name: "Testimmobilie",
            purchasePriceCents: 80_000_000,
            acquisitionCostsCents: 0,
            buildingValueCents: null,
            currentMarketValueCents: 100_000_000,
            purchaseDate: null,
          },
        ],
        loansAvailable: false,
      }),
    );

    expect(snapshot.metrics.loansAvailable).toBe(false);
    expect(snapshot.metrics.loanBalanceCents).toBeNull();
    expect(snapshot.metrics.equityCents).toBeNull();
    expect(snapshot.metrics.loanToValue).toBeNull();
    expect(snapshot.properties[0]?.equityCents).toBeNull();
  });
});
