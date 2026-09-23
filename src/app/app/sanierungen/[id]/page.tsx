import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOrganization } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { getModulePageData } from "@/lib/data/modules";
import { ModuleWorkspace } from "@/components/app/module-workspace";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function RenovationDetail({params}:{params:Promise<{id:string}>}){
  const {id}=await params;const viewer=await requireOrganization();const supabase=await createClient();
  const {data:project}=await supabase.from("renovation_projects").select("*").eq("id",id).eq("organization_id",viewer.organizationId).is("archived_at",null).maybeSingle();if(!project)notFound();
  const [documents,workspace]=await Promise.all([
    supabase.from("documents").select("id,title,original_file_name,document_date,review_status").eq("organization_id",viewer.organizationId).eq("renovation_project_id",id).is("archived_at",null).order("document_date",{ascending:false}),
    getModulePageData("sanierungen"),
  ]);
  return <div className="space-y-6"><Link className="text-sm underline" href="/app/sanierungen">Zurück zu Sanierungen</Link>
    {workspace && <ModuleWorkspace {...workspace} afterDeleteHref="/app/sanierungen" rows={[project]} definition={{...workspace.definition,title:project.name,description:"Die Gesamtkosten enthalten alle zugeordneten Belege und zählen im Monat des Abschlussdatums zum Cashflow."}}/>}
    <Card><CardHeader><CardTitle>Zugeordnete Rechnungen und Belege</CardTitle></CardHeader><CardContent className="space-y-4">
      {hasPermission(viewer.role,"documents.write") && <Button asChild><Link href={`/app/belege/upload?property=${project.property_id}&renovation=${project.id}`}>Beleg für diese Sanierung hochladen</Link></Button>}
      {documents.error ? <p role="alert">Belege konnten nicht geladen werden.</p> : documents.data?.map(doc=><div className="flex justify-between gap-4 rounded-lg border p-3" key={doc.id}><Link className="underline" href={`/app/belege?review=${doc.id}`}>{doc.title || doc.original_file_name}</Link><span>{doc.document_date ?? "Ohne Datum"}</span></div>)}
      {!documents.error && !documents.data?.length && <p className="text-sm text-muted-foreground">Noch keine Belege zugeordnet. Bestehende Belege kannst du unter Rechnungen & Belege dieser Sanierung zuweisen.</p>}
    </CardContent></Card>
  </div>;
}
