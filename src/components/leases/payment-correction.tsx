"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { correctRentPaymentAction } from "@/app/app/mietverhaeltnisse/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";

export function PaymentCorrection({payment}:{payment:{id:string;paid_on:string;amount_cents:number}}){
  const [open,setOpen]=useState(false);const [error,setError]=useState("");const [pending,start]=useTransition();const [deleting,setDeleting]=useState(false);const router=useRouter();
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button size="sm" variant="outline">Zahlung bearbeiten</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Zahlungseingang korrigieren</DialogTitle><DialogDescription>Änderungen gelten für diesen Monat. Gelöschte Zahlungen werden nicht erneut automatisch angelegt.</DialogDescription></DialogHeader><form className="space-y-3" onSubmit={e=>{e.preventDefault();const data=new FormData(e.currentTarget);start(async()=>{const result=await correctRentPaymentAction(data);if(result.error)setError(result.error);else{setOpen(false);router.refresh();}});}}>
    <input type="hidden" name="rentClaimId" value={payment.id}/><input type="hidden" name="delete" value={String(deleting)}/>
    <Label htmlFor={`paid-${payment.id}`}>Eingangsdatum</Label><Input id={`paid-${payment.id}`} type="date" name="paidOn" required defaultValue={payment.paid_on}/>
    <Label htmlFor={`amount-${payment.id}`}>Betrag in €</Label><Input id={`amount-${payment.id}`} name="amount" required defaultValue={(payment.amount_cents/100).toFixed(2)}/>
    {deleting && <p>Diese Zahlung wirklich löschen? Der Monat wird wieder als offen geführt.</p>}
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <div className="flex gap-2"><Button disabled={pending} type="submit" variant={deleting ? "destructive" : "default"}>{deleting ? "Löschen bestätigen" : "Speichern"}</Button><Button type="button" variant="outline" disabled={pending} onClick={()=>setDeleting(!deleting)}>{deleting ? "Abbrechen" : "Zahlung löschen"}</Button></div>
  </form></DialogContent></Dialog>;
}
