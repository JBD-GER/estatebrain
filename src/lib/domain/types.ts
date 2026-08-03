/**
 * All monetary values in the domain layer are integer euro cents.
 *
 * The alias is intentionally not branded: records coming from Supabase can be
 * passed to pure domain functions without casts. Runtime guards in `money.ts`
 * reject fractional, non-finite and unsafe integer values.
 */
export type MoneyCents = number;

/** Decimal ratio: 0.0325 means 3.25 %. */
export type DecimalRate = number;

/** Calendar date without a time zone, formatted as YYYY-MM-DD. */
export type IsoDate = string;

export type EntityId = string;

export interface Organization {
  id: EntityId;
  name: string;
  isDemo: boolean;
  currency: "EUR";
  taxYearStartMonth: number;
}

export interface Property {
  id: EntityId;
  organizationId: EntityId;
  name: string;
  address: string;
  propertyType:
    | "apartment_building"
    | "condominium"
    | "single_family"
    | "semi_detached"
    | "terraced_house"
    | "commercial"
    | "mixed_use";
  purchaseDate: IsoDate;
  purchasePriceCents: MoneyCents;
  acquisitionCostsCents: MoneyCents;
  buildingShareCents: MoneyCents;
  landShareCents: MoneyCents;
  livingAreaSquareMeters: number;
  currentMarketValueCents: MoneyCents;
  marketValueAsOf: IsoDate;
  isDemo: boolean;
}

export interface Unit {
  id: EntityId;
  propertyId: EntityId;
  label: string;
  floor: string;
  areaSquareMeters: number;
  status: "occupied" | "vacant" | "renovation";
  isDemo: boolean;
}

export interface Tenant {
  id: EntityId;
  displayName: string;
  email: string;
  iban?: string;
  isDemo: boolean;
}

export interface Lease {
  id: EntityId;
  unitId: EntityId;
  tenantId: EntityId;
  startDate: IsoDate;
  endDate?: IsoDate;
  dueDay: number;
  baseRentCents: MoneyCents;
  serviceChargeCents: MoneyCents;
  parkingRentCents: MoneyCents;
  otherRentCents: MoneyCents;
  depositCents: MoneyCents;
  paymentReference: string;
  status: "active" | "ended" | "notice";
  isDemo: boolean;
}

export interface RentPayment {
  id: EntityId;
  organizationId: EntityId;
  bookingDate: IsoDate;
  amountCents: MoneyCents;
  senderName: string;
  senderIban?: string;
  reference: string;
  leaseId?: EntityId;
  allocationStatus: "matched" | "suggested" | "unmatched" | "excluded";
  isDemo: boolean;
}

export interface RentCharge {
  id: EntityId;
  leaseId: EntityId;
  period: string;
  dueDate: IsoDate;
  targetAmountCents: MoneyCents;
  paidAmountCents: MoneyCents;
  status: "paid" | "partial" | "open" | "overpaid";
  isDemo: boolean;
}

export type ExpenseCategory =
  | "loan_interest"
  | "principal"
  | "property_management"
  | "insurance"
  | "property_tax"
  | "repair"
  | "maintenance"
  | "modernization"
  | "utilities"
  | "legal_and_advice"
  | "bank_fees"
  | "other_deductible"
  | "capitalized"
  | "private";

export interface Expense {
  id: EntityId;
  propertyId: EntityId;
  unitId?: EntityId;
  date: IsoDate;
  amountCents: MoneyCents;
  category: ExpenseCategory;
  description: string;
  cashEffective: boolean;
  taxDeductible: boolean;
  apportionable: boolean;
  invoiceId?: EntityId;
  isDemo: boolean;
}

export interface Invoice {
  id: EntityId;
  propertyId: EntityId;
  unitId?: EntityId;
  invoiceDate: IsoDate;
  issuer: string;
  grossAmountCents: MoneyCents;
  receiptStatus:
    | "complete"
    | "missing"
    | "unreadable"
    | "unclear_assignment"
    | "review_required"
    | "reviewed";
  paymentStatus: "paid" | "open";
  isDemo: boolean;
}

export interface Loan {
  id: EntityId;
  propertyId: EntityId;
  lender: string;
  loanNumberMasked: string;
  originalPrincipalCents: MoneyCents;
  currentBalanceCents: MoneyCents;
  annualInterestRate: DecimalRate;
  initialAnnualRepaymentRate: DecimalRate;
  monthlyPaymentCents: MoneyCents;
  fixedInterestEndDate: IsoDate;
  maturityDate: IsoDate;
  isDemo: boolean;
}

export type RenovationCondition = "good" | "fair" | "poor" | "critical";
export type RenovationPriority = "low" | "medium" | "high" | "urgent";

export interface RenovationMeasure {
  id: EntityId;
  propertyId: EntityId;
  unitId?: EntityId;
  category:
    | "roof"
    | "facade"
    | "windows"
    | "heating"
    | "electrical"
    | "sanitary"
    | "pipes"
    | "floors"
    | "interior"
    | "energy"
    | "fire_protection"
    | "outdoor"
    | "other";
  description: string;
  condition: RenovationCondition;
  priority: RenovationPriority;
  estimatedCostCents: MoneyCents;
  actualCostCents?: MoneyCents;
  plannedDate: IsoDate;
  contingencyRate: DecimalRate;
  status: "planned" | "offered" | "in_progress" | "completed" | "cancelled";
  isDemo: boolean;
}

export interface PortfolioTask {
  id: EntityId;
  propertyId?: EntityId;
  unitId?: EntityId;
  title: string;
  dueDate: IsoDate;
  priority: "low" | "medium" | "high";
  status: "open" | "in_progress" | "done";
  isDemo: boolean;
}

export interface PortfolioMessage {
  id: EntityId;
  propertyId: EntityId;
  unitId: EntityId;
  tenantId: EntityId;
  direction: "inbound" | "outbound";
  subject: string;
  body: string;
  sentAt: string;
  read: boolean;
  isDemo: boolean;
}

export interface MarketValuation {
  id: EntityId;
  propertyId: EntityId;
  valueCents: MoneyCents;
  valuationDate: IsoDate;
  source: "manual_demo";
  uncertaintyNote: string;
  isDemo: boolean;
}

export interface TaxAssumption {
  organizationId: EntityId;
  taxYear: number;
  marginalTaxRate: DecimalRate | null;
  lossOffsetAllowed: boolean;
  enabled: boolean;
  note: string;
  isDemo: boolean;
}

export interface DemoDataset {
  mode: "demo";
  label: string;
  generatedForDate: IsoDate;
  organization: Organization;
  properties: Property[];
  units: Unit[];
  tenants: Tenant[];
  leases: Lease[];
  rentCharges: RentCharge[];
  payments: RentPayment[];
  expenses: Expense[];
  invoices: Invoice[];
  loans: Loan[];
  renovations: RenovationMeasure[];
  tasks: PortfolioTask[];
  messages: PortfolioMessage[];
  marketValuations: MarketValuation[];
  taxAssumption: TaxAssumption;
}
