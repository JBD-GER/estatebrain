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
  claimMonth: string;
  dueDate: string;
  amountCents: number;
  paidCents: number;
  status: string;
};

export type DashboardRentPaymentSource = {
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
  propertyId: string | null;
  entryDate: string;
  amountCents: number;
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

export type DashboardTaskSource = {
  id: string;
  propertyId: string | null;
  title: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: string;
  dueDate: string | null;
};

export type DashboardRenovationSource = {
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
  if (lease.status === "draft" || lease.status === "cancelled") return false;
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

function rentIncomeForMonth(source: DashboardSource, month: string) {
  const payments = source.rentPayments.filter(
    (payment) => monthKey(payment.paidOn) === month,
  );
  const representedBankTransactions = new Set(
    payments
      .map((payment) => payment.bankTransactionId)
      .filter((id): id is string => id !== null),
  );
  const additionalRentIncome = source.income.filter(
    (entry) =>
      monthKey(entry.entryDate) === month &&
      RENT_CATEGORIES.has(entry.category) &&
      (entry.bankTransactionId === null
        ? payments.length === 0
        : !representedBankTransactions.has(entry.bankTransactionId)),
  );
  return sumAmounts(payments) + sumAmounts(additionalRentIncome);
}

function targetRentForMonth(source: DashboardSource, month: string) {
  const claims = source.rentClaims.filter(
    (claim) => monthKey(claim.claimMonth) === month,
  );
  if (claims.length > 0) return sumAmounts(claims);

  if (
    source.deriveHistoricalTargetFromLeases ||
    month === monthKey(source.asOfDate)
  ) {
    return sumCents(
      source.leases
        .filter((lease) => isLeaseInMonth(lease, month))
        .map(leaseTotal),
    );
  }

  return null;
}

function monthFinancials(source: DashboardSource, month: string) {
  const actualRentCents = rentIncomeForMonth(source, month);
  const incomeEntries = source.income.filter(
    (entry) => monthKey(entry.entryDate) === month,
  );
  const otherIncomeCents = sumAmounts(
    incomeEntries.filter((entry) => !RENT_CATEGORIES.has(entry.category)),
  );
  const incomeCents = actualRentCents + otherIncomeCents;
  const expenses = source.expenses.filter(
    (expense) =>
      monthKey(expense.entryDate) === month && expense.cashEffective,
  );
  const operatingExpenses = expenses.filter(
    (expense) =>
      !expense.isInterest &&
      !expense.isPrincipal &&
      !expense.isCapitalizable,
  );
  const interestCents = sumAmounts(
    expenses.filter((expense) => expense.isInterest),
  );
  const principalCents = sumAmounts(
    expenses.filter((expense) => expense.isPrincipal),
  );
  const totalExpensesCents = sumAmounts(expenses);
  const operatingExpensesCents = sumAmounts(operatingExpenses);
  const deductibleOperatingExpensesCents = sumAmounts(
    operatingExpenses.filter((expense) => expense.isDeductible),
  );
  const operatingCashflowCents = calculateOperatingCashflowCents({
    operatingIncomeCents: [incomeCents],
    operatingExpensesCents: [operatingExpensesCents],
  });
  const financingCashflowCents = calculateCashflowAfterFinancingCents({
    operatingCashflowCents,
    interestPaidCents: interestCents,
    principalPaidCents: principalCents,
  });
  const taxCashflow = calculateTaxCashflow({
    rentalIncomeCents: actualRentCents,
    otherOperatingIncomeCents: otherIncomeCents,
    cashOperatingExpensesCents: operatingExpensesCents,
    deductibleOperatingExpensesCents,
    interestPaidCents: interestCents,
    principalPaidCents: principalCents,
    depreciationCents: source.monthlyDepreciationCents,
    taxRate: source.taxRate,
    lossOffsetAllowed: true,
  });

  return {
    targetRentCents: targetRentForMonth(source, month),
    actualRentCents,
    incomeCents,
    totalExpensesCents,
    operatingExpensesCents,
    operatingCashflowCents,
    financingCashflowCents,
    afterTaxCents: taxCashflow.cashflowAfterEstimatedTaxCents,
    estimatedTaxCents: taxCashflow.estimatedTax.estimatedTaxCents,
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
        isLeaseInMonth(lease, monthKey(source.asOfDate)),
    );
    const monthlyTargetColdRentCents = sumCents(
      activeLeases.map((lease) => lease.coldRentCents),
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
      monthlyTargetColdRentCents,
      grossYield:
        property.purchasePriceCents === null
          ? null
          : calculateGrossRentalYield({
              annualColdRentCents: monthlyTargetColdRentCents * 12,
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
  source: DashboardSource,
): DashboardSnapshot {
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
      operatingExpensesCents: financials.operatingExpensesCents,
      operatingCashflowCents: financials.operatingCashflowCents,
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
    sumCents(currentLeases.map((lease) => lease.coldRentCents)) * 12;
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
      monthlyTargetRentCents: current.targetRentCents ?? 0,
      monthlyActualRentCents: current.actualRentCents,
      openRentCents: sumCents(openClaims.map((claim) => claim.openCents)),
      monthlyExpensesCents: current.totalExpensesCents,
      operatingCashflowCents: current.operatingCashflowCents,
      financingCashflowCents: current.financingCashflowCents,
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
      "Sollmiete: vertragliche Monatsmiete einschließlich Nebenkosten, Stellplatz und weiterer Mietbestandteile; historische Live-Werte stammen aus Mietforderungen.",
      "Ist-Miete: bestätigte Mietzahlungen plus eindeutig abgrenzbare, als Miete kategorisierte Einnahmen. Bei gemischten Quellen werden stabile Banktransaktions-IDs verwendet; unverknüpfte Einträge werden konservativ nicht zusätzlich gezählt statt über Betrag oder Datum zu raten.",
      "Operativer Cashflow: gebuchte Einnahmen abzüglich liquiditätswirksamer Betriebsausgaben; Zins, Tilgung und aktivierbare Investitionen sind getrennt.",
      "Cashflow nach Finanzierung: operativer Cashflow abzüglich Zins und Tilgung. Geplante Sanierungen sind darin noch nicht enthalten.",
      source.taxRate === null
        ? "Nachsteuer-Cashflow wird erst mit aktivierter persönlicher Steuerannahme berechnet."
        : "Steuerwirkung: modellierte Hochrechnung mit der hinterlegten Grenzsteuerannahme und monatlicher AfA; unverbindlich und keine Steuerberatung.",
      ...(source.additionalAssumptions ?? []),
    ],
  };
}
