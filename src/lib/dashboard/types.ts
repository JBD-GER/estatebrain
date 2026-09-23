export type DashboardMode = "live" | "demo";
export type DashboardSourceState = "ready" | "empty" | "partial";

export type DashboardMonthPoint = {
  month: string;
  label: string;
  targetRentCents: number | null;
  actualRentCents: number;
  incomeCents: number;
  ancillaryIncomeCents: number;
  operatingExpensesCents: number;
  operatingCashflowCents: number;
  debtServiceCents: number;
  debtServiceMode: "actual" | "forecast" | "mixed" | "none";
  financingCashflowCents: number;
  afterTaxCents: number | null;
};

export type DashboardPropertyPoint = {
  id: string;
  name: string;
  marketValueCents: number | null;
  equityCents: number | null;
  monthlyContractColdRentCents: number;
  monthlyMarketColdRentCents: number;
  monthlyTargetColdRentCents: number;
  monthlyRentPaymentsCents: number;
  monthlyIncomeCents: number;
  monthlyAncillaryIncomeCents: number;
  monthlyCashExpensesCents: number;
  monthlyDebtServiceCents: number;
  debtServiceMode: "actual" | "forecast" | "mixed" | "none";
  monthlyCashflowAfterFinancingCents: number;
  currentYearExpensesCents: number;
  grossYield: number | null;
  vacancyRate: number | null;
  plannedRenovationCents: number;
};

export type DashboardAction = {
  id: string;
  title: string;
  detail: string;
  href: string;
  priority: "low" | "medium" | "high" | "urgent";
  dueDate: string | null;
  kind: "claim" | "task" | "lease" | "document" | "loan" | "renovation";
};

export type DashboardMetrics = {
  propertyCount: number;
  unitCount: number;
  occupiedUnitCount: number;
  vacantUnitCount: number;
  vacancyRate: number | null;
  monthlyContractColdRentCents: number;
  monthlyMarketColdRentCents: number;
  monthlyTargetRentCents: number;
  monthlyActualRentCents: number;
  monthlyAncillaryIncomeCents: number;
  openRentCents: number;
  monthlyCashExpensesCents: number;
  monthlyDebtServiceCents: number;
  debtServiceMode: "actual" | "forecast" | "mixed" | "none";
  currentYearExpensesCents: number;
  monthlyExpensesCents: number;
  operatingCashflowCents: number;
  financingCashflowCents: number;
  estimatedAfterTaxCents: number | null;
  loansAvailable: boolean;
  loanBalanceCents: number | null;
  portfolioValueCents: number | null;
  valuedPropertyCount: number;
  equityCents: number | null;
  annualEstimatedTaxEffectCents: number | null;
  unresolvedDocuments: number;
  openTasks: number;
  expiringLeases: number;
  nextFinancingExpiry: string | null;
  plannedRenovationCents: number;
  grossRentalYield: number | null;
  loanToValue: number | null;
};

export type DashboardOpenClaim = {
  id: string;
  label: string;
  dueDate: string;
  amountCents: number;
  paidCents: number;
  openCents: number;
  coverageRate: number | null;
};

export type DashboardSnapshot = {
  mode: DashboardMode;
  organizationName: string;
  asOfDate: string;
  periodLabel: string;
  sourceState: DashboardSourceState;
  issues: string[];
  metrics: DashboardMetrics;
  months: DashboardMonthPoint[];
  properties: DashboardPropertyPoint[];
  openClaims: DashboardOpenClaim[];
  actions: DashboardAction[];
  assumptions: string[];
};
