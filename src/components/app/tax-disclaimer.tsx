import { Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export function TaxDisclaimer({ compact = false }: { compact?: boolean }) {
  return (
    <Alert className="border-amber-200 bg-amber-50 text-amber-950">
      <Info className="text-amber-700" />
      {compact ? null : <AlertTitle>Unverbindliche Modellrechnung</AlertTitle>}
      <AlertDescription>
        Estate Brain dient ausschließlich der finanziellen Übersicht und
        Vorbereitung von Unterlagen. Steuerliche Berechnungen sind
        unverbindliche Schätzungen und ersetzen keine Beratung durch einen
        Steuerberater.
      </AlertDescription>
    </Alert>
  );
}
