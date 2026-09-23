"use client";
import { useId } from "react";
import { Label } from "@/components/ui/label";
export type RenovationOption={id:string;propertyId:string;name:string};
export function RenovationSelect({propertyId,renovations,defaultValue}:{propertyId:string;renovations:RenovationOption[];defaultValue?:string|null}){
  const id=useId();const options=renovations.filter(r=>r.propertyId===propertyId);
  if(!options.length)return <input type="hidden" name="renovationProjectId" value=""/>;
  return <div className="space-y-2"><Label htmlFor={id}>Sanierung zuordnen</Label><select key={propertyId} id={id} name="renovationProjectId" defaultValue={options.some(r=>r.id===defaultValue) ? defaultValue! : ""} className="h-10 w-full rounded-md border bg-background px-3"><option value="">Allgemeiner Beleg ohne Sanierung</option>{options.map(r=><option value={r.id} key={r.id}>{r.name}</option>)}</select><p className="text-xs text-muted-foreground">Der Beleg erscheint auch bei dieser Sanierung. Ihre Gesamtkosten zählen im Abschlussmonat zum Cashflow.</p></div>;
}
