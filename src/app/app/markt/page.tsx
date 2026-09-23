import Link from "next/link";
import { requireOrganization } from "@/lib/auth/dal";
import { hasPermission } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { valuationDefaults } from "@/lib/valuations/somantic";
import { valuationSummaryMetrics } from "@/lib/valuations/summary";
import { ValuationDialog } from "@/components/valuations/valuation-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getModulePageData } from "@/lib/data/modules";
import { ModuleWorkspace } from "@/components/app/module-workspace";

export const maxDuration = 120;
export default async function MarketPage({searchParams}:{searchParams:Promise<{property?:string}>}) {
  const viewer=await requireOrganization(); const supabase=await createClient(); const query=await searchParams;
  const [properties,reports,history,units]=await Promise.all([
    supabase.from("properties").select("*").eq("organization_id",viewer.organizationId).is("archived_at",null).order("name"),
    supabase.from("somantic_valuation_reports").select("id,property_id,valuation_year,status,error_message,requested_at").eq("organization_id",viewer.organizationId).order("requested_at",{ascending:false}),
    getModulePageData("markt"),
    supabase.from("units").select("property_id,area_sqm,rooms,unit_type").eq("organization_id",viewer.organizationId).is("archived_at",null),
  ]);
  const selectedProperties = properties.error ? null : (properties.data ?? []).filter(p=>!query.property || p.id===query.property);
  const historyRows = (history?.rows ?? []).filter(r=>!query.property || r.property_id===query.property);
  return <div className="space-y-6"><div><p className="text-sm text-muted-foreground">Somantic · Immobilienbewertung</p><h1 className="text-3xl font-semibold">Immobilienbewertung</h1><p className="mt-2 text-muted-foreground">Kaufpreis, mögliche Kaltmiete und Preisspannen auf Basis vergleichbarer Wohnimmobilien. Bewertungen können bei Bedarf erneut abgerufen werden.</p></div>
    {(properties.error || reports.error) ? <p role="alert">Die Bewertungsdaten konnten nicht geladen werden. Bitte erneut laden.</p> : <div className="grid gap-4 lg:grid-cols-2">{properties.data?.filter(p=>!query.property || p.id===query.property).map(p=>{
      const propertyReports=reports.data?.filter(r=>r.property_id===p.id) ?? []; const current=propertyReports[0]; const locked=propertyReports.some(r=>["pending","uncertain"].includes(r.status));
      return <Card key={p.id}><CardHeader><CardTitle><Link href={`/app/immobilien/${p.id}`}>{p.name}</Link></CardTitle><p className="text-sm text-muted-foreground">{p.street} {p.house_number}, {p.postal_code} {p.city}</p></CardHeader><CardContent className="space-y-3">
        {locked ? <p>Eine Anfrage wurde bereits gestartet. Bitte den laufenden Abruf abwarten; bei unbestätigtem Status den Support kontaktieren.</p> : hasPermission(viewer.role,"portfolio.write") && <ValuationDialog propertyId={p.id} name={p.name} defaults={{...valuationDefaults(p,(units.data ?? []).filter(u=>u.property_id===p.id)),comparison_scope:"broader"}} disabled={p.country_code!=="DE"}/>}
        {p.country_code!=="DE" && <p className="text-sm">Somantic unterstützt nur Immobilien in Deutschland.</p>}
        {current?.error_message && <p className="text-sm text-destructive">{current.error_message}</p>}
        {propertyReports.filter(r=>["succeeded","insufficient","uncertain"].includes(r.status)).map(r=><Link className="block text-sm underline" key={r.id} href={`/app/markt/${r.id}`}>Bewertungsbericht vom {new Date(r.requested_at).toLocaleString("de-DE",{timeZone:"Europe/Berlin"})} öffnen</Link>)}
      </CardContent></Card>;
    })}{!properties.data?.length && <p>Lege zuerst eine Immobilie an, um sie bewerten zu lassen.</p>}</div>}
    {history && <ModuleWorkspace headingLevel={2} {...history} rows={historyRows} summaryMetrics={valuationSummaryMetrics(selectedProperties,historyRows.length)} initialFieldValues={query.property ? {property_id:query.property} : undefined} definition={{...history.definition,title:"Bewertungshistorie",description:"Der aktuelle Marktwert zählt je Immobilie einmal. Frühere Bewertungen bleiben zum Vergleich erhalten und werden nicht addiert."}}/>}
  </div>;
}
