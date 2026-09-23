import Link from "next/link";
import { ArrowLeft, LockKeyhole } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { requireOrganization } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export default async function DocumentUploadPage({
  searchParams,
}: {
  searchParams: Promise<{ property?: string; renovation?: string }>;
}) {
  const viewer = await requireOrganization();

  if (!hasPermission(viewer.role, "documents.write")) {
    return (
      <div>
        <PageHeader
          eyebrow="Rechnungen & Belege"
          title="Dokument hochladen"
          description="Der Upload ist für deine aktuelle Rolle nicht freigegeben."
        />
        <Alert>
          <LockKeyhole />
          <AlertTitle>Keine Upload-Berechtigung</AlertTitle>
          <AlertDescription>
            Bitte wende dich an eine Person mit Administrationsrechten.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const supabase = await createClient();
  const [{ data: properties }, { data: units }, { data: leases }, {data: renovations}] =
    await Promise.all([
      supabase
        .from("properties")
        .select("id, name")
        .eq("organization_id", viewer.organizationId)
        .is("archived_at", null)
        .order("name"),
      supabase
        .from("units")
        .select("id, property_id, unit_number")
        .eq("organization_id", viewer.organizationId)
        .is("archived_at", null)
        .order("unit_number"),
      supabase
        .from("leases")
        .select("id, unit_id, starts_on, ends_on, status")
        .eq("organization_id", viewer.organizationId)
        .is("archived_at", null)
        .order("starts_on", { ascending: false }),
      supabase.from("renovation_projects").select("id,property_id,name").eq("organization_id",viewer.organizationId).is("archived_at",null).order("name"),
    ]);

  const requestedPropertyId = (await searchParams).property;
  const defaultPropertyId = (properties ?? []).some(
    (property) => property.id === requestedPropertyId,
  )
    ? requestedPropertyId
    : undefined;

  return (
    <div>
      <PageHeader
        eyebrow="Rechnungen & Belege"
        title="Dokument hochladen"
        description="Datei sicher ablegen, einer Immobilie zuordnen und für die weitere Prüfung vorbereiten."
        actions={
          <Button asChild variant="outline">
            <Link href="/app/belege">
              <ArrowLeft />
              Zurück zu Belegen
            </Link>
          </Button>
        }
      />
      <DocumentUploadForm
        properties={(properties ?? []).map((property) => ({
          id: String(property.id),
          name: String(property.name),
        }))}
        units={(units ?? []).map((unit) => ({
          id: String(unit.id),
          propertyId: String(unit.property_id),
          name: String(unit.unit_number),
        }))}
        leases={(leases ?? []).map((lease) => ({
          id: String(lease.id),
          unitId: String(lease.unit_id),
          startsOn: String(lease.starts_on),
          endsOn: lease.ends_on ? String(lease.ends_on) : null,
          status: String(lease.status),
        }))}
        renovations={(renovations ?? []).map(r=>({id:r.id,propertyId:r.property_id,name:r.name}))}
        defaultRenovationId={(await searchParams).renovation}
        defaultPropertyId={defaultPropertyId}
      />
    </div>
  );
}
