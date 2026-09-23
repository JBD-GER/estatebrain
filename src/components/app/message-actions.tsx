"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { editOwnMessageAction } from "@/app/app/kommunikation/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";

export function MessageActions({ message }: { message: { id: string; updated_at: string; body: string } }) {
  const [open, setOpen] = useState(false);
  const [remove, setRemove] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const router = useRouter();
  return <Dialog open={open} onOpenChange={(value) => { if (!pending) { setOpen(value); setRemove(false); setError(""); } }}>
    <DialogTrigger asChild><Button variant="ghost" size="sm">Nachricht bearbeiten / löschen</Button></DialogTrigger>
    <DialogContent><DialogHeader><DialogTitle>{remove ? "Nachricht löschen?" : "Eigene Nachricht bearbeiten"}</DialogTitle><DialogDescription>{remove ? "Die Nachricht wird aus dem Verlauf entfernt." : "Änderungen sind auch für die bisherigen Empfänger sichtbar."}</DialogDescription></DialogHeader>
      <form className="space-y-3" onSubmit={(event) => { event.preventDefault(); const data = new FormData(event.currentTarget); start(async () => {
        try {
          const result = await editOwnMessageAction({ id: message.id, updatedAt: message.updated_at, body: String(data.get("body") ?? message.body), remove });
          if (result.error) setError(result.error); else { setOpen(false); router.refresh(); }
        } catch { setError("Speichern fehlgeschlagen. Bitte erneut versuchen."); }
      }); }}>
        {!remove && <Textarea name="body" aria-label="Nachricht" defaultValue={message.body} required maxLength={20_000} rows={6} />}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" disabled={pending} onClick={() => remove ? setRemove(false) : setRemove(true)}>{remove ? "Zurück" : "Löschen …"}</Button><Button type="submit" variant={remove ? "destructive" : "default"} disabled={pending}>{remove ? "Löschen bestätigen" : "Änderungen speichern"}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
