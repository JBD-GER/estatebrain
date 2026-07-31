import { describe, expect, it } from "vitest";
import { parseManualRentPaymentFormData } from "@/lib/validation/rent-payment";

function form(overrides: Record<string, string> = {}) {
  const values = {
    rentClaimId: "11111111-1111-4111-8111-111111111111",
    paidOn: "2026-07-31",
    amount: "1.234,56",
    notes: "Zahlung laut Kontoauszug",
    ...overrides,
  };
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }
  return formData;
}

describe("manual rent payment validation", () => {
  it("normalizes a German euro amount to exact cents", () => {
    const result = parseManualRentPaymentFormData(form());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      amountCents: 123_456,
      paidOn: "2026-07-31",
    });
  });

  it.each<
    [
      Record<string, string>,
      "amountCents" | "paidOn" | "rentClaimId",
    ]
  >([
    [{ amount: "0" }, "amountCents"],
    [{ amount: "nicht-zahlbar" }, "amountCents"],
    [{ paidOn: "2026-02-31" }, "paidOn"],
    [{ rentClaimId: "invalid" }, "rentClaimId"],
  ])("rejects invalid payment data", (overrides, field) => {
    const result = parseManualRentPaymentFormData(form(overrides));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.flatten().fieldErrors[field]).toBeDefined();
  });
});
