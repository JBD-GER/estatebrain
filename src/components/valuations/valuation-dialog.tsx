"use client";
import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { requestValuationAction } from "@/app/app/markt/actions";
import { valuationInputSchema, propertyTypes, featureLabels, type ValuationInput } from "@/lib/valuations/somantic";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ValuationDialog({propertyId, name, defaults, disabled, triggerLabel="Immobilie bewerten"}: {propertyId:string; name:string; defaults:Partial<ValuationInput>; disabled?:boolean; triggerLabel?:string}) {
  const [open,setOpen] = useState(false);
  const [typ,setTyp] = useState(defaults.typ ?? "");
  const [comparisonScope,setComparisonScope] = useState(defaults.comparison_scope ?? "broader");
  const [errors,setErrors] = useState<Record<string,string[]>>({});
  const [message,setMessage] = useState("");
  const [pending,startTransition] = useTransition();
  const router = useRouter();
  const id = useId();
  const missing = valuationInputSchema.safeParse(defaults);
  const labels: Record<string,string> = {typ:"Haus oder Wohnung",street:"Straße und Hausnummer",postcode:"Postleitzahl",city:"Ort",square_meters:"Wohnfläche",property_type:"Passende Objektart"};
  const missingLabels = missing.success ? [] : [...new Set(missing.error.issues.map(i=>labels[String(i.path[0])]).filter(Boolean))];
  const optionalMissing = [!defaults.rooms && "Zimmerzahl",!defaults.year_of_construction && "Baujahr",!defaults.property_type && "genaue Objektart",defaults.rented==null && "Vermietungsstatus"].filter(Boolean);
  return <Dialog open={open} onOpenChange={v=>{if(!pending)setOpen(v);}}>
    <DialogTrigger asChild><Button disabled={disabled}>{triggerLabel}</Button></DialogTrigger>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl" showCloseButton={!pending}>
      <DialogHeader><DialogTitle>Bewertung für {name}</DialogTitle><DialogDescription>Prüfe die Angaben vor dem Abruf. Der geschätzte Kaufpreis wird als aktueller Marktwert übernommen. Frühere Bewertungsberichte bleiben erhalten.</DialogDescription></DialogHeader>
      {missingLabels.length>0 && <p className="rounded-lg bg-amber-50 p-3 text-amber-900">Noch ergänzen: {missingLabels.join(", ")}.</p>}
      {optionalMissing.length>0 && <p className="text-sm text-muted-foreground">Noch nicht hinterlegt: {optionalMissing.join(", ")}. Ergänze bekannte Angaben unten. Sie verbessern die Einordnung, garantieren aber keine ausreichenden Vergleichsdaten.</p>}
      <form className="space-y-4" onSubmit={event=>{
        event.preventDefault(); const data = new FormData(event.currentTarget);
        const input = {...Object.fromEntries(data),rented: data.get("rented")==="" ? undefined : data.get("rented")==="true",features:Object.fromEntries(Object.keys(featureLabels).map(key=>[key,data.get(key)==="on"]))};
        setErrors({});setMessage("");startTransition(async()=>{
          try { const result = await requestValuationAction(propertyId,input);
            if(result.reportId){setOpen(false);router.push(`/app/markt/${result.reportId}`);router.refresh();}
            else {setMessage(result.error ?? "Bewertung fehlgeschlagen.");setErrors(result.errors ?? {});router.refresh();}
          } catch {setMessage("Die Anfrage konnte nicht bestätigt werden. Bitte die Seite aktualisieren und den Bewertungsstatus prüfen.");}
        });
      }}>
        <fieldset disabled={pending} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2 sm:col-span-2"><Label htmlFor={`${id}-comparison_scope`}>Vergleichsobjekte</Label><select id={`${id}-comparison_scope`} name="comparison_scope" value={comparisonScope} onChange={e=>setComparisonScope(e.target.value as typeof comparisonScope)} aria-describedby={`${id}-comparison-help`} className="h-10 w-full rounded-md border bg-background px-3"><option value="broader">Breiterer Vergleich (empfohlen)</option><option value="detailed">Enger Vergleich mit genauer Objektart und Ausstattung</option></select><p id={`${id}-comparison-help`} className="text-sm text-muted-foreground">{comparisonScope==="broader" ? "Haus/Wohnung, Adresse, Wohnfläche, Zimmer, Baujahr und Vermietungsstatus bleiben berücksichtigt. Die genaue Objektart und Ausstattung werden gespeichert, grenzen die Vergleichsobjekte bei diesem Abruf aber nicht ein. Die Vergleichbarkeit kann geringer sein." : "Objektart und vorhandene Ausstattung können die Auswahl stark eingrenzen. Bei zu wenigen Vergleichsobjekten kannst du bewusst einen breiteren Vergleich wählen."}</p></div>
          <div className="space-y-1"><Label htmlFor={`${id}-typ`}>Haus oder Wohnung *</Label><select id={`${id}-typ`} name="typ" required value={typ} onChange={e=>setTyp(e.target.value as typeof typ)} className="h-10 w-full rounded-md border bg-background px-3"><option value="">Bitte wählen</option><option value="wohnung">Wohnung</option><option value="haus">Haus</option></select></div>
          <div className="space-y-1"><Label htmlFor={`${id}-property_type`}>Genaue Objektart</Label><select key={typ} id={`${id}-property_type`} name="property_type" defaultValue={defaults.typ===typ ? defaults.property_type ?? "" : ""} className="h-10 w-full rounded-md border bg-background px-3"><option value="">Keine weitere Eingrenzung</option>{propertyTypes.filter(([, ,t])=>t===typ).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
          {([ ["street","Straße und Hausnummer","text",true], ["postcode","Postleitzahl","text",true], ["city","Ort","text",true], ["square_meters","Wohnfläche in m²","number",true], ["rooms","Zimmer","number",false], ["year_of_construction","Baujahr","number",false] ] as const).map(([field,label,type,required])=><div key={field} className="space-y-1"><Label htmlFor={`${id}-${field}`}>{label}{required ? " *" : ""}</Label><Input id={`${id}-${field}`} name={field} type={type} required={required} step={type==="number" ? field==="year_of_construction" ? "1" : "0.01" : undefined} min={type==="number" ? "1" : undefined} defaultValue={defaults[field] ?? ""} aria-invalid={Boolean(errors[field])}/>{errors[field] && <p className="text-sm text-destructive">{errors[field][0]}</p>}</div>)}
          <div className="space-y-1"><Label htmlFor={`${id}-rented`}>Vermietung</Label><select id={`${id}-rented`} name="rented" defaultValue={defaults.rented==null ? "" : String(defaults.rented)} className="h-10 w-full rounded-md border bg-background px-3"><option value="">Unbekannt / gemischt</option><option value="true">Vermietet</option><option value="false">Bezugsfrei</option></select></div>
          <div className="space-y-2 sm:col-span-2"><p className="font-medium">Vorhandene Ausstattung</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{Object.entries(featureLabels).map(([key,label])=><label key={key} className="flex items-center gap-2"><input type="checkbox" name={key} defaultChecked={defaults.features?.[key as keyof typeof featureLabels]}/>{label}</label>)}</div></div>
        </fieldset>
        <p className="text-xs text-muted-foreground">Die Objektdaten werden für diese Bewertung an Somantic übermittelt und für die nächste Bewertung gespeichert. Nur deutsche Wohnimmobilien werden unterstützt.</p>
        {message && <p role="alert" className="rounded-md bg-destructive/10 p-3 text-destructive">{message}</p>}
        <Button type="submit" disabled={pending} className="w-full">{pending ? "Bewertung wird abgerufen …" : "Bewertung jetzt abrufen"}</Button>
      </form>
    </DialogContent>
  </Dialog>;
}
