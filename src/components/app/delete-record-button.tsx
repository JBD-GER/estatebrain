"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteModuleRecordAction } from "@/app/app/[module]/actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function DeleteRecordButton({ module, id, updatedAt, name, afterDeleteHref, valuationReport = false }: {
  module: string; id: string; updatedAt?: string; name: string; afterDeleteHref?: string; valuationReport?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button size="sm" variant="ghost" aria-label={`${name} löschen`}><Trash2 />Löschen</Button></DialogTrigger>
    <DialogContent>
      <DialogHeader><DialogTitle>{name} löschen?</DialogTitle><DialogDescription>
        {module === "markt" ? "Die Bewertung und ein zugehöriger Somantic-Bericht werden gelöscht. Wird der aktuelle Marktwert gelöscht, zählt wieder die vorherige Bewertung. Ohne weitere Bewertung wird kein Marktwert angezeigt." : "Der Eintrag wird aus den aktiven Listen und Auswertungen entfernt. Bei einem Beleg wird auch die zugehörige Ausgabe entfernt. Verknüpfte Nachweise bleiben aufbewahrt."}
      </DialogDescription></DialogHeader>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>Abbrechen</Button>
        <Button variant="destructive" disabled={pending} onClick={() => startTransition(async () => {
          const result = await deleteModuleRecordAction({ module, id, updatedAt, valuationReport });
          if (result.status === "error") { setError(result.message ?? "Löschen fehlgeschlagen."); return; }
          toast.success(result.message); setOpen(false); if(afterDeleteHref) router.push(afterDeleteHref); router.refresh();
        })}>{pending ? "Wird gelöscht …" : "Löschen bestätigen"}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
