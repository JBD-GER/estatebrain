"use client";

import { useEffect } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function WorkspaceError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Estate Brain workspace error", error.digest ?? error.name);
  }, [error]);

  return (
    <Card className="mx-auto mt-16 max-w-lg">
      <CardContent className="flex flex-col items-center px-8 py-12 text-center">
        <div className="grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="size-6" />
        </div>
        <h1 className="mt-5 text-xl font-semibold">
          Dieser Bereich konnte nicht geladen werden
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Deine Daten wurden nicht verändert. Versuche es erneut oder wechsle
          kurz zu einem anderen Bereich.
        </p>
        <Button className="mt-6" onClick={reset}>
          <RotateCcw />
          Erneut versuchen
        </Button>
      </CardContent>
    </Card>
  );
}
