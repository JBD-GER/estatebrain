import type { DashboardExpenseSource, DashboardRenovationSource } from "./snapshot";

/** Project totals include assigned receipts; they must never be added twice. */
export function expensesWithRenovationCompletion(expenses: DashboardExpenseSource[], renovations: DashboardRenovationSource[]): DashboardExpenseSource[] {
  const deferred = new Set(renovations.filter(r=>r.status!=="cancelled" && (r.status!=="done" || r.actualEndDate)).map(r=>r.id));
  return [
    ...expenses.filter(e=>!e.renovationProjectId || !deferred.has(e.renovationProjectId)),
    ...renovations.filter(r=>r.status==="done" && r.actualEndDate).map(r=>({
      propertyId:r.propertyId,entryDate:r.actualEndDate!,amountCents:r.actualCostCents ?? 0,
      bankTransactionId:null,cashEffective:true,isInterest:false,isPrincipal:false,
      isCapitalizable:true,isDeductible:false,
    })),
  ];
}
