import { describe, expect, it } from "vitest";
import {
  DOCUMENT_STATUSES_REQUIRING_ATTENTION,
  documentStatusRequiresAttention,
} from "@/lib/documents/status";
import { moduleRowRequiresAttention } from "@/lib/modules/summary";

describe("document review status", () => {
  it("treats every unresolved database status as requiring attention", () => {
    expect(DOCUMENT_STATUSES_REQUIRING_ATTENTION).toEqual([
      "missing",
      "unreadable",
      "unclear_assignment",
      "review_required",
    ]);

    for (const status of DOCUMENT_STATUSES_REQUIRING_ATTENTION) {
      expect(documentStatusRequiresAttention(status)).toBe(true);
    }
  });

  it("does not treat completed or legacy non-schema values as unresolved", () => {
    for (const status of ["complete", "reviewed", "unclear", "review", null]) {
      expect(documentStatusRequiresAttention(status)).toBe(false);
    }
  });
});

describe("module summary attention", () => {
  it("checks the actual expense document_status even when payment is paid", () => {
    expect(
      moduleRowRequiresAttention({
        payment_status: "paid",
        document_status: "unclear_assignment",
      }),
    ).toBe(true);
  });

  it("checks the actual document review_status", () => {
    expect(
      moduleRowRequiresAttention({
        status: "active",
        review_status: "review_required",
      }),
    ).toBe(true);
  });

  it("keeps generic open and urgent records visible as attention items", () => {
    expect(moduleRowRequiresAttention({ payment_status: "open" })).toBe(true);
    expect(moduleRowRequiresAttention({ priority: "urgent" })).toBe(true);
  });

  it("ignores resolved records and the nonexistent receipt_status field", () => {
    expect(
      moduleRowRequiresAttention({
        payment_status: "paid",
        document_status: "complete",
        review_status: "reviewed",
      }),
    ).toBe(false);
    expect(moduleRowRequiresAttention({ receipt_status: "missing" })).toBe(
      false,
    );
  });
});
