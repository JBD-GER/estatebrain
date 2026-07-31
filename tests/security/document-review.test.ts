import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  validateDocumentRelationSelection,
} from "@/lib/documents/relations";
import {
  parseDocumentReviewFormData,
  parseMoneyToCents,
} from "@/lib/documents/review";
import { parseDocumentUploadMetadata } from "@/lib/documents/validation";

const propertyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const unitId = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const leaseId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const categoryId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const documentId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";

function validReviewForm() {
  const formData = new FormData();
  formData.set("documentId", documentId);
  formData.set("propertyId", propertyId);
  formData.set("unitId", unitId);
  formData.set("leaseId", leaseId);
  formData.set("categoryId", categoryId);
  formData.set("documentType", "invoice");
  formData.set("vendorName", "Hausservice Beispiel GmbH");
  formData.set("invoiceNumber", "RE-2026-41");
  formData.set("invoiceDate", "2026-07-15");
  formData.set("serviceDate", "2026-07-10");
  formData.set("grossAmount", "1.190,00");
  formData.set("netAmount", "1.000,00");
  formData.set("taxAmount", "190,00");
  formData.set("currency", "eur");
  formData.set("description", "Wartung der Heizungsanlage");
  formData.set("entryDate", "2026-07-15");
  formData.set("paymentStatus", "open");
  formData.set("tenantVisible", "true");
  formData.set("isCashEffective", "true");
  formData.set("isTaxRelevant", "true");
  return formData;
}

describe("document review validation", () => {
  it("parses common German and international money formats exactly", () => {
    expect(parseMoneyToCents("1.234,56 €")).toBe(123456);
    expect(parseMoneyToCents("1234.56")).toBe(123456);
    expect(parseMoneyToCents("12,3")).toBe(1230);
    expect(parseMoneyToCents("1.234")).toBe(123400);
    expect(parseMoneyToCents("12,345")).toBe(1234500);
    expect(parseMoneyToCents("12,3456")).toBeNull();
  });

  it("normalizes a complete review payload for the atomic RPC", () => {
    const result = parseDocumentReviewFormData(validReviewForm());
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.grossAmountCents).toBe(119000);
    expect(result.data.netAmountCents).toBe(100000);
    expect(result.data.taxAmountCents).toBe(19000);
    expect(result.data.currency).toBe("EUR");
    expect(result.data.tenantVisible).toBe(true);
  });

  it("rejects incomplete tenant visibility and contradictory accounting data", () => {
    const formData = validReviewForm();
    formData.delete("leaseId");
    formData.set("grossAmount", "100,00");
    formData.set("isInterest", "true");
    formData.set("isPrincipal", "true");

    const result = parseDocumentReviewFormData(formData);
    expect(result.success).toBe(false);
    if (result.success) return;
    const fields = result.error.flatten().fieldErrors;
    expect(fields.tenantVisible?.[0]).toMatch(/Mietverhältnis/);
    expect(fields.grossAmountCents?.[0]).toMatch(/Bruttobetrag/);
    expect(fields.isPrincipal?.[0]).toMatch(/Zins und Tilgung/);
  });

  it("requires a lease before an upload can be tenant-visible", () => {
    const formData = new FormData();
    formData.set("documentType", "invoice");
    formData.set("tenantVisible", "true");
    const result = parseDocumentUploadMetadata(formData);
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(
      result.error.flatten().fieldErrors.tenantVisible?.[0],
    ).toMatch(/Mietverhältnis/);
  });
});

describe("document assignment hierarchy", () => {
  const records = {
    property: { id: propertyId },
    unit: { id: unitId, property_id: propertyId },
    lease: { id: leaseId, unit_id: unitId },
  };

  it("accepts a coherent property, unit and lease chain", () => {
    expect(
      validateDocumentRelationSelection(
        {
          propertyId,
          unitId,
          leaseId,
          tenantVisible: true,
        },
        records,
      ),
    ).toBeNull();
  });

  it("rejects a unit from another property and a lease from another unit", () => {
    expect(
      validateDocumentRelationSelection(
        {
          propertyId,
          unitId,
          tenantVisible: false,
        },
        {
          ...records,
          unit: { id: unitId, property_id: categoryId },
        },
      ),
    ).toMatch(/gehört nicht/);

    expect(
      validateDocumentRelationSelection(
        {
          propertyId,
          unitId,
          leaseId,
          tenantVisible: false,
        },
        {
          ...records,
          lease: { id: leaseId, unit_id: categoryId },
        },
      ),
    ).toMatch(/gehört nicht/);
  });
});

describe("atomic document review migration", () => {
  const migration = readFileSync(
    new URL(
      "../../supabase/migrations/20260731100000_document_review_workflow.sql",
      import.meta.url,
    ),
    "utf8",
  );

  it("locks and authorizes the review before mutating all workflow tables", () => {
    expect(migration).toContain("private.can_write_bookkeeping");
    expect(migration).toContain("for update;");
    expect(migration).toContain("insert into public.document_extractions");
    expect(migration).toContain("insert into public.expense_entries");
    expect(migration).toContain("insert into public.document_links");
    expect(migration).toContain("review_status = 'reviewed'");
    expect(migration).toContain("ocr_status = 'succeeded'");
  });

  it("revokes public execution and enforces tenant-visible lease scope", () => {
    expect(migration).toContain(
      "documents_tenant_visibility_requires_lease",
    );
    expect(migration).toContain(
      "private.enforce_document_assignment_scope",
    );
    expect(migration).toMatch(
      /revoke all on function public\.review_document_expense[\s\S]*from public, anon/,
    );
  });
});
