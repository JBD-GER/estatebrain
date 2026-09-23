import { z } from "zod";
import {
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIME_EXTENSIONS,
  DOCUMENT_MIME_TYPES,
  type DocumentMimeType,
} from "@/lib/documents/constants";

export {
  DOCUMENT_ACCEPT,
  DOCUMENT_BUCKET,
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIME_TYPES,
} from "@/lib/documents/constants";
export type { DocumentMimeType } from "@/lib/documents/constants";

const optionalUuid = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
  z.uuid("Ungültige Zuordnung.").optional(),
);

export const documentUploadMetadataSchema = z
  .object({
    propertyId: optionalUuid,
    renovationProjectId: optionalUuid,
    unitId: optionalUuid,
    leaseId: optionalUuid,
    documentType: z.enum([
      "invoice",
      "receipt",
      "contract",
      "lease",
      "bank_statement",
      "tax",
      "insurance",
      "handover",
      "correspondence",
      "other",
    ]),
    title: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim() ? value.trim() : undefined,
      z
        .string()
        .max(160, "Der Titel darf höchstens 160 Zeichen lang sein.")
        .optional(),
    ),
    documentDate: z.preprocess(
      (value) =>
        typeof value === "string" && value.trim() ? value.trim() : undefined,
      z.iso.date("Bitte ein gültiges Dokumentdatum angeben.").optional(),
    ),
    tenantVisible: z.preprocess(
      (value) =>
        value === true ||
        value === "true" ||
        value === "on" ||
        value === "1",
      z.boolean(),
    ),
  })
  .superRefine((value, context) => {
    if (value.unitId && !value.propertyId) {
      context.addIssue({
        code: "custom",
        path: ["unitId"],
        message: "Bitte zuerst eine Immobilie auswählen.",
      });
    }
    if (value.leaseId && !value.unitId) {
      context.addIssue({
        code: "custom",
        path: ["leaseId"],
        message: "Bitte zuerst eine Einheit auswählen.",
      });
    }
    if (value.tenantVisible && !value.leaseId) {
      context.addIssue({
        code: "custom",
        path: ["tenantVisible"],
        message:
          "Für die Sichtbarkeit im Mieterportal ist ein Mietverhältnis erforderlich.",
      });
    }
  });

export type DocumentUploadMetadata = z.output<
  typeof documentUploadMetadataSchema
>;

export function parseDocumentUploadMetadata(formData: FormData) {
  return documentUploadMetadataSchema.safeParse({
    propertyId: formData.get("propertyId"),
    renovationProjectId: formData.get("renovationProjectId"),
    unitId: formData.get("unitId"),
    leaseId: formData.get("leaseId"),
    documentType: formData.get("documentType"),
    title: formData.get("title"),
    documentDate: formData.get("documentDate"),
    tenantVisible: formData.get("tenantVisible"),
  });
}

export function detectDocumentMimeType(
  bytes: Uint8Array,
): DocumentMimeType | null {
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return "application/pdf";
  }

  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }

  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }

  return null;
}

export function validateDocumentFile({
  declaredMimeType,
  detectedMimeType,
  size,
}: {
  declaredMimeType: string;
  detectedMimeType: DocumentMimeType | null;
  size: number;
}) {
  if (!Number.isSafeInteger(size) || size <= 0) {
    return "Die Datei ist leer oder ungültig.";
  }
  if (size > DOCUMENT_MAX_BYTES) {
    return "Die Datei ist größer als 10 MB.";
  }
  if (!DOCUMENT_MIME_TYPES.includes(declaredMimeType as DocumentMimeType)) {
    return "Erlaubt sind PDF-, JPEG-, PNG- und WebP-Dateien.";
  }
  if (!detectedMimeType || detectedMimeType !== declaredMimeType) {
    return "Dateityp und Dateiinhalt stimmen nicht überein.";
  }
  return null;
}

export function sanitizeOriginalFileName(value: string) {
  const leafName = value.split(/[\\/]/).pop() ?? "";
  const normalized = leafName
    .normalize("NFC")
    .replace(/[\u0000-\u001f\u007f<>:"|?*]/g, "_")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "");

  return (normalized || "dokument").slice(0, 180);
}

export function buildDocumentStoragePath({
  organizationId,
  documentId,
  fileId,
  mimeType,
}: {
  organizationId: string;
  documentId: string;
  fileId: string;
  mimeType: DocumentMimeType;
}) {
  return `${organizationId}/${documentId}/${fileId}.${DOCUMENT_MIME_EXTENSIONS[mimeType]}`;
}
