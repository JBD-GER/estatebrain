import { describe, expect, it } from "vitest";
import { expensesWithRenovationCompletion } from "@/lib/dashboard/renovation-cashflow";
import type { DashboardExpenseSource, DashboardRenovationSource } from "@/lib/dashboard/snapshot";
const expense:DashboardExpenseSource={propertyId:"p1",renovationProjectId:"r1",entryDate:"2026-08-10",amountCents:20000,bankTransactionId:null,cashEffective:true,isInterest:false,isPrincipal:false,isCapitalizable:true,isDeductible:false};
const project:DashboardRenovationSource={id:"r1",propertyId:"p1",name:"Bad",estimatedCostCents:35000,actualCostCents:30000,actualEndDate:"2026-09-23",plannedStartDate:null,priority:"medium",status:"done"};
describe("renovation cashflow",()=>{
  it("includes the total once, in the completion month, with receipts included",()=>{
    const output=expensesWithRenovationCompletion([expense],[project]);expect(output).toHaveLength(1);expect(output[0].entryDate).toBe("2026-09-23");expect(output[0].amountCents).toBe(30000);
  });
  it("defers receipts while the work is underway",()=>{
    expect(expensesWithRenovationCompletion([expense],[{...project,status:"in_progress",actualEndDate:null}])).toEqual([]);
  });
  it("keeps unrelated and legacy completed-project expenses",()=>{
    expect(expensesWithRenovationCompletion([expense],[{...project,actualEndDate:null}])).toEqual([expense]);
    expect(expensesWithRenovationCompletion([expense],[{...project,id:"other",status:"open"}])).toEqual([expense]);
  });
  it("retains actual receipts when a project is cancelled or removed",()=>{
    expect(expensesWithRenovationCompletion([expense],[{...project,status:"cancelled"}])).toEqual([expense]);
    expect(expensesWithRenovationCompletion([expense],[])).toEqual([expense]);
  });
});
