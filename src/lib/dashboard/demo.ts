import { DEMO_DATA } from "@/lib/demo/data";
import {
  calculateDepreciation,
  roundHalfAwayFromZero,
  sumCents,
} from "@/lib/domain";
import { buildDashboardSnapshot } from "@/lib/dashboard/snapshot";

const DEMO_DEPRECIATION_RATE = 0.02;

function demoMonthlyDepreciationCents() {
  return sumCents(
    DEMO_DATA.properties.map((property) => {
      const annual = calculateDepreciation({
        taxYear: Number(DEMO_DATA.generatedForDate.slice(0, 4)),
        buildingBasisCents: property.buildingShareCents,
        placedInServiceDate: property.purchaseDate,
        annualRate: DEMO_DEPRECIATION_RATE,
      }).depreciationCents;
      return roundHalfAwayFromZero(annual / 12);
    }),
  );
}

export function getDemoDashboardSnapshot() {
  return buildDashboardSnapshot({
    mode: "demo",
    organizationName: DEMO_DATA.organization.name,
    asOfDate: DEMO_DATA.generatedForDate,
    sourceState: "ready",
    properties: DEMO_DATA.properties.map((property) => ({
      id: property.id,
      name: property.name,
      purchasePriceCents: property.purchasePriceCents,
      acquisitionCostsCents: property.acquisitionCostsCents,
      buildingValueCents: property.buildingShareCents,
      currentMarketValueCents: property.currentMarketValueCents,
      purchaseDate: property.purchaseDate,
    })),
    units: DEMO_DATA.units.map((unit) => ({
      id: unit.id,
      propertyId: unit.propertyId,
      label: unit.label,
      areaSquareMeters: unit.areaSquareMeters,
      status: unit.status,
    })),
    leases: DEMO_DATA.leases.map((lease) => ({
      id: lease.id,
      unitId: lease.unitId,
      startsOn: lease.startDate,
      endsOn: lease.endDate ?? null,
      coldRentCents: lease.baseRentCents,
      ancillaryCents: lease.serviceChargeCents,
      parkingCents: lease.parkingRentCents,
      otherCents: lease.otherRentCents,
      status: lease.status,
    })),
    rentClaims: DEMO_DATA.rentCharges.map((charge) => ({
      id: charge.id,
      leaseId: charge.leaseId,
      claimMonth: `${charge.period}-01`,
      dueDate: charge.dueDate,
      amountCents: charge.targetAmountCents,
      paidCents: charge.paidAmountCents,
      status: charge.status,
    })),
    rentPayments: DEMO_DATA.payments
      .filter((payment) => payment.allocationStatus === "matched")
      .map((payment) => ({
        paidOn: payment.bookingDate,
        amountCents: payment.amountCents,
        bankTransactionId: payment.id,
      })),
    income: DEMO_DATA.payments
      .filter((payment) => payment.allocationStatus === "matched")
      .map((payment) => ({
        propertyId: null,
        entryDate: payment.bookingDate,
        amountCents: payment.amountCents,
        category: "rent",
        bankTransactionId: payment.id,
      })),
    expenses: DEMO_DATA.expenses.map((expense) => ({
      propertyId: expense.propertyId,
      entryDate: expense.date,
      amountCents: expense.amountCents,
      cashEffective: expense.cashEffective,
      isInterest: expense.category === "loan_interest",
      isPrincipal: expense.category === "principal",
      isCapitalizable: expense.category === "capitalized",
      isDeductible: expense.taxDeductible,
    })),
    loans: DEMO_DATA.loans.map((loan) => ({
      id: loan.id,
      propertyId: loan.propertyId,
      currentBalanceCents: loan.currentBalanceCents,
      monthlyPaymentCents: loan.monthlyPaymentCents,
      fixedRateUntil: loan.fixedInterestEndDate,
      status: "active",
    })),
    loansAvailable: true,
    unresolvedDocuments: DEMO_DATA.invoices.filter(
      (invoice) =>
        invoice.receiptStatus !== "complete" &&
        invoice.receiptStatus !== "reviewed",
    ).length,
    tasks: DEMO_DATA.tasks.map((task) => ({
      id: task.id,
      propertyId: task.propertyId ?? null,
      title: task.title,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate,
    })),
    renovations: DEMO_DATA.renovations.map((renovation) => ({
      id: renovation.id,
      propertyId: renovation.propertyId,
      name: renovation.description,
      estimatedCostCents: renovation.estimatedCostCents,
      plannedStartDate: renovation.plannedDate,
      priority: renovation.priority,
      status: renovation.status,
    })),
    taxRate:
      DEMO_DATA.taxAssumption.enabled
        ? DEMO_DATA.taxAssumption.marginalTaxRate
        : null,
    monthlyDepreciationCents: demoMonthlyDepreciationCents(),
    deriveHistoricalTargetFromLeases: true,
    additionalAssumptions: [
      "Demo-AfA: 2,0 % p.a. auf den fiktiven Gebäudeanteil, gleichmäßig auf zwölf Monate verteilt.",
      "Vergangene Sollmieten werden in der Demo aus den fiktiven, im Zeitraum aktiven Verträgen abgeleitet. Ist-Werte erscheinen nur für vorhandene Demo-Buchungen.",
    ],
  });
}
