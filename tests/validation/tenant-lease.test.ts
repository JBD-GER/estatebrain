import { describe, expect, it } from "vitest";
import {
  euroInputToCents,
  parseTenantLeaseFormData,
  toCreateTenantLeasePayload,
} from "@/lib/validation/tenant-lease";

const propertyId = "11111111-1111-4111-8111-111111111111";
const unitId = "22222222-2222-4222-8222-222222222222";

function validForm(overrides: Record<string, string> = {}) {
  const values = {
    propertyId,
    unitId,
    tenantType: "person",
    firstName: "  Erika  ",
    lastName: "Mustermann",
    companyName: "",
    email: " ERIKA@EXAMPLE.DE ",
    phone: "+49 511 123456",
    street: "Musterweg",
    houseNumber: "4",
    postalCode: "30159",
    city: "Hannover",
    leaseNumber: "MV-2026-001",
    startsOn: "2026-09-01",
    endsOn: "",
    noticePeriodMonths: "3",
    dueDay: "3",
    coldRentCents: "875,40",
    ancillaryChargeType: "advance",
    ancillaryPrepaymentCents: "210.00",
    parkingRentCents: "35",
    otherRentCents: "0",
    depositCents: "2626,20",
    ...overrides,
  };
  const formData = new FormData();
  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value);
  }
  return formData;
}

describe("tenant lease validation", () => {
  it("maps exact euro inputs to integer cents without floating-point drift", () => {
    expect(euroInputToCents("0,29")).toBe(29);
    expect(euroInputToCents("875.40")).toBe(87_540);
    expect(euroInputToCents("35")).toBe(3_500);
  });

  it("normalizes and validates a person lease form", () => {
    const result = parseTenantLeaseFormData(validForm());

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toMatchObject({
      firstName: "Erika",
      lastName: "Mustermann",
      email: "erika@example.de",
      coldRentCents: 87_540,
      ancillaryChargeType: "advance",
      ancillaryPrepaymentCents: 21_000,
      parkingRentCents: 3_500,
      otherRentCents: 0,
      depositCents: 262_620,
      dueDay: 3,
      noticePeriodMonths: 3,
    });
  });

  it("requires the legal name for the selected tenant type", () => {
    const company = parseTenantLeaseFormData(
      validForm({
        tenantType: "company",
        firstName: "",
        lastName: "",
        companyName: "",
      }),
    );
    expect(company.success).toBe(false);
    if (company.success) return;
    expect(company.error.flatten().fieldErrors.companyName).toContain(
      "Bitte gib den Firmennamen ein.",
    );
  });

  it.each<
    [Record<string, string>, "startsOn" | "endsOn" | "coldRentCents" | "dueDay"]
  >([
    [{ startsOn: "2026-02-31" }, "startsOn"],
    [{ endsOn: "2026-08-31" }, "endsOn"],
    [{ coldRentCents: "0" }, "coldRentCents"],
    [{ dueDay: "32" }, "dueDay"],
  ])("rejects invalid contract values", (overrides, field) => {
    const result = parseTenantLeaseFormData(validForm(overrides));
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.flatten().fieldErrors[field]).toBeDefined();
  });

  it("requires a zero amount when no separate ancillary charge exists", () => {
    const result = parseTenantLeaseFormData(
      validForm({
        ancillaryChargeType: "none",
        ancillaryPrepaymentCents: "210",
      }),
    );
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(
      result.error.flatten().fieldErrors.ancillaryPrepaymentCents,
    ).toContain(
      "Ohne gesonderte Nebenkosten muss der monatliche Betrag 0 € sein.",
    );
  });
});

describe("tenant lease RPC mapping", () => {
  it("maps a company tenant and all contract components to the RPC payload", () => {
    const result = parseTenantLeaseFormData(
      validForm({
        tenantType: "company",
        firstName: "",
        lastName: "",
        companyName: "  Beispiel Hausverwaltung GmbH ",
        endsOn: "2028-08-31",
      }),
    );
    expect(result.success).toBe(true);
    if (!result.success) return;

    expect(toCreateTenantLeasePayload(result.data)).toEqual({
      property_id: propertyId,
      unit_id: unitId,
      tenant_type: "company",
      first_name: null,
      last_name: null,
      company_name: "Beispiel Hausverwaltung GmbH",
      email: "erika@example.de",
      phone: "+49 511 123456",
      street: "Musterweg",
      house_number: "4",
      postal_code: "30159",
      city: "Hannover",
      country_code: "DE",
      lease_number: "MV-2026-001",
      starts_on: "2026-09-01",
      ends_on: "2028-08-31",
      notice_period_months: 3,
      due_day: 3,
      cold_rent_cents: 87_540,
      ancillary_charge_type: "advance",
      ancillary_prepayment_cents: 21_000,
      parking_rent_cents: 3_500,
      other_rent_cents: 0,
      deposit_cents: 262_620,
    });
  });
});
