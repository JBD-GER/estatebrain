import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getViewer } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import {
  buildDocumentStoragePath,
  detectDocumentMimeType,
  DOCUMENT_BUCKET,
  DOCUMENT_MAX_BYTES,
  DOCUMENT_MIME_TYPES,
  parseDocumentUploadMetadata,
  sanitizeOriginalFileName,
  validateDocumentFile,
} from "@/lib/documents/validation";
import { validateDocumentRelationSelection } from "@/lib/documents/relations";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 30;

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: { "Cache-Control": "no-store" },
    },
  );
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return errorResponse("Bitte zuerst anmelden.", 401);
  if (!viewer.organizationId || !viewer.role) {
    return errorResponse("Keine aktive Organisation ausgewählt.", 403);
  }
  if (!hasPermission(viewer.role, "documents.write")) {
    return errorResponse("Keine Berechtigung zum Hochladen von Dokumenten.", 403);
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (
    Number.isFinite(contentLength) &&
    contentLength > DOCUMENT_MAX_BYTES + 128 * 1024
  ) {
    return errorResponse("Die Datei ist größer als 10 MB.", 413);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return errorResponse("Die Upload-Daten konnten nicht gelesen werden.", 400);
  }

  const metadataResult = parseDocumentUploadMetadata(formData);
  if (!metadataResult.success) {
    return NextResponse.json(
      {
        error: "Bitte die Dokumentangaben prüfen.",
        fields: metadataResult.error.flatten().fieldErrors,
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return errorResponse("Bitte eine Datei auswählen.", 400);
  }
  if (!Number.isSafeInteger(file.size) || file.size <= 0) {
    return errorResponse("Die Datei ist leer oder ungültig.", 400);
  }
  if (file.size > DOCUMENT_MAX_BYTES) {
    return errorResponse("Die Datei ist größer als 10 MB.", 413);
  }
  if (!DOCUMENT_MIME_TYPES.includes(file.type as (typeof DOCUMENT_MIME_TYPES)[number])) {
    return errorResponse("Erlaubt sind PDF-, JPEG-, PNG- und WebP-Dateien.", 400);
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detectedMimeType = detectDocumentMimeType(bytes.subarray(0, 16));
  const fileError = validateDocumentFile({
    declaredMimeType: file.type,
    detectedMimeType,
    size: file.size,
  });
  if (fileError || !detectedMimeType) {
    return errorResponse(fileError ?? "Ungültige Datei.", 400);
  }

  const metadata = metadataResult.data;
  const supabase = await createClient();
  const [propertyResult, unitResult, leaseResult, renovationResult] = await Promise.all([
    metadata.propertyId
      ? supabase
          .from("properties")
          .select("id")
          .eq("id", metadata.propertyId)
          .eq("organization_id", viewer.organizationId)
          .is("archived_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    metadata.unitId
      ? supabase
          .from("units")
          .select("id, property_id")
          .eq("id", metadata.unitId)
          .eq("organization_id", viewer.organizationId)
          .is("archived_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    metadata.leaseId
      ? supabase
          .from("leases")
          .select("id, unit_id")
          .eq("id", metadata.leaseId)
          .eq("organization_id", viewer.organizationId)
          .is("archived_at", null)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    metadata.renovationProjectId ? supabase.from("renovation_projects").select("id, property_id").eq("id",metadata.renovationProjectId).eq("organization_id",viewer.organizationId).is("archived_at",null).maybeSingle() : Promise.resolve({data:null,error:null}),
  ]);

  if (renovationResult.error || propertyResult.error || unitResult.error || leaseResult.error) {
    return errorResponse("Die Dokumentzuordnung konnte nicht geprüft werden.", 400);
  }

  const relationError = validateDocumentRelationSelection(metadata, {
    renovation: renovationResult.data,
    property: propertyResult.data,
    unit: unitResult.data,
    lease: leaseResult.data,
  });
  if (relationError) {
    return errorResponse(relationError, 400);
  }

  const documentId = randomUUID();
  const storagePath = buildDocumentStoragePath({
    organizationId: viewer.organizationId,
    documentId,
    fileId: randomUUID(),
    mimeType: detectedMimeType,
  });
  const originalFileName = sanitizeOriginalFileName(file.name);
  const sha256 = createHash("sha256").update(bytes).digest("hex");

  const { error: metadataError } = await supabase.from("documents").insert({
    id: documentId,
    organization_id: viewer.organizationId,
    renovation_project_id: metadata.renovationProjectId ?? null,
    property_id: metadata.propertyId ?? null,
    unit_id: metadata.unitId ?? null,
    lease_id: metadata.leaseId ?? null,
    storage_bucket: DOCUMENT_BUCKET,
    storage_path: storagePath,
    original_file_name: originalFileName,
    mime_type: detectedMimeType,
    size_bytes: file.size,
    sha256: `\\x${sha256}`,
    document_type: metadata.documentType,
    title: metadata.title ?? null,
    document_date: metadata.documentDate ?? null,
    review_status: "review_required",
    tenant_visible: metadata.tenantVisible,
    ocr_status: "pending",
    created_by: viewer.userId,
  });

  if (metadataError) {
    return errorResponse("Das Dokument konnte nicht angelegt werden.", 400);
  }

  const { error: uploadError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .upload(storagePath, bytes, {
      cacheControl: "3600",
      contentType: detectedMimeType,
      upsert: false,
      metadata: {
        documentId,
        organizationId: viewer.organizationId,
        uploadedBy: viewer.userId,
      },
    });

  if (uploadError) {
    const { error: deleteError } = await supabase
      .from("documents")
      .delete()
      .eq("id", documentId)
      .eq("organization_id", viewer.organizationId);

    if (deleteError) {
      await supabase
        .from("documents")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", documentId)
        .eq("organization_id", viewer.organizationId);
    }

    return errorResponse("Der Datei-Upload ist fehlgeschlagen.", 502);
  }

  return NextResponse.json(
    {
      message: "Dokument sicher hochgeladen.",
      document: {
        id: documentId,
        fileName: originalFileName,
        reviewStatus: "review_required",
      },
    },
    {
      status: 201,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
