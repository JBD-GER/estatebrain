import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getViewer } from "@/lib/auth/dal";
import { DOCUMENT_BUCKET, sanitizeOriginalFileName } from "@/lib/documents/validation";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

function errorResponse(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const viewer = await getViewer();
  if (!viewer) return errorResponse("Bitte zuerst anmelden.", 401);
  if (!viewer.organizationId) {
    return errorResponse("Keine aktive Organisation ausgewählt.", 403);
  }

  const params = await context.params;
  const idResult = z.uuid().safeParse(params.id);
  if (!idResult.success) return errorResponse("Dokument nicht gefunden.", 404);

  const supabase = await createClient();
  const { data: document, error } = await supabase
    .from("documents")
    .select(
      "id, organization_id, storage_bucket, storage_path, original_file_name",
    )
    .eq("id", idResult.data)
    .eq("organization_id", viewer.organizationId)
    .eq("storage_bucket", DOCUMENT_BUCKET)
    .is("archived_at", null)
    .maybeSingle();

  if (error || !document) {
    return errorResponse("Dokument nicht gefunden.", 404);
  }

  const { data, error: signedUrlError } = await supabase.storage
    .from(DOCUMENT_BUCKET)
    .createSignedUrl(document.storage_path, 60, {
      download: sanitizeOriginalFileName(document.original_file_name).slice(0, 100),
    });

  if (signedUrlError || !data?.signedUrl) {
    return errorResponse("Download konnte nicht vorbereitet werden.", 502);
  }

  return NextResponse.redirect(data.signedUrl, {
    status: 303,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
