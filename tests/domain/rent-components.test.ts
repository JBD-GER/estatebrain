import { describe, expect, it } from "vitest";
import { allocateAncillaryPayments } from "@/lib/domain/rent-components";

describe("ancillary cashflow allocation", () => {
  const claim = { id: "claim", amountCents: 130000, ancillaryCents: 20000, paidCents: 130000 };
  it("removes only ancillary charges and leaves cold plus parking income", () => {
    const payment = { rentClaimId: "claim", paidOn: "2026-07-01", amountCents: 130000 };
    expect(allocateAncillaryPayments([claim], [payment]).get(payment)).toBe(20000);
    expect(payment.amountCents).toBe(130000);
  });
  it("splits installments across months and caps the deduction at the claim's ancillary amount", () => {
    const payments = [
      { rentClaimId: "claim", paidOn: "2026-07-01", amountCents: 65000 },
      { rentClaimId: "claim", paidOn: "2026-08-01", amountCents: 65000 },
      { rentClaimId: "claim", paidOn: "2026-08-02", amountCents: 10000 },
    ];
    const allocations = allocateAncillaryPayments([{ ...claim, paidCents: 140000 }], payments);
    expect(payments.map(payment => allocations.get(payment))).toEqual([10000, 10000, 0]);
  });
  it("does not deduct charges again for payments outside the reporting window", () => {
    const payment = { rentClaimId: "claim", paidOn: "2026-08-01", amountCents: 20000 };
    expect(allocateAncillaryPayments([{ ...claim, paidCents: 150000 }], [payment]).get(payment)).toBe(0);
  });
  it("rounds installments cumulatively without creating extra cents", () => {
    const payments = [1,2,3].map(day => ({ rentClaimId: "claim", paidOn: `2026-07-0${day}`, amountCents: 1 }));
    expect([...allocateAncillaryPayments([{ ...claim, amountCents: 3, ancillaryCents: 1, paidCents: 3 }], payments).values()]).toEqual([0,1,0]);
  });
  it("never invents a deduction for an unassigned payment or a claim without charges", () => {
    const payment = { rentClaimId: null, paidOn: "2026-07-01", amountCents: 10000 };
    expect(allocateAncillaryPayments([claim], [payment]).get(payment)).toBe(0);
    const assigned = { ...payment, rentClaimId: "claim" };
    expect(allocateAncillaryPayments([{...claim, ancillaryCents:0}], [assigned]).get(assigned)).toBe(0);
  });
});
