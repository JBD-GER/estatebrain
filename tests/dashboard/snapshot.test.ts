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
    loanPayments: [],
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
    expect(snapshot.metrics.monthlyExpensesCents).toBe(851_900);
    expect(snapshot.metrics.monthlyAncillaryIncomeCents).toBe(69_084);
    expect(snapshot.metrics.operatingCashflowCents).toBe(-224_484);
    expect(snapshot.metrics.financingCashflowCents).toBe(-541_984);
    expect(snapshot.metrics.estimatedAfterTaxCents).toBe(-554_964);
    expect(snapshot.metrics.portfolioValueCents).toBe(135_800_000);
    expect(snapshot.metrics.loanBalanceCents).toBe(66_180_000);
    expect(snapshot.metrics.equityCents).toBe(69_620_000);
  });

  it("adds parking to contract rent and excludes ancillary pass-throughs exactly once", () => {
    const snapshot = buildDashboardSnapshot(liveSource({
      properties: [{id:"p",name:"Haus",purchasePriceCents:10000000,acquisitionCostsCents:0,buildingValueCents:null,currentMarketValueCents:null,purchaseDate:null}],
      units: [{id:"u",propertyId:"p",label:"1",areaSquareMeters:65,targetColdRentCents:100000,status:"rented"}],
      leases: [{id:"l",unitId:"u",startsOn:"2026-01-01",endsOn:null,coldRentCents:100000,parkingCents:10000,ancillaryCents:30000,otherCents:0,status:"active"}],
      // Historic claim, not today's changed ancillary amount, determines the deduction.
      rentClaims: [{id:"c",leaseId:"l",claimMonth:"2026-07-01",dueDate:"2026-07-01",amountCents:130000,ancillaryCents:20000,paidCents:130000,status:"paid"}],
      rentPayments: [{rentClaimId:"c",paidOn:"2026-07-01",amountCents:130000,bankTransactionId:"bank-rent"}],
      income: [{propertyId:"p",entryDate:"2026-07-01",amountCents:130000,category:"rent",bankTransactionId:"bank-rent"}],
      expenses: [
        {propertyId:"p",entryDate:"2026-07-02",amountCents:20000,bankTransactionId:null,cashEffective:true,isInterest:false,isPrincipal:false,isCapitalizable:false,isDeductible:true,isRecoverable:true},
        {propertyId:"p",entryDate:"2026-07-02",amountCents:10000,bankTransactionId:null,cashEffective:true,isInterest:false,isPrincipal:false,isCapitalizable:false,isDeductible:true,isRecoverable:false},
      ],
      loans: [{id:"loan",propertyId:"p",currentBalanceCents:1000000,monthlyPaymentCents:20000,fixedRateUntil:null,status:"active"}],
    }));
    expect(snapshot.metrics.monthlyContractColdRentCents).toBe(110000);
    expect(snapshot.metrics.monthlyActualRentCents).toBe(130000);
    expect(snapshot.metrics.monthlyAncillaryIncomeCents).toBe(20000);
    expect(snapshot.metrics.monthlyCashExpensesCents).toBe(10000);
    expect(snapshot.metrics.financingCashflowCents).toBe(80000);
    expect(snapshot.properties[0]).toMatchObject({monthlyContractColdRentCents:110000,monthlyIncomeCents:110000,monthlyAncillaryIncomeCents:20000,monthlyCashflowAfterFinancingCents:80000});
    expect(snapshot.months.at(-1)?.financingCashflowCents).toBe(80000);
    expect(snapshot.metrics.grossRentalYield).toBeCloseTo(0.132);
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
        properties: [
          {
            id: "property-1",
            name: "Testimmobilie",
            purchasePriceCents: 1_000_000,
            acquisitionCostsCents: 0,
            buildingValueCents: null,
            currentMarketValueCents: null,
            purchaseDate: null,
          },
          {
            id: "property-2",
            name: "Zweite Testimmobilie",
            purchasePriceCents: 1_000_000,
            acquisitionCostsCents: 0,
            buildingValueCents: null,
            currentMarketValueCents: null,
            purchaseDate: null,
          },
        ],
        units: [
          {
            id: "unit-1",
            propertyId: "property-1",
            label: "WE 1",
            areaSquareMeters: null,
            targetColdRentCents: 0,
            status: "occupied",
          },
        ],
        leases: [
          {
            id: "lease-1",
            unitId: "unit-1",
            startsOn: "2026-01-01",
            endsOn: null,
            coldRentCents: 100_000,
            ancillaryCents: 0,
            parkingCents: 0,
            otherCents: 0,
            status: "active",
          },
        ],
        rentClaims: [
          {
            id: "claim-1",
            leaseId: "lease-1",
            claimMonth: "2026-07-01",
            dueDate: "2026-07-03",
            amountCents: 100_000,
            paidCents: 100_000,
            status: "paid",
          },
        ],
        rentPayments: [
          {
            rentClaimId: "claim-1",
            paidOn: "2026-07-02",
            amountCents: 100_000,
            bankTransactionId: "bank-transaction-1",
          },
        ],
        income: [
          {
            propertyId: "property-1",
            entryDate: "2026-07-02",
            amountCents: 100_000,
            category: "rent",
            bankTransactionId: "bank-transaction-1",
          },
          {
            propertyId: "property-1",
            entryDate: "2026-07-03",
            amountCents: 50_000,
            category: "rent",
            bankTransactionId: "bank-transaction-2",
          },
          {
            propertyId: "property-2",
            entryDate: "2026-07-04",
            amountCents: 40_000,
            category: "rent",
            bankTransactionId: null,
          },
        ],
      }),
    );

    expect(snapshot.metrics.monthlyActualRentCents).toBe(190_000);
  });

  it("reconciles two properties and keeps actual and forecast debt service separate", () => {
    const expense = (
      propertyId: string,
      entryDate: string,
      amountCents: number,
      flags: { interest?: boolean; principal?: boolean } = {},
    ) => ({
      propertyId,
      entryDate,
      amountCents,
      bankTransactionId: null,
      cashEffective: true,
      isInterest: flags.interest ?? false,
      isPrincipal: flags.principal ?? false,
      isCapitalizable: false,
      isDeductible: !flags.principal,
    });
    const snapshot = buildDashboardSnapshot(
      liveSource({
        properties: [
          {
            id: "property-positive",
            name: "Haus Grün",
            purchasePriceCents: 30_000_000,
            acquisitionCostsCents: 0,
            buildingValueCents: null,
            currentMarketValueCents: 35_000_000,
            purchaseDate: "2020-01-01",
          },
          {
            id: "property-negative",
            name: "Haus Rot",
            purchasePriceCents: 20_000_000,
            acquisitionCostsCents: 0,
            buildingValueCents: null,
            currentMarketValueCents: 18_000_000,
            purchaseDate: "2021-01-01",
          },
        ],
        units: [
          {
            id: "unit-positive",
            propertyId: "property-positive",
            label: "WE 1",
            areaSquareMeters: 70,
            targetColdRentCents: 120_000,
            status: "occupied",
          },
          {
            id: "unit-negative",
            propertyId: "property-negative",
            label: "WE 1",
            areaSquareMeters: 55,
            targetColdRentCents: 80_000,
            status: "occupied",
          },
        ],
        leases: [
          {
            id: "lease-positive",
            unitId: "unit-positive",
            startsOn: "2025-01-01",
            endsOn: null,
            coldRentCents: 100_000,
            ancillaryCents: 0,
            parkingCents: 0,
            otherCents: 0,
            status: "active",
          },
          {
            id: "lease-negative",
            unitId: "unit-negative",
            startsOn: "2025-01-01",
            endsOn: null,
            coldRentCents: 70_000,
            ancillaryCents: 0,
            parkingCents: 0,
            otherCents: 0,
            status: "active",
          },
        ],
        rentClaims: [
          {
            id: "claim-positive",
            leaseId: "lease-positive",
            claimMonth: "2026-07-01",
            dueDate: "2026-07-03",
            amountCents: 100_000,
            paidCents: 100_000,
            status: "paid",
          },
          {
            id: "claim-negative",
            leaseId: "lease-negative",
            claimMonth: "2026-07-01",
            dueDate: "2026-07-03",
            amountCents: 70_000,
            paidCents: 70_000,
            status: "paid",
          },
        ],
        rentPayments: [
          {
            rentClaimId: "claim-positive",
            paidOn: "2026-07-02",
            amountCents: 100_000,
            bankTransactionId: "rent-positive",
          },
          {
            rentClaimId: "claim-negative",
            paidOn: "2026-07-02",
            amountCents: 70_000,
            bankTransactionId: "rent-negative",
          },
        ],
        income: [
          {
            propertyId: "property-positive",
            entryDate: "2026-07-02",
            amountCents: 100_000,
            category: "rent",
            bankTransactionId: "rent-positive",
          },
          {
            propertyId: "property-positive",
            entryDate: "2026-07-05",
            amountCents: 20_000,
            category: "insurance_reimbursement",
            bankTransactionId: null,
          },
        ],
        expenses: [
          expense("property-positive", "2026-07-10", 30_000),
          expense("property-positive", "2026-02-10", 15_000),
          expense("property-positive", "2026-07-15", 20_000, {
            interest: true,
          }),
          expense("property-positive", "2026-07-15", 30_000, {
            principal: true,
          }),
          expense("property-negative", "2026-07-10", 90_000),
          expense("property-negative", "2026-03-10", 20_000),
          expense("property-negative", "2026-07-15", 10_000, {
            interest: true,
          }),
          expense("property-negative", "2026-07-15", 30_000, {
            principal: true,
          }),
        ],
        loans: [
          {
            id: "loan-positive",
            propertyId: "property-positive",
            currentBalanceCents: 10_000_000,
            monthlyPaymentCents: 55_000,
            fixedRateUntil: "2030-12-31",
            status: "active",
          },
          {
            id: "loan-negative",
            propertyId: "property-negative",
            currentBalanceCents: 8_000_000,
            monthlyPaymentCents: 40_000,
            fixedRateUntil: "2029-12-31",
            status: "active",
          },
        ],
        loanPayments: [
          {
            loanId: "loan-positive",
            dueDate: "2026-07-15",
            paidOn: "2026-07-15",
            paymentCents: 50_000,
            interestCents: 20_000,
            principalCents: 25_000,
            feesCents: 5_000,
            status: "paid",
            bankTransactionId: "loan-payment-positive",
          },
        ],
      }),
    );

    const positive = snapshot.properties.find(
      (property) => property.id === "property-positive",
    );
    const negative = snapshot.properties.find(
      (property) => property.id === "property-negative",
    );

    expect(positive).toMatchObject({
      monthlyContractColdRentCents: 100_000,
      monthlyMarketColdRentCents: 120_000,
      monthlyRentPaymentsCents: 100_000,
      monthlyIncomeCents: 120_000,
      monthlyCashExpensesCents: 30_000,
      monthlyDebtServiceCents: 50_000,
      debtServiceMode: "actual",
      monthlyCashflowAfterFinancingCents: 40_000,
      currentYearExpensesCents: 45_000,
    });
    expect(negative).toMatchObject({
      monthlyContractColdRentCents: 70_000,
      monthlyMarketColdRentCents: 80_000,
      monthlyRentPaymentsCents: 70_000,
      monthlyIncomeCents: 70_000,
      monthlyCashExpensesCents: 90_000,
      monthlyDebtServiceCents: 40_000,
      debtServiceMode: "forecast",
      monthlyCashflowAfterFinancingCents: -60_000,
      currentYearExpensesCents: 110_000,
    });

    expect(snapshot.metrics).toMatchObject({
      monthlyContractColdRentCents: 170_000,
      monthlyMarketColdRentCents: 200_000,
      monthlyActualRentCents: 170_000,
      monthlyCashExpensesCents: 120_000,
      monthlyDebtServiceCents: 90_000,
      debtServiceMode: "mixed",
      monthlyExpensesCents: 210_000,
      operatingCashflowCents: 70_000,
      financingCashflowCents: -20_000,
      currentYearExpensesCents: 155_000,
    });
    expect(snapshot.metrics.monthlyActualRentCents).toBe(
      snapshot.properties.reduce(
        (sum, property) => sum + property.monthlyRentPaymentsCents,
        0,
      ),
    );
    expect(snapshot.metrics.monthlyCashExpensesCents).toBe(
      snapshot.properties.reduce(
        (sum, property) => sum + property.monthlyCashExpensesCents,
        0,
      ),
    );
    expect(snapshot.metrics.monthlyDebtServiceCents).toBe(
      snapshot.properties.reduce(
        (sum, property) => sum + property.monthlyDebtServiceCents,
        0,
      ),
    );
    expect(snapshot.metrics.financingCashflowCents).toBe(
      snapshot.properties.reduce(
        (sum, property) =>
          sum + property.monthlyCashflowAfterFinancingCents,
        0,
      ),
    );
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
