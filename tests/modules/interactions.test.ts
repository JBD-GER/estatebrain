import { describe, expect, it } from "vitest";
import { getModuleRowAction } from "@/lib/modules/interactions";

const recordId = "9f223e32-4798-4cf6-9c63-7a9c16265e2a";

describe("module row actions", () => {
  it("links property-backed modules to the existing property details route", () => {
    expect(getModuleRowAction("portfolio", recordId)).toEqual({
      href: `/app/immobilien/${recordId}`,
      kind: "open",
      label: "Details öffnen",
    });
    expect(getModuleRowAction("immobilien", recordId)).toEqual({
      href: `/app/immobilien/${recordId}`,
      kind: "open",
      label: "Details öffnen",
    });
  });

  it("opens a concrete document in the existing review workspace", () => {
    expect(getModuleRowAction("daten-pruefen", recordId)).toEqual({
      href: `/app/belege?review=${recordId}`,
      kind: "review",
      label: "Prüfung öffnen",
    });
  });

  it("keeps the existing secure document download as a real row action", () => {
    expect(getModuleRowAction("belege", recordId)).toEqual({
      href: `/api/documents/${recordId}/download`,
      kind: "download",
      label: "Sicher herunterladen",
    });
  });

  it("does not invent destinations for modules without a detail route", () => {
    expect(getModuleRowAction("aufgaben", recordId)).toBeNull();
    expect(getModuleRowAction("einheiten", recordId)).toBeNull();
  });

  it("rejects missing or malformed record identifiers", () => {
    expect(getModuleRowAction("immobilien", undefined)).toBeNull();
    expect(getModuleRowAction("immobilien", "../einstellungen")).toBeNull();
  });
});
