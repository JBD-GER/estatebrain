import { describe, expect, it } from "vitest";

import {
  calculateActualRent,
  calculateAnnuityPaymentCents,
  calculateCashflowAfterFinancingCents,
  calculateCostPerSquareMeterCents,
  calculateDebtServiceCoverageRatio,
  calculateEstimatedEquityCents,
  calculateGrossRentalYield,
  calculateInitialAnnuityPaymentCents,
  calculateLoanPaymentSplit,
  calculateLoanToValue,
  calculateMonthlyLeaseRentCents,
  calculateNetRentalYield,
  calculateOperatingCashflowCents,
  calculatePurchasePriceFactor,
  calculateRenovationBacklogScore,
  calculateRenovationReserve,
  calculateRentPerSquareMeterCents,
  calculateRentReconciliation,
  calculateReturnOnEquity,
  calculateSaleScenario,
  calculateTargetRent,
  calculateVacancyRateByArea,
  generateAmortizationSchedule,
  roundHalfAwayFromZero,
  toCents,
} from "../../src/lib/domain";
import type { RenovationMeasure } from "../../src/lib/domain";

describe("Geld- und Mietberechnungen", () => {
  it("rundet halbe Centwerte symmetrisch weg von null", () => {
    expect(roundHalfAwayFromZero(10.5)).toBe(11);
    expect(roundHalfAwayFromZero(-10.5)).toBe(-11);
    expect(toCents(12.34)).toBe(1_234);
    expect(toCents(1.005)).toBe(101);
    expect(toCents(-1.005)).toBe(-101);
  });

  it("berechnet Soll-, Ist-Miete, Rückstand und Überzahlung nachvollziehbar", () => {
    expect(
      calculateMonthlyLeaseRentCents({
        baseRentCents: 82_000,
        serviceChargeCents: 19_000,
        parkingRentCents: 4_000,
      }),
    ).toBe(105_000);

    const target = calculateTargetRent([
      { amountCents: 105_000 },
      { amountCents: 90_000 },
      { amountCents: null },
      { amountCents: 77_000, status: "cancelled" },
    ]);
    const actual = calculateActualRent([
      { amountCents: 105_000, status: "booked" },
      { amountCents: 45_000, status: "booked" },
      { amountCents: 90_000, status: "pending" },
      { amountCents: null, status: "booked" },
    ]);

    expect(target).toEqual({
      totalCents: 195_000,
      includedItems: 2,
      ignoredItems: 1,
      missingItems: 1,
    });
    expect(actual.totalCents).toBe(150_000);
    expect(actual.missingItems).toBe(1);
    expect(calculateRentReconciliation(195_000, 150_000)).toEqual({
      targetRentCents: 195_000,
      actualRentCents: 150_000,
      arrearsCents: 45_000,
      overpaymentCents: 0,
      coverageRatio: 0.769231,
    });
    expect(calculateRentReconciliation(100_000, 105_000).overpaymentCents).toBe(
      5_000,
    );
  });

  it("liefert bei nicht berechenbaren Nennern null und validiert Flächen", () => {
    expect(
      calculateVacancyRateByArea({
        vacantAreaSquareMeters: 48,
        totalAreaSquareMeters: 239,
      }),
    ).toBe(0.200837);
    expect(
      calculateVacancyRateByArea({
        vacantAreaSquareMeters: 0,
        totalAreaSquareMeters: 0,
      }),
    ).toBeNull();
    expect(
      calculateRentPerSquareMeterCents({
        monthlyRentCents: 105_000,
        areaSquareMeters: 72,
      }),
    ).toBe(1_458);
    expect(
      calculateCostPerSquareMeterCents({
        costCents: 500_000,
        areaSquareMeters: 0,
      }),
    ).toBeNull();
    expect(() =>
      calculateVacancyRateByArea({
        vacantAreaSquareMeters: 101,
        totalAreaSquareMeters: 100,
      }),
    ).toThrow();
  });
});

describe("Rendite- und Cashflow-Kennzahlen", () => {
  it("berechnet Brutto-/Nettorendite, Faktor und Eigenkapitalrendite", () => {
    expect(
      calculateGrossRentalYield({
        annualColdRentCents: 6_000_000,
        purchasePriceCents: 100_000_000,
      }),
    ).toBe(0.06);
    expect(
      calculateNetRentalYield({
        annualRentCents: 6_000_000,
        annualNonRecoverableExpensesCents: 1_000_000,
        purchasePriceCents: 100_000_000,
        acquisitionCostsCents: 10_000_000,
      }),
    ).toBe(0.045455);
    expect(
      calculatePurchasePriceFactor({
        purchasePriceCents: 100_000_000,
        annualColdRentCents: 5_000_000,
      }),
    ).toBe(20);
    expect(
      calculateReturnOnEquity({
        annualCashflowCents: 1_200_000,
        investedEquityCents: 20_000_000,
      }),
    ).toBe(0.06);
    expect(
      calculateReturnOnEquity({
        annualCashflowCents: 1_200_000,
        investedEquityCents: 0,
      }),
    ).toBeNull();
  });

  it("trennt operativen Cashflow von Finanzierung", () => {
    const operating = calculateOperatingCashflowCents({
      operatingIncomeCents: [500_000, 30_000],
      operatingExpensesCents: [120_000, 25_000],
    });
    expect(operating).toBe(385_000);
    expect(
      calculateCashflowAfterFinancingCents({
        operatingCashflowCents: operating,
        interestPaidCents: 90_000,
        principalPaidCents: 70_000,
        otherFinancingCostsCents: 5_000,
      }),
    ).toBe(220_000);
  });
});

describe("Finanzierung", () => {
  it("berechnet Annuitäten mit dokumentierter Cent-Rundung", () => {
    expect(
      calculateAnnuityPaymentCents({
        principalCents: 10_000_000,
        annualInterestRate: 0,
        termMonths: 10,
      }),
    ).toBe(1_000_000);
    expect(
      calculateAnnuityPaymentCents({
        principalCents: 10_000_000,
        annualInterestRate: 0.06,
        termMonths: 12,
      }),
    ).toBe(860_664);
    expect(
      calculateInitialAnnuityPaymentCents({
        principalCents: 10_000_000,
        annualInterestRate: 0.03,
        initialAnnualRepaymentRate: 0.02,
      }),
    ).toBe(41_667);
  });

  it("teilt Rate in Zins und Tilgung und erstellt eine Restschuldreihe", () => {
    expect(
      calculateLoanPaymentSplit({
        openingBalanceCents: 10_000_000,
        annualInterestRate: 0.036,
        scheduledPaymentCents: 50_000,
      }),
    ).toEqual({
      openingBalanceCents: 10_000_000,
      paymentCents: 50_000,
      interestCents: 30_000,
      principalCents: 20_000,
      closingBalanceCents: 9_980_000,
    });

    const schedule = generateAmortizationSchedule({
      principalCents: 120_000,
      annualInterestRate: 0,
      monthlyPaymentCents: 10_000,
      numberOfPayments: 12,
      firstPaymentDate: "2026-01-31",
      extraPayments: [{ paymentNumber: 2, amountCents: 20_000 }],
    });
    expect(schedule).toHaveLength(10);
    expect(schedule[1]).toMatchObject({
      paymentDate: "2026-02-28",
      extraPrincipalCents: 20_000,
      closingBalanceCents: 80_000,
    });
    expect(schedule.at(-1)?.closingBalanceCents).toBe(0);
  });

  it("berechnet LTV und DSCR und verweigert einen ungedeckten Zins", () => {
    expect(
      calculateLoanToValue({
        outstandingLoanCents: 50_000_000,
        marketValueCents: 100_000_000,
      }),
    ).toBe(0.5);
    expect(
      calculateDebtServiceCoverageRatio({
        netOperatingIncomeCents: 1_500_000,
        debtServiceCents: 1_200_000,
      }),
    ).toBe(1.25);
    expect(() =>
      calculateLoanPaymentSplit({
        openingBalanceCents: 10_000_000,
        annualInterestRate: 0.12,
        scheduledPaymentCents: 50_000,
      }),
    ).toThrow(/deckt nicht/);
  });
});

describe("Sanierungs-, Eigenkapital- und Verkaufsszenarien", () => {
  const measures: RenovationMeasure[] = [
    {
      id: "measure-urgent",
      propertyId: "property-1",
      category: "roof",
      description: "Test",
      condition: "critical",
      priority: "urgent",
      estimatedCostCents: 1_200_000,
      plannedDate: "2026-12-01",
      contingencyRate: 0.1,
      status: "planned",
      isDemo: true,
    },
    {
      id: "measure-later",
      propertyId: "property-1",
      category: "heating",
      description: "Test",
      condition: "fair",
      priority: "medium",
      estimatedCostCents: 600_000,
      plannedDate: "2030-01-01",
      contingencyRate: 0,
      status: "planned",
      isDemo: true,
    },
  ];

  it("verteilt Rücklagen chronologisch und erklärt den Score", () => {
    const reserve = calculateRenovationReserve({
      measures,
      asOfDate: "2026-07-01",
      existingReserveCents: 320_000,
    });
    expect(reserve.totalNeedCents).toBe(1_920_000);
    expect(reserve.uncoveredNeedCents).toBe(1_600_000);
    expect(reserve.items[0]).toMatchObject({
      reserveAllocatedCents: 320_000,
      remainingFundingNeedCents: 1_000_000,
      requiredMonthlyReserveCents: 200_000,
      horizon: "short_term",
    });
    expect(reserve.requiredMonthlyReserveCents).toBe(214_286);

    const score = calculateRenovationBacklogScore({
      measures,
      asOfDate: "2026-07-01",
    });
    expect(score.score).toBeGreaterThan(65);
    expect(score.factors).toHaveLength(2);
    expect(score.disclaimer).toContain("keine technische Begutachtung");
  });

  it("berechnet Eigenkapital und transparentes Verkaufsszenario", () => {
    expect(
      calculateEstimatedEquityCents({
        marketValueCents: 100_000_000,
        outstandingLoanBalancesCents: [55_000_000, 5_000_000],
      }),
    ).toBe(40_000_000);

    const scenario = calculateSaleScenario({
      expectedSalePriceCents: 100_000_000,
      outstandingLoanBalancesCents: [60_000_000],
      sellingCostsCents: 5_000_000,
      prepaymentPenaltiesCents: 1_000_000,
      estimatedTaxesCents: 2_000_000,
      originallyInvestedEquityCents: 20_000_000,
      cumulativeCashflowCents: 4_000_000,
    });
    expect(scenario.netSaleProceedsCents).toBe(32_000_000);
    expect(scenario.modeledProfitCents).toBe(16_000_000);
    expect(scenario.equityMultiple).toBe(1.8);
    expect(scenario.totalReturnOnEquity).toBe(0.8);
  });
});
