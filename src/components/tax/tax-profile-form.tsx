"use client";

import { useState } from "react";
import { Calculator, Save } from "lucide-react";
import { saveTaxProfileAction } from "@/app/app/steuern/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function TaxProfileForm({
  initialMode,
  effectiveRatePercent,
  otherTaxableIncomeEuros,
  filingStatus,
  rentalInputsConfirmed,
}: {
  initialMode: "automatic" | "manual";
  effectiveRatePercent: number | null;
  otherTaxableIncomeEuros: number | null;
  filingStatus: "single" | "joint";
  rentalInputsConfirmed: boolean;
}) {
  const [mode, setMode] = useState(initialMode);

  return (
    <form action={saveTaxProfileAction} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="flex cursor-pointer gap-3 rounded-xl border p-4">
          <input
            type="radio"
            name="calculationMode"
            value="automatic"
            checked={mode === "automatic"}
            onChange={() => setMode("automatic")}
          />
          <span>
            <span className="block font-medium">Automatisch</span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Tarif 2026 aus weiteren Einkünften und Vermietungsergebnis.
            </span>
          </span>
        </label>
        <label className="flex cursor-pointer gap-3 rounded-xl border p-4">
          <input
            type="radio"
            name="calculationMode"
            value="manual"
            checked={mode === "manual"}
            onChange={() => setMode("manual")}
          />
          <span>
            <span className="block font-medium">Manuell</span>
            <span className="mt-1 block text-sm text-muted-foreground">
              Ausschließlich den effektiven Steuersatz hinterlegen.
            </span>
          </span>
        </label>
      </div>

      {mode === "automatic" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="otherTaxableIncome">
              Weitere steuerpflichtige Einkünfte (p. a.)
            </Label>
            <div className="relative">
              <Input
                id="otherTaxableIncome"
                name="otherTaxableIncome"
                type="number"
                min="0"
                step="0.01"
                defaultValue={otherTaxableIncomeEuros ?? ""}
                required
                className="pr-9"
              />
              <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
                €
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filingStatus">Veranlagung</Label>
            <Select name="filingStatus" defaultValue={filingStatus}>
              <SelectTrigger id="filingStatus">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="single">Einzelveranlagung</SelectItem>
                <SelectItem value="joint">
                  Zusammenveranlagung (Splitting)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <label className="flex items-start gap-3 rounded-xl border p-4 text-sm sm:col-span-2">
            <Checkbox
              name="rentalIncomeComplete"
              defaultChecked={rentalInputsConfirmed}
              className="mt-0.5"
            />
            <span>
              <span className="font-medium">
                Alle aktuellen Vertragsmieten sind erfasst.
              </span>
              <span className="mt-1 block text-muted-foreground">
                Erst mit dieser Bestätigung berechnet Estate Brain den
                persönlichen Effektiv- und Grenzsteuersatz neu.
              </span>
            </span>
          </label>
        </div>
      ) : (
        <div className="max-w-sm space-y-2">
          <Label htmlFor="manualEffectiveTaxRate">Effektiver Steuersatz</Label>
          <div className="relative">
            <Input
              id="manualEffectiveTaxRate"
              name="manualEffectiveTaxRate"
              type="number"
              min="0"
              max="100"
              step="0.01"
              defaultValue={effectiveRatePercent ?? ""}
              required
              className="pr-9"
            />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-muted-foreground">
              %
            </span>
          </div>
          <input type="hidden" name="filingStatus" value={filingStatus} />
          <p className="text-xs text-muted-foreground">
            Ein manueller Grenzsteuersatz wird nicht abgefragt.
          </p>
        </div>
      )}

      <Button type="submit">
        {mode === "automatic" ? <Calculator /> : <Save />}
        {mode === "automatic" ? "Neu berechnen" : "Steuersatz speichern"}
      </Button>
    </form>
  );
}
