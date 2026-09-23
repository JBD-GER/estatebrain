"use client";
import { useState,useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateDocumentMetadataAction } from "@/app/app/belege/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogTrigger } from "@/components/ui/dialog";
import { RenovationSelect,type RenovationOption } from "./renovation-select";
export function DocumentMetadataForm({document,renovations}:{document:{id:string;title:string|null;document_date:string|null;property_id:string|null;renovation_project_id:string|null;updated_at:string};renovations:RenovationOption[]}){
  const [open,setOpen]=useState(false);const [error,setError]=useState("");const [pending,start]=useTransition();const router=useRouter();
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="sm" variant="outline">Dokument bearbeiten</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Dokumentdaten bearbeiten</DialogTitle><DialogDescription>Titel, Dokumentdatum und Sanierungszuordnung ändern. Rechnungsbeträge können in der Belegprüfung korrigiert werden.</DialogDescription></DialogHeader><form className="space-y-3" onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);start(async()=>{const result=await updateDocumentMetadataAction(data);if(result.error)setError(result.error);else{setOpen(false);router.refresh();}});}}>
    <input type="hidden" name="id" value={document.id}/><input type="hidden" name="updatedAt" value={document.updated_at}/>
    <Label htmlFor={`meta-title-${document.id}`}>Titel</Label><Input id={`meta-title-${document.id}`} name="title" maxLength={160} defaultValue={document.title ?? ""}/>
    <Label htmlFor={`meta-date-${document.id}`}>Dokumentdatum</Label><Input id={`meta-date-${document.id}`} name="documentDate" type="date" defaultValue={document.document_date ?? ""}/>
    <RenovationSelect propertyId={document.property_id ?? ""} renovations={renovations} defaultValue={document.renovation_project_id}/>
    {error && <p role="alert" className="text-destructive">{error}</p>}<Button type="submit" disabled={pending}>Änderungen speichern</Button>
  </form></DialogContent></Dialog>;
}
