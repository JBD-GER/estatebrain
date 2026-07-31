import { NextResponse, type NextRequest } from "next/server";
import { getViewer } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

type SearchResult = {
  id: string;
  type: "Immobilie" | "Einheit" | "Mieter" | "Dokument" | "Aufgabe" | "Nachricht";
  title: string;
  subtitle: string;
  href: string;
};

function asText(value: unknown) {
  return typeof value === "string" ? value : "";
}

function escapeLikePattern(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}

function shortText(value: unknown, fallback: string, maxLength = 90) {
  const text = asText(value).replace(/\s+/g, " ").trim() || fallback;
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

export async function GET(request: NextRequest) {
  const viewer = await getViewer();
  if (!viewer) {
    return NextResponse.json(
      { error: "Bitte zuerst anmelden." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }
  if (!viewer.organizationId) {
    return NextResponse.json(
      { error: "Keine aktive Organisation ausgewählt." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }

  const rawQuery = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (rawQuery.length < 2) {
    return NextResponse.json(
      { results: [] },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }
  if (rawQuery.length > 80) {
    return NextResponse.json(
      { error: "Der Suchbegriff ist zu lang." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const supabase = await createClient();
  const pattern = `%${escapeLikePattern(rawQuery)}%`;
  const organizationId = viewer.organizationId;

  const [
    propertiesByName,
    propertiesByCity,
    units,
    tenantsByFirstName,
    tenantsByLastName,
    tenantsByCompany,
    documentsByName,
    documentsByTitle,
    tasks,
    messages,
  ] = await Promise.all([
    supabase
      .from("properties")
      .select("id, name, city, street, house_number")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .ilike("name", pattern)
      .limit(5),
    supabase
      .from("properties")
      .select("id, name, city, street, house_number")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .ilike("city", pattern)
      .limit(5),
    supabase
      .from("units")
      .select("id, unit_number, floor, status")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .ilike("unit_number", pattern)
      .limit(5),
    supabase
      .from("tenants")
      .select("id, first_name, last_name, company_name, city")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .ilike("first_name", pattern)
      .limit(5),
    supabase
      .from("tenants")
      .select("id, first_name, last_name, company_name, city")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .ilike("last_name", pattern)
      .limit(5),
    supabase
      .from("tenants")
      .select("id, first_name, last_name, company_name, city")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .ilike("company_name", pattern)
      .limit(5),
    supabase
      .from("documents")
      .select("id, original_file_name, title, document_type")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .ilike("original_file_name", pattern)
      .limit(5),
    supabase
      .from("documents")
      .select("id, original_file_name, title, document_type")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .ilike("title", pattern)
      .limit(5),
    supabase
      .from("tasks")
      .select("id, title, priority, status")
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .ilike("title", pattern)
      .limit(5),
    supabase
      .from("messages")
      .select("id, conversation_id, body, sent_at")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .ilike("body", pattern)
      .limit(5),
  ]);

  const results: SearchResult[] = [];
  const seen = new Set<string>();
  const add = (result: SearchResult) => {
    const key = `${result.type}:${result.id}`;
    if (seen.has(key) || results.length >= 30) return;
    seen.add(key);
    results.push(result);
  };

  for (const property of [
    ...(propertiesByName.data ?? []),
    ...(propertiesByCity.data ?? []),
  ]) {
    add({
      id: String(property.id),
      type: "Immobilie",
      title: shortText(property.name, "Immobilie"),
      subtitle: shortText(
        `${asText(property.street)} ${asText(property.house_number)}, ${asText(property.city)}`,
        "Immobilie",
      ),
      href: `/app/immobilien/${property.id}`,
    });
  }

  for (const unit of units.data ?? []) {
    add({
      id: String(unit.id),
      type: "Einheit",
      title: `Einheit ${shortText(unit.unit_number, "ohne Nummer", 60)}`,
      subtitle: shortText(
        [unit.floor ? `Etage ${unit.floor}` : "", unit.status]
          .filter(Boolean)
          .join(" · "),
        "Einheit",
      ),
      href: `/app/einheiten?focus=${unit.id}`,
    });
  }

  for (const tenant of [
    ...(tenantsByFirstName.data ?? []),
    ...(tenantsByLastName.data ?? []),
    ...(tenantsByCompany.data ?? []),
  ]) {
    const personName = `${asText(tenant.first_name)} ${asText(tenant.last_name)}`.trim();
    add({
      id: String(tenant.id),
      type: "Mieter",
      title: shortText(tenant.company_name || personName, "Mieter"),
      subtitle: shortText(tenant.city, "Mieterkontakt"),
      href: `/app/mietverhaeltnisse?tenant=${tenant.id}`,
    });
  }

  for (const document of [
    ...(documentsByName.data ?? []),
    ...(documentsByTitle.data ?? []),
  ]) {
    add({
      id: String(document.id),
      type: "Dokument",
      title: shortText(document.title || document.original_file_name, "Dokument"),
      subtitle: shortText(document.document_type, "Dokument"),
      href: `/api/documents/${document.id}/download`,
    });
  }

  for (const task of tasks.data ?? []) {
    add({
      id: String(task.id),
      type: "Aufgabe",
      title: shortText(task.title, "Aufgabe"),
      subtitle: shortText(
        `${asText(task.priority)} · ${asText(task.status)}`,
        "Aufgabe",
      ),
      href: `/app/aufgaben?focus=${task.id}`,
    });
  }

  for (const message of messages.data ?? []) {
    add({
      id: String(message.id),
      type: "Nachricht",
      title: shortText(message.body, "Nachricht"),
      subtitle: "Kommunikation",
      href: `/app/kommunikation?conversation=${message.conversation_id}`,
    });
  }

  return NextResponse.json(
    { results },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
