import { describe, expect, it } from "vitest";
import {
  buildDocumentStoragePath,
  detectDocumentMimeType,
  DOCUMENT_MAX_BYTES,
  sanitizeOriginalFileName,
  validateDocumentFile,
} from "@/lib/documents/validation";

describe("document upload validation", () => {
  it("detects supported file signatures", () => {
    expect(
      detectDocumentMimeType(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])),
    ).toBe("application/pdf");
    expect(
      detectDocumentMimeType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0])),
    ).toBe("image/jpeg");
    expect(
      detectDocumentMimeType(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    ).toBe("image/png");
    expect(
      detectDocumentMimeType(
        new Uint8Array([
          0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
        ]),
      ),
    ).toBe("image/webp");
  });

  it("rejects spoofed mime types and oversized files", () => {
    expect(
      validateDocumentFile({
        declaredMimeType: "application/pdf",
        detectedMimeType: "image/png",
        size: 128,
      }),
    ).toMatch(/stimmen nicht überein/);
    expect(
      validateDocumentFile({
        declaredMimeType: "application/pdf",
        detectedMimeType: "application/pdf",
        size: DOCUMENT_MAX_BYTES + 1,
      }),
    ).toMatch(/größer als 10 MB/);
  });

  it("removes path and control characters from original names", () => {
    expect(sanitizeOriginalFileName("../../ordner/Rech\u0000nung.pdf")).toBe(
      "Rech_nung.pdf",
    );
  });

  it("builds an organization and document scoped UUID path", () => {
    expect(
      buildDocumentStoragePath({
        organizationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        documentId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        fileId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        mimeType: "application/pdf",
      }),
    ).toBe(
      "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/cccccccc-cccc-4ccc-8ccc-cccccccccccc.pdf",
    );
  });
});
