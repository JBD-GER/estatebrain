import { allocateAncillaryPayments } from "@/lib/domain/rent-components";
import { expensesWithRenovationCompletion } from "./renovation-cashflow";
import {
  calculateCashflowAfterFinancingCents,
  calculateEstimatedEquityCents,
  calculateGrossRentalYield,
  calculateLoanToValue,
  calculateMonthlyLeaseRentCents,
  calculateOperatingCashflowCents,
  calculateRentReconciliation,
  calculateTaxCashflow,
  calculateVacancyRateByUnits,
  sumCents,
} from "@/lib/domain";
import type {
  DashboardAction,
  DashboardMode,
  DashboardOpenClaim,
  DashboardPropertyPoint,
  DashboardSnapshot,
  DashboardSourceState,
} from "@/lib/dashboard/types";

export type DashboardPropertySource = {
  id: string;
  name: string;
  purchasePriceCents: number | null;
  acquisitionCostsCents: number;
  buildingValueCents: number | null;
  currentMarketValueCents: number | null;
  purchaseDate: string | null;
};

export type DashboardUnitSource = {
  id: string;
  propertyId: string;
  label: string;
  areaSquareMeters: number | null;
  targetColdRentCents: number;
  status: string;
};

export type DashboardLeaseSource = {
  id: string;
  unitId: string;
  startsOn: string;
  endsOn: string | null;
  coldRentCents: number;
  ancillaryCents: number;
  parkingCents: number;
  otherCents: number;
  status: string;
};

export type DashboardRentClaimSource = {
  id: string;
  leaseId: string;
  ancillaryCents?: number;
  claimMonth: string;
  dueDate: string;
  amountCents: number;
  paidCents: number;
  status: string;
};

export type DashboardRentPaymentSource = {
  rentClaimId: string | null;
  paidOn: string;
  amountCents: number;
  bankTransactionId: string | null;
};

export type DashboardIncomeSource = {
  propertyId: string | null;
  entryDate: string;
  amountCents: number;
  category: string;
  bankTransactionId: string | null;
};

export type DashboardExpenseSource = {
  isRecoverable?: boolean;
  renovationProjectId?: string | null;
  propertyId: string | null;
  entryDate: string;
  amountCents: number;
  bankTransactionId: string | null;
  cashEffective: boolean;
  isInterest: boolean;
  isPrincipal: boolean;
  isCapitalizable: boolean;
  isDeductible: boolean;
};

export type DashboardLoanSource = {
  id: string;
  propertyId: string;
  currentBalanceCents: number;
  monthlyPaymentCents: number;
  fixedRateUntil: string | null;
  status: string;
};

export type DashboardLoanPaymentSource = {
  loanId: string;
  dueDate: string;
  paidOn: string | null;
  paymentCents: number;
  interestCents: number;
  principalCents: number;
  feesCents: number;
  status: string;
  bankTransactionId: string | null;
};

export type DashboardTaskSource = {
  id: string;
  propertyId: string | null;
  title: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: string;
  dueDate: string | null;
};

export type DashboardRenovationSource = {
  actualCostCents?: number;
  actualEndDate?: string | null;
  id: string;
  propertyId: string;
  name: string;
  estimatedCostCents: number;
  plannedStartDate: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  status: string;
};

export type DashboardSource = {
  mode: DashboardMode;
  organizationName: string;
  asOfDate: string;
  sourceState: DashboardSourceState;
  issues?: string[];
  properties: DashboardPropertySource[];
  units: DashboardUnitSource[];
  leases: DashboardLeaseSource[];
  rentClaims: DashboardRentClaimSource[];
  rentPayments: DashboardRentPaymentSource[];
  income: DashboardIncomeSource[];
  expenses: DashboardExpenseSource[];
  loans: DashboardLoanSource[];
  loanPayments: DashboardLoanPaymentSource[];
  loansAvailable?: boolean;
  unresolvedDocuments: number;
  tasks: DashboardTaskSource[];
  renovations: DashboardRenovationSource[];
  taxRate: number | null;
  monthlyDepreciationCents: number;
  deriveHistoricalTargetFromLeases?: boolean;
  additionalAssumptions?: string[];
};

const RENT_CATEGORIES = new Set([
  "rent",
  "base_rent",
  "cold_rent",
  "service_charge",
  "ancillary",
  "parking",
  "other_rent",
]);

const PRIORITY_WEIGHT: Record<DashboardAction["priority"], number> = {
  urgent: 4,
  high: 3,
  medium: 2,
  low: 1,
};

function monthKey(date: string) {
  return date.slice(0, 7);
}

function monthStart(month: string) {
  return `${month}-01`;
}

function monthEnd(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
}

function previousMonths(anchorDate: string, count: number) {
  const [year, month] = anchorDate.slice(0, 7).split("-").map(Number);
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(year, month - count + index, 1));
    return date.toISOString().slice(0, 7);
  });
}

function formatMonth(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("de-DE", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, monthNumber - 1, 1)));
}

function formatPeriodLabel(anchorDate: string) {
  return new Intl.DateTimeFormat("de-DE", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${anchorDate}T00:00:00.000Z`));
}

function isLeaseInMonth(lease: DashboardLeaseSource, month: string) {
  if (["draft", "cancelled"].includes(lease.status)) return false;
  return (
    lease.startsOn <= monthEnd(month) &&
    (lease.endsOn === null || lease.endsOn >= monthStart(month))
  );
}

function leaseTotal(lease: DashboardLeaseSource) {
  return calculateMonthlyLeaseRentCents({
    baseRentCents: lease.coldRentCents,
    serviceChargeCents: lease.ancillaryCents,
    parkingRentCents: lease.parkingCents,
    otherRentCents: lease.otherCents,
  });
}

function sumAmounts(items: readonly { amountCents: number }[]) {
  return sumCents(items.map((item) => item.amountCents));
}

type DashboardRelationMaps = {
  unitProperty: Map<string, string>;
  leaseProperty: Map<string, string | null>;
  claimProperty: Map<string, string | null>;
};

const RELATION_MAP_CACHE = new WeakMap<
  DashboardSource,
  DashboardRelationMaps
>();

function relationMaps(source: DashboardSource): DashboardRelationMaps {
  const cached = RELATION_MAP_CACHE.get(source);
  if (cached) return cached;

  const unitProperty = new Map(
    source.units.map((unit) => [unit.id, unit.propertyId]),
  );
  const leaseProperty = new Map(
    source.leases.map((lease) => [
      lease.id,
      unitProperty.get(lease.unitId) ?? null,
    ]),
  );
  const claimProperty = new Map(
    source.rentClaims.map((claim) => [
      claim.id,
      leaseProperty.get(claim.leaseId) ?? null,
    ]),
  );

  const maps = { unitProperty, leaseProperty, claimProperty };
  RELATION_MAP_CACHE.set(source, maps);
  return maps;
}

function rentPaymentPropertyId(
  source: DashboardSource,
  payment: DashboardRentPaymentSource,
) {
  if (payment.rentClaimId === null) return null;
  return relationMaps(source).claimProperty.get(payment.rentClaimId) ?? null;
}

const ANCILLARY_CACHE = new WeakMap<DashboardSource, Map<DashboardRentPaymentSource, number>>();

function rentIncomeForMonth(
  source: DashboardSource,
  month: string,
  propertyId?: string,
) {
  const monthPayments = source.rentPayments.filter(
    (payment) => monthKey(payment.paidOn) === month,
  );
  const payments = monthPayments.filter(
    (payment) =>
      propertyId === undefined ||
      rentPaymentPropertyId(source, payment) === propertyId,
  );
  const representedBankTransactions = new Set(
    monthPayments
      .map((payment) => payment.bankTransactionId)
      .filter((id): id is string => id !== null),
  );
  const additionalRentIncome = source.income.filter(
    (entry) =>
      monthKey(entry.entryDate) === month &&
      RENT_CATEGORIES.has(entry.category) &&
      (propertyId === undefined || entry.propertyId === propertyId) &&
      (entry.bankTransactionId === null ||
        !representedBankTransactions.has(entry.bankTransactionId)),
  );
  let allocations = ANCILLARY_CACHE.get(source);
  if (!allocations) {
    allocations = allocateAncillaryPayments(source.rentClaims, source.rentPayments);
    ANCILLARY_CACHE.set(source, allocations);
  }
  const ancillaryCents = payments.reduce((sum, payment) => sum + (allocations.get(payment) ?? 0), 0)
    + sumAmounts(additionalRentIncome.filter(entry => ["service_charge", "ancillary"].includes(entry.category)));
  return { grossCents: sumAmounts(payments) + sumAmounts(additionalRentIncome), ancillaryCents };
}

function targetRentForMonth(
  source: DashboardSource,
  month: string,
  propertyId?: string,
) {
  const { claimProperty, leaseProperty } = relationMaps(source);
  const claims = source.rentClaims.filter(
    (claim) =>
      monthKey(claim.claimMonth) === month &&
      (propertyId === undefined ||
        claimProperty.get(claim.id) === propertyId),
  );
  if (claims.length > 0) return sumAmounts(claims);

  if (
    source.deriveHistoricalTargetFromLeases ||
    month === monthKey(source.asOfDate)
  ) {
    return sumCents(
      source.leases
        .filter(
          (lease) =>
            isLeaseInMonth(lease, month) &&
            (propertyId === undefined ||
              leaseProperty.get(lease.id) === propertyId),
        )
        .map(leaseTotal),
    );
  }

  return null;
}

type DebtServiceMode = "actual" | "forecast" | "mixed" | "none";

function debtServiceForMonth(
  source: DashboardSource,
  month: string,
  propertyId?: string,
) {
  const applicableLoans = source.loans.filter(
    (loan) =>
      ["active", "refinancing_due"].includes(loan.status) &&
      (propertyId === undefined || loan.propertyId === propertyId),
  );
  const loanIds = new Set(applicableLoans.map((loan) => loan.id));
  const confirmedPayments = source.loanPayments.filter(
    (payment) =>
      loanIds.has(payment.loanId) &&
      ["paid", "overpaid"].includes(payment.status) &&
      monthKey(payment.paidOn ?? payment.dueDate) === month,
  );
  const paymentsByLoan = new Map<string, DashboardLoanPaymentSource[]>();
  for (const payment of confirmedPayments) {
    const list = paymentsByLoan.get(payment.loanId) ?? [];
    list.push(payment);
    paymentsByLoan.set(payment.loanId, list);
  }

  const isCurrentMonth = month === monthKey(source.asOfDate);
  let totalCents = 0;
  let interestCents = 0;
  let principalCents = 0;
  let otherFinancingCostsCents = 0;
  let hasActual = false;
  let hasForecast = false;

  for (const loan of applicableLoans) {
    const payments = paymentsByLoan.get(loan.id) ?? [];
    if (payments.length > 0) {
      hasActual = true;
      for (const payment of payments) {
        const paymentTotal = payment.paymentCents;
        const paymentInterest = Math.min(
          payment.interestCents,
          paymentTotal,
        );
        const paymentPrincipal = Math.min(
          payment.principalCents,
          paymentTotal - paymentInterest,
        );
        totalCents += paymentTotal;
        interestCents += paymentInterest;
        principalCents += paymentPrincipal;
        otherFinancingCostsCents +=
          paymentTotal - paymentInterest - paymentPrincipal;
      }
      continue;
    }

    if (isCurrentMonth && loan.monthlyPaymentCents > 0) {
      hasForecast = true;
      totalCents += loan.monthlyPaymentCents;
      // Without a confirmed split, the forecast rate affects liquidity only.
      otherFinancingCostsCents += loan.monthlyPaymentCents;
    }
  }

  const financingExpenses = source.expenses.filter(
    (expense) =>
      expense.cashEffective &&
      monthKey(expense.entryDate) === month &&
      (expense.isInterest || expense.isPrincipal) &&
      (propertyId === undefined || expense.propertyId === propertyId),
  );
  const financedPropertyIds = new Set(
    applicableLoans.map((loan) => loan.propertyId),
  );
  const legacyFinancingExpenses = financingExpenses.filter(
    (expense) =>
      expense.propertyId === null ||
      !financedPropertyIds.has(expense.propertyId),
  );
  if (legacyFinancingExpenses.length > 0) {
    hasActual = true;
    const legacyInterest = sumAmounts(
      legacyFinancingExpenses.filter((expense) => expense.isInterest),
    );
    const legacyPrincipal = sumAmounts(
      legacyFinancingExpenses.filter((expense) => expense.isPrincipal),
    );
    interestCents += legacyInterest;
    principalCents += legacyPrincipal;
    totalCents += legacyInterest + legacyPrincipal;
  }

  const mode: DebtServiceMode =
    hasActual && hasForecast
      ? "mixed"
      : hasActual
        ? "actual"
        : hasForecast
          ? "forecast"
          : "none";

  return {
    totalCents,
    interestCents,
    principalCents,
    otherFinancingCostsCents,
    mode,
  };
}

function monthFinancials(
  source: DashboardSource,
  month: string,
  propertyId?: string,
) {
  const rentIncome = rentIncomeForMonth(source, month, propertyId);
  const actualRentCents = rentIncome.grossCents;
  const incomeEntries = source.income.filter(
    (entry) =>
      monthKey(entry.entryDate) === month &&
      (propertyId === undefined || entry.propertyId === propertyId),
  );
  const otherIncomeCents = sumAmounts(
    incomeEntries.filter((entry) => !RENT_CATEGORIES.has(entry.category)),
  );
  const incomeCents = actualRentCents - rentIncome.ancillaryCents + otherIncomeCents;
  const expenses = source.expenses.filter(
    (expense) =>
      monthKey(expense.entryDate) === month && expense.cashEffective,
  ).filter(
    (expense) =>
      propertyId === undefined || expense.propertyId === propertyId,
  );
  const operatingExpenses = expenses.filter(
    (expense) => !expense.isInterest && !expense.isPrincipal,
  );
  const grossOperatingExpensesCents = sumAmounts(operatingExpenses);
  const operatingExpensesCents = sumAmounts(operatingExpenses.filter(expense => !expense.isRecoverable));
  const debtService = debtServiceForMonth(source, month, propertyId);
  const totalExpensesCents =
    operatingExpensesCents + debtService.totalCents;
  const deductibleOperatingExpensesCents = sumAmounts(
    operatingExpenses.filter((expense) => expense.isDeductible),
  );
  const operatingCashflowCents = calculateOperatingCashflowCents({
    operatingIncomeCents: [incomeCents],
    operatingExpensesCents: [operatingExpensesCents],
  });
  const financingCashflowCents = calculateCashflowAfterFinancingCents({
    operatingCashflowCents,
    interestPaidCents: debtService.interestCents,
    principalPaidCents: debtService.principalCents,
    otherFinancingCostsCents: debtService.otherFinancingCostsCents,
  });
  const taxCashflow = calculateTaxCashflow({
    rentalIncomeCents: actualRentCents,
    otherOperatingIncomeCents: otherIncomeCents,
    cashOperatingExpensesCents: grossOperatingExpensesCents,
    deductibleOperatingExpensesCents,
    interestPaidCents: debtService.interestCents,
    principalPaidCents: debtService.principalCents,
    otherFinancingCostsCents: debtService.otherFinancingCostsCents,
    depreciationCents:
      propertyId === undefined ? source.monthlyDepreciationCents : 0,
    taxRate: source.taxRate,
    lossOffsetAllowed: true,
  });

  return {
    targetRentCents: targetRentForMonth(source, month, propertyId),
    actualRentCents,
    ancillaryIncomeCents: rentIncome.ancillaryCents,
    incomeCents,
    totalExpensesCents,
    operatingExpensesCents,
    operatingCashflowCents,
    debtServiceCents: debtService.totalCents,
    debtServiceMode: debtService.mode,
    financingCashflowCents,
    afterTaxCents: taxCashflow.estimatedTax.estimatedTaxCents == null ? null : financingCashflowCents - taxCashflow.estimatedTax.estimatedTaxCents,
    estimatedTaxCents: taxCashflow.estimatedTax.estimatedTaxCents,
  };
}

function scopeToDashboardProperties(source: DashboardSource): DashboardSource {
  const propertyIds = new Set(
    source.properties.map((property) => property.id),
  );
  const units = source.units.filter((unit) =>
    propertyIds.has(unit.propertyId),
  );
  const unitIds = new Set(units.map((unit) => unit.id));
  const leases = source.leases.filter((lease) =>
    unitIds.has(lease.unitId),
  );
  const leaseIds = new Set(leases.map((lease) => lease.id));
  const rentClaims = source.rentClaims.filter((claim) =>
    leaseIds.has(claim.leaseId),
  );
  const claimIds = new Set(rentClaims.map((claim) => claim.id));
  const loans = source.loans.filter((loan) =>
    propertyIds.has(loan.propertyId) &&
    ["active", "refinancing_due"].includes(loan.status),
  );
  const loanIds = new Set(loans.map((loan) => loan.id));

  return {
    ...source,
    units,
    leases,
    rentClaims,
    rentPayments: source.rentPayments.filter(
      (payment) =>
        payment.rentClaimId !== null &&
        claimIds.has(payment.rentClaimId),
    ),
    income: source.income.filter(
      (entry) =>
        entry.propertyId !== null && propertyIds.has(entry.propertyId),
    ),
    expenses: source.expenses.filter(
      (expense) =>
        expense.propertyId !== null &&
        propertyIds.has(expense.propertyId),
    ),
    loans,
    loanPayments: source.loanPayments.filter((payment) =>
      loanIds.has(payment.loanId),
    ),
    tasks: source.tasks.filter(
      (task) =>
        task.propertyId === null || propertyIds.has(task.propertyId),
    ),
    renovations: source.renovations.filter((renovation) =>
      propertyIds.has(renovation.propertyId),
    ),
  };
}

function buildOpenClaims(source: DashboardSource): DashboardOpenClaim[] {
  const leaseMap = new Map(source.leases.map((lease) => [lease.id, lease]));
  const unitMap = new Map(source.units.map((unit) => [unit.id, unit]));
  const propertyMap = new Map(
    source.properties.map((property) => [property.id, property]),
  );

  return source.rentClaims
    .map((claim) => {
      const reconciliation = calculateRentReconciliation(
        claim.amountCents,
        Math.min(claim.paidCents, claim.amountCents),
      );
      if (reconciliation.arrearsCents === 0) return null;
      const lease = leaseMap.get(claim.leaseId);
      const unit = lease ? unitMap.get(lease.unitId) : null;
      const property = unit ? propertyMap.get(unit.propertyId) : null;

      return {
        id: claim.id,
        label: [property?.name, unit?.label].filter(Boolean).join(" · ") ||
          "Mietforderung",
        dueDate: claim.dueDate,
        amountCents: claim.amountCents,
        paidCents: claim.paidCents,
        openCents: reconciliation.arrearsCents,
        coverageRate: reconciliation.coverageRatio,
      };
    })
    .filter((claim): claim is DashboardOpenClaim => claim !== null)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

function buildPropertyPoints(
  source: DashboardSource,
): DashboardPropertyPoint[] {
  const loansAvailable = source.loansAvailable !== false;
  const currentMonth = monthKey(source.asOfDate);
  const currentYear = source.asOfDate.slice(0, 4);
  const unitsByProperty = new Map<string, DashboardUnitSource[]>();
  for (const unit of source.units) {
    const list = unitsByProperty.get(unit.propertyId) ?? [];
    list.push(unit);
    unitsByProperty.set(unit.propertyId, list);
  }
  const unitProperty = new Map(
    source.units.map((unit) => [unit.id, unit.propertyId]),
  );

  return source.properties.map((property) => {
    const units = unitsByProperty.get(property.id) ?? [];
    const vacantUnits = units.filter((unit) =>
      ["vacant", "renovation"].includes(unit.status),
    ).length;
    const activeLeases = source.leases.filter(
      (lease) =>
        unitProperty.get(lease.unitId) === property.id &&
        isLeaseInMonth(lease, currentMonth),
    );
    const monthlyContractColdRentCents = sumCents(
      activeLeases.map((lease) => lease.coldRentCents + lease.parkingCents),
    );
    const monthlyMarketColdRentCents = sumCents(
      units.map((unit) => unit.targetColdRentCents),
    );
    const financials = monthFinancials(source, currentMonth, property.id);
    const currentYearExpensesCents = sumAmounts(
      source.expenses.filter(
        (expense) =>
          expense.propertyId === property.id &&
          expense.cashEffective &&
          expense.entryDate.slice(0, 4) === currentYear &&
          expense.entryDate <= source.asOfDate &&
          !expense.isInterest &&
          !expense.isPrincipal,
      ),
    );
    const propertyLoans = source.loans.filter(
      (loan) => loan.propertyId === property.id,
    );
    const marketValueCents = property.currentMarketValueCents;
    const equityCents =
      marketValueCents === null || !loansAvailable
        ? null
        : calculateEstimatedEquityCents({
            marketValueCents,
            outstandingLoanBalancesCents: propertyLoans.map(
              (loan) => loan.currentBalanceCents,
            ),
          });

    return {
      id: property.id,
      name: property.name,
      marketValueCents,
      equityCents,
      monthlyContractColdRentCents,
      monthlyMarketColdRentCents,
      // Compatibility alias for existing consumers; "target" means market rent.
      monthlyTargetColdRentCents: monthlyMarketColdRentCents,
      monthlyRentPaymentsCents: financials.actualRentCents,
      monthlyIncomeCents: financials.incomeCents,
      monthlyAncillaryIncomeCents: financials.ancillaryIncomeCents,
      monthlyCashExpensesCents: financials.operatingExpensesCents,
      monthlyDebtServiceCents: financials.debtServiceCents,
      debtServiceMode: financials.debtServiceMode,
      monthlyCashflowAfterFinancingCents:
        financials.financingCashflowCents,
      currentYearExpensesCents,
      grossYield:
        property.purchasePriceCents === null
          ? null
          : calculateGrossRentalYield({
              annualColdRentCents: monthlyContractColdRentCents * 12,
              purchasePriceCents: property.purchasePriceCents,
            }),
      vacancyRate: calculateVacancyRateByUnits({
        vacantUnits,
        totalUnits: units.length,
      }),
      plannedRenovationCents: sumCents(
        source.renovations
          .filter(
            (renovation) =>
              renovation.propertyId === property.id &&
              !["done", "completed", "cancelled"].includes(
                renovation.status,
              ),
          )
          .map((renovation) => renovation.estimatedCostCents),
      ),
    };
  });
}

function buildActions(
  source: DashboardSource,
  openClaims: DashboardOpenClaim[],
): DashboardAction[] {
  const asOf = source.asOfDate;
  const propertyMap = new Map(
    source.properties.map((property) => [property.id, property.name]),
  );
  const actions: DashboardAction[] = [];

  for (const claim of openClaims.slice(0, 3)) {
    actions.push({
      id: `claim-${claim.id}`,
      title: "Offene Mietforderung prüfen",
      detail: `${claim.label} · fällig ${claim.dueDate}`,
      href: "/app/bank",
      priority: claim.dueDate < asOf ? "high" : "medium",
      dueDate: claim.dueDate,
      kind: "claim",
    });
  }

  for (const task of source.tasks.filter(
    (item) => !["done", "cancelled"].includes(item.status),
  )) {
    actions.push({
      id: `task-${task.id}`,
      title: task.title,
      detail: task.propertyId
        ? propertyMap.get(task.propertyId) ?? "Portfolio-Aufgabe"
        : "Portfolio-Aufgabe",
      href: "/app/aufgaben",
      priority: task.priority,
      dueDate: task.dueDate,
      kind: "task",
    });
  }

  const horizon = new Date(`${asOf}T00:00:00.000Z`);
  horizon.setUTCFullYear(horizon.getUTCFullYear() + 1);
  const horizonDate = horizon.toISOString().slice(0, 10);
  for (const lease of source.leases.filter(
    (item) =>
      item.endsOn !== null &&
      item.endsOn >= asOf &&
      item.endsOn <= horizonDate,
  )) {
    actions.push({
      id: `lease-${lease.id}`,
      title: "Mietvertragsende vorbereiten",
      detail: `Vertragsende am ${lease.endsOn}`,
      href: "/app/mietverhaeltnisse",
      priority: "medium",
      dueDate: lease.endsOn,
      kind: "lease",
    });
  }

  if (source.unresolvedDocuments > 0) {
    actions.push({
      id: "unresolved-documents",
      title: `${source.unresolvedDocuments} Beleg${
        source.unresolvedDocuments === 1 ? "" : "e"
      } klären`,
      detail: "Zuordnung oder Prüfung ist noch offen.",
      href: "/app/daten-pruefen",
      priority: "medium",
      dueDate: null,
      kind: "document",
    });
  }

  for (const renovation of source.renovations.filter(
    (item) =>
      !["done", "completed", "cancelled"].includes(item.status) &&
      ["urgent", "high"].includes(item.priority),
  )) {
    actions.push({
      id: `renovation-${renovation.id}`,
      title: renovation.name,
      detail:
        propertyMap.get(renovation.propertyId) ?? "Sanierungsvorhaben",
      href: "/app/sanierungen",
      priority: renovation.priority,
      dueDate: renovation.plannedStartDate,
      kind: "renovation",
    });
  }

  return actions
    .sort((a, b) => {
      const priorityDifference =
        PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
      if (priorityDifference !== 0) return priorityDifference;
      if (a.dueDate === null) return 1;
      if (b.dueDate === null) return -1;
      return a.dueDate.localeCompare(b.dueDate);
    })
    .slice(0, 6);
}

export function buildDashboardSnapshot(
  inputSource: DashboardSource,
): DashboardSnapshot {
  const scoped = scopeToDashboardProperties(inputSource);
  const source = {...scoped, expenses: expensesWithRenovationCompletion(scoped.expenses,scoped.renovations)};
  const loansAvailable = source.loansAvailable !== false;
  const currentMonth = monthKey(source.asOfDate);
  const months = previousMonths(source.asOfDate, 12).map((month) => {
    const financials = monthFinancials(source, month);
    return {
      month,
      label: formatMonth(month),
      targetRentCents: financials.targetRentCents,
      actualRentCents: financials.actualRentCents,
      incomeCents: financials.incomeCents,
      ancillaryIncomeCents: financials.ancillaryIncomeCents,
      operatingExpensesCents: financials.operatingExpensesCents,
      operatingCashflowCents: financials.operatingCashflowCents,
      debtServiceCents: financials.debtServiceCents,
      debtServiceMode: financials.debtServiceMode,
      financingCashflowCents: financials.financingCashflowCents,
      afterTaxCents: financials.afterTaxCents,
    };
  });
  const current = monthFinancials(source, currentMonth);
  const vacantUnits = source.units.filter((unit) =>
    ["vacant", "renovation"].includes(unit.status),
  ).length;
  const occupiedUnitCount = source.units.filter((unit) =>
    ["occupied", "rented", "reserved"].includes(unit.status),
  ).length;
  const openClaims = buildOpenClaims(source);
  const portfolioValueItems = source.properties
    .map((property) => property.currentMarketValueCents)
    .filter((value): value is number => value !== null);
  const portfolioValueCents =
    portfolioValueItems.length > 0 ? sumCents(portfolioValueItems) : null;
  const loanBalanceCents = loansAvailable
    ? sumCents(source.loans.map((loan) => loan.currentBalanceCents))
    : null;
  const valuedPropertyIds = new Set(
    source.properties
      .filter((property) => property.currentMarketValueCents !== null)
      .map((property) => property.id),
  );
  const valuedPropertyLoanBalances = source.loans
    .filter((loan) => valuedPropertyIds.has(loan.propertyId))
    .map((loan) => loan.currentBalanceCents);
  const equityCents =
    portfolioValueCents === null || loanBalanceCents === null
      ? null
      : calculateEstimatedEquityCents({
          marketValueCents: portfolioValueCents,
          outstandingLoanBalancesCents: valuedPropertyLoanBalances,
        });
  const currentLeases = source.leases.filter((lease) =>
    isLeaseInMonth(lease, currentMonth),
  );
  const annualColdRentCents =
    sumCents(currentLeases.map((lease) => lease.coldRentCents + lease.parkingCents)) * 12;
  const purchasePriceItems = source.properties
    .map((property) => property.purchasePriceCents)
    .filter((value): value is number => value !== null);
  const purchasePriceCents =
    purchasePriceItems.length > 0 &&
    purchasePriceItems.length === source.properties.length
      ? sumCents(purchasePriceItems)
      : null;
  const nextFinancingExpiry = loansAvailable
    ? (source.loans
        .map((loan) => loan.fixedRateUntil)
        .filter(
          (date): date is string =>
            date !== null && date >= source.asOfDate,
        )
        .sort()[0] ?? null)
    : null;
  const leaseHorizon = new Date(`${source.asOfDate}T00:00:00.000Z`);
  leaseHorizon.setUTCFullYear(leaseHorizon.getUTCFullYear() + 1);
  const leaseHorizonDate = leaseHorizon.toISOString().slice(0, 10);
  const properties = buildPropertyPoints(source);
  const monthlyContractColdRentCents = sumCents(
    properties.map((property) => property.monthlyContractColdRentCents),
  );
  const monthlyMarketColdRentCents = sumCents(
    properties.map((property) => property.monthlyMarketColdRentCents),
  );
  const monthlyActualRentCents = sumCents(
    properties.map((property) => property.monthlyRentPaymentsCents),
  );
  const monthlyIncomeCents = sumCents(
    properties.map((property) => property.monthlyIncomeCents),
  );
  const monthlyCashExpensesCents = sumCents(
    properties.map((property) => property.monthlyCashExpensesCents),
  );
  const monthlyDebtServiceCents = sumCents(
    properties.map((property) => property.monthlyDebtServiceCents),
  );
  const propertyDebtServiceModes = new Set(
    properties
      .map((property) => property.debtServiceMode)
      .filter((mode) => mode !== "none"),
  );
  const debtServiceMode: DebtServiceMode =
    propertyDebtServiceModes.has("mixed") ||
    (propertyDebtServiceModes.has("actual") &&
      propertyDebtServiceModes.has("forecast"))
      ? "mixed"
      : propertyDebtServiceModes.has("actual")
        ? "actual"
        : propertyDebtServiceModes.has("forecast")
          ? "forecast"
          : "none";
  const operatingCashflowCents =
    monthlyIncomeCents - monthlyCashExpensesCents;
  const financingCashflowCents = properties.reduce(
    (total, property) =>
      total + property.monthlyCashflowAfterFinancingCents,
    0,
  );
  const currentYearExpensesCents = sumCents(
    properties.map((property) => property.currentYearExpensesCents),
  );

  return {
    mode: source.mode,
    organizationName: source.organizationName,
    asOfDate: source.asOfDate,
    periodLabel: formatPeriodLabel(source.asOfDate),
    sourceState: source.sourceState,
    issues: source.issues ?? [],
    metrics: {
      propertyCount: source.properties.length,
      unitCount: source.units.length,
      occupiedUnitCount,
      vacantUnitCount: vacantUnits,
      vacancyRate: calculateVacancyRateByUnits({
        vacantUnits,
        totalUnits: source.units.length,
      }),
      monthlyContractColdRentCents,
      monthlyMarketColdRentCents,
      monthlyTargetRentCents: current.targetRentCents ?? 0,
      monthlyActualRentCents,
      monthlyAncillaryIncomeCents: current.ancillaryIncomeCents,
      openRentCents: sumCents(openClaims.map((claim) => claim.openCents)),
      monthlyCashExpensesCents,
      monthlyDebtServiceCents,
      debtServiceMode,
      currentYearExpensesCents,
      monthlyExpensesCents:
        monthlyCashExpensesCents + monthlyDebtServiceCents,
      operatingCashflowCents,
      financingCashflowCents,
      estimatedAfterTaxCents: current.afterTaxCents,
      loansAvailable,
      loanBalanceCents,
      portfolioValueCents,
      valuedPropertyCount: portfolioValueItems.length,
      equityCents,
      annualEstimatedTaxEffectCents:
        current.estimatedTaxCents === null
          ? null
          : current.estimatedTaxCents * 12,
      unresolvedDocuments: source.unresolvedDocuments,
      openTasks: source.tasks.filter(
        (task) => !["done", "cancelled"].includes(task.status),
      ).length,
      expiringLeases: source.leases.filter(
        (lease) =>
          lease.endsOn !== null &&
          lease.endsOn >= source.asOfDate &&
          lease.endsOn <= leaseHorizonDate,
      ).length,
      nextFinancingExpiry,
      plannedRenovationCents: sumCents(
        source.renovations
          .filter(
            (renovation) =>
              !["done", "completed", "cancelled"].includes(
                renovation.status,
              ),
          )
          .map((renovation) => renovation.estimatedCostCents),
      ),
      grossRentalYield:
        purchasePriceCents === null
          ? null
          : calculateGrossRentalYield({
              annualColdRentCents,
              purchasePriceCents,
            }),
      loanToValue:
        loanBalanceCents === null ||
        portfolioValueCents === null ||
        portfolioValueItems.length !== source.properties.length
          ? null
          : calculateLoanToValue({
              outstandingLoanCents: loanBalanceCents,
              marketValueCents: portfolioValueCents,
            }),
    },
    months,
    properties,
    openClaims,
    actions: buildActions(source, openClaims),
    assumptions: [
      "Vertrags-/IST-Kaltmiete (mtl.): Summe aus Kaltmiete und zusätzlicher Stellplatzmiete der im Monat aktiven Mietverhältnisse.",
      "Markt-/SOLL-Kaltmiete (mtl.): Summe der je Einheit hinterlegten Ziel-Kaltmiete; sie ist von Mietforderungen einschließlich Nebenkosten klar getrennt.",
      "Zahlungseingänge: bestätigte Mietzahlungen plus als Miete kategorisierte Einnahmen. Nur identische, stabile Banktransaktions-IDs werden dedupliziert; Einträge ohne Banktransaktions-ID bleiben enthalten.",
      "Verfügbarer Cashflow: Einnahmen abzüglich des Nebenkostenanteils der Zahlungseingänge. Teilzahlungen werden anteilig nach der jeweiligen Monatsforderung aufgeteilt; Überzahlungen erzeugen keinen zweiten Nebenkostenabzug. Umlagefähige Belegausgaben bleiben als durchlaufende Nebenkosten außerhalb dieses Cashflows. Die Buchungen und Steuergrundlage bleiben unverändert.",
      "Liquiditätswirksame Ausgaben umfassen laufende Ausgaben und Investitionen. Zins und Tilgung werden separat als Schuldendienst ausgewiesen.",
      "Schuldendienst im laufenden Monat: bestätigte Darlehenszahlungen; fehlt eine Zahlung zu einem aktiven Darlehen, wird dessen Monatsrate ausdrücklich als Forecast verwendet. Als Zins oder Tilgung markierte Ausgaben werden dabei nicht nochmals abgezogen.",
      source.taxRate === null
        ? "Nachsteuer-Cashflow wird erst mit aktivierter persönlicher Steuerannahme berechnet."
        : "Steuerwirkung: modellierte Hochrechnung mit der hinterlegten Grenzsteuerannahme und monatlicher AfA; unverbindlich und keine Steuerberatung.",
      ...(source.additionalAssumptions ?? []),
    ],
  };
}
