"use client";

import { Building2, House, Landmark, ChevronDown, Info } from "lucide-react";
import type { InvestmentTaxInput } from "@/lib/domain/investment-tax";
import { cn } from "@/lib/utils";

function NumberField({ label, value, onChange, suffix = "€", hint, min = 0, max, step = "any" }: {
  label: string; value: number; onChange: (value: number) => void; suffix?: string;
  hint?: string; min?: number; max?: number; step?: string;
}) {
  return <label className="block space-y-2">
    <span className="text-xs font-medium text-foreground/80">{label}</span>
    <span className="relative block">
      <input type="number" min={min} max={max} step={step} value={Number.isFinite(value) ? value : ""}
        onChange={(event) => onChange(event.target.value === "" ? NaN : Number(event.target.value))}
        className="h-11 w-full rounded-xl border border-input bg-background/40 px-3 pr-10 text-sm tabular-nums outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/10" />
      <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-muted-foreground">{suffix}</span>
    </span>
    {hint ? <span className="block text-[11px] leading-relaxed text-muted-foreground">{hint}</span> : null}
  </label>;
}

function DateField({ label, value, onChange, hint }: { label: string; value?: string; onChange: (value: string) => void; hint?: string }) {
  return <label className="block space-y-2">
    <span className="text-xs font-medium text-foreground/80">{label}</span>
    <input type="date" value={value ?? ""} onChange={(event) => onChange(event.target.value)}
      className="h-11 w-full min-w-0 rounded-xl border bg-background/40 px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
    {hint ? <span className="block text-[11px] leading-relaxed text-muted-foreground">{hint}</span> : null}
  </label>;
}

function Confirmation({ label, checked, onChange }: { label: string; checked?: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex cursor-pointer items-start gap-3 rounded-xl border bg-background/40 p-3 text-xs leading-relaxed">
    <input type="checkbox" checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 size-4 shrink-0 accent-primary" />
    <span>{label}</span>
  </label>;
}

function FormSection({ number, title, children, open = false }: { number: string; title: string; children: React.ReactNode; open?: boolean }) {
  return <details open={open} className="group border-t first:border-t-0">
    <summary className="flex cursor-pointer list-none items-center gap-3 py-5 text-sm font-semibold [&::-webkit-details-marker]:hidden">
      <span className="flex size-6 items-center justify-center rounded-full bg-secondary font-mono text-[10px] text-primary">{number}</span>
      {title}<ChevronDown className="ml-auto size-4 text-muted-foreground transition group-open:rotate-180" />
    </summary>
    <div className="space-y-4 pb-6">{children}</div>
  </details>;
}

export function InvestmentFields({ input, onChange }: { input: InvestmentTaxInput; onChange: (patch: Partial<InvestmentTaxInput>) => void }) {
  const money = (key: "purchasePriceCents" | "acquisitionCostsCents" | "capitalizedMeasuresCents" | "certifiedHeritageCostsCents", value: number) => onChange({ [key]: Math.round(value * 100) });
  return <div>
    <FormSection number="01" title="Deine Immobilie" open>
      <div className="grid grid-cols-3 gap-2" aria-label="Immobilienart">
        {([{ value: "existing", label: "Bestand", icon: House }, { value: "new_build", label: "Neubau", icon: Building2 }, { value: "heritage", label: "Denkmal", icon: Landmark }] as const).map(({ value, label, icon: Icon }) =>
          <button key={value} type="button" aria-pressed={input.propertyKind === value} onClick={() => { if (input.propertyKind !== value) onChange({ propertyKind: value, certifiedHeritageCostsCents: 0, heritageCompletionDate: undefined, heritageEligibilityConfirmed: false, special7bEnabled: false, special7bEligibilityConfirmed: false, degressiveEligibilityConfirmed: false, contractDate: undefined, buildingApplicationDate: undefined }); }}
            className={cn("flex flex-col items-center gap-2 rounded-xl border px-2 py-3 text-xs transition", input.propertyKind === value ? "border-primary bg-primary/5 font-semibold text-primary ring-1 ring-primary" : "bg-card text-muted-foreground hover:border-primary/40")}>
            <Icon className="size-5" />{label}
          </button>)}
      </div>
      <fieldset>
        <legend className="mb-2 text-xs font-medium">Nutzung</legend>
        <div className="flex rounded-xl bg-secondary/60 p-1">
          {([{ value: "rented", label: "Vermietet" }, { value: "owner_occupied", label: "Selbst genutzt" }] as const).map(({ value, label }) =>
            <button key={value} type="button" aria-pressed={input.usage === value} onClick={() => { if (input.usage !== value) onChange({ usage: value, heritageEligibilityConfirmed: false }); }}
              className={cn("flex-1 rounded-lg px-2 py-2 text-xs transition", input.usage === value ? "bg-white font-semibold shadow-sm" : "text-muted-foreground")}>{label}</button>)}
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <DateField label="Fertigstellung Gebäude" value={input.completionDate} onChange={(completionDate) => onChange({ completionDate })} />
        <DateField label="Anschaffung / Übergang" value={input.acquisitionDate} onChange={(acquisitionDate) => onChange({ acquisitionDate })} hint="Übergang von Nutzen und Lasten." />
      </div>
    </FormSection>
    <FormSection number="02" title="Kaufpreis & Aufteilung" open>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Kaufpreis gesamt" value={input.purchasePriceCents / 100} onChange={(value) => money("purchasePriceCents", value)} />
        <NumberField label="Kaufnebenkosten" value={input.acquisitionCostsCents / 100} onChange={(value) => money("acquisitionCostsCents", value)} />
      </div>
      <NumberField label="Grundstücksanteil am Kaufpreis" suffix="%" value={Math.round(input.landShareRate * 10000) / 100} max={100} onChange={(value) => onChange({ landShareRate: value / 100 })}
        hint="Grund und Boden ist nicht abschreibbar. Die Kaufnebenkosten werden im gleichen Verhältnis aufgeteilt." />
      <NumberField label="Zusätzliche aktivierungspflichtige Maßnahmen" value={input.capitalizedMeasuresCents / 100} onChange={(value) => money("capitalizedMeasuresCents", value)}
        hint="Nur zusätzliche Gebäudekosten, die noch nicht im Kaufpreis enthalten sind. Im Modell zum AfA-Beginn verfügbar." />
    </FormSection>
    {input.propertyKind === "new_build" && input.usage === "rented" ? <FormSection number="03" title="Neubau & Förderbedingungen" open>
      <DateField label="Notarieller Kaufvertrag" value={input.contractDate} onChange={(contractDate) => onChange({ contractDate })} hint="Für die degressive AfA muss der Vertrag nach dem 30.09.2023 und vor dem 01.10.2029 liegen." />
      <Confirmation label="Wohngebäude in EU/EWR; Erwerb bis zum Ende des Fertigstellungsjahres. Die Voraussetzungen für § 7 Abs. 5a sind geprüft." checked={input.degressiveEligibilityConfirmed} onChange={(degressiveEligibilityConfirmed) => onChange({ degressiveEligibilityConfirmed })} />
      <Confirmation label="Automatisch zur linearen AfA wechseln, sobald der jährliche Abzug höher ist." checked={input.autoSwitchToLinear} onChange={(autoSwitchToLinear) => onChange({ autoSwitchToLinear })} />
      <Confirmation label="Sonderabschreibung nach § 7b EStG berücksichtigen" checked={input.special7bEnabled} onChange={(special7bEnabled) => onChange({ special7bEnabled })} />
      {input.special7bEnabled ? <div className="space-y-3 rounded-xl bg-secondary/40 p-3">
        <DateField label="Bauantrag / Bauanzeige" value={input.buildingApplicationDate} onChange={(buildingApplicationDate) => onChange({ buildingApplicationDate })} />
        <NumberField label="Begünstigte Wohnfläche" suffix="m²" value={input.livingAreaSquareMeters ?? 0} onChange={(livingAreaSquareMeters) => onChange({ livingAreaSquareMeters })} />
        <Confirmation label="Effizienzhaus 40 mit Nachhaltigkeits-Klasse und Qualitätssiegel Nachhaltiges Gebäude (QNG) nachgewiesen." checked={input.qngCertified} onChange={(qngCertified) => onChange({ qngCertified })} />
        <Confirmation label="Entgeltliche Wohnraumvermietung im Anschaffungsjahr und den neun Folgejahren sichergestellt; keine vorübergehende Beherbergung." checked={input.tenYearRentalConfirmed} onChange={(tenYearRentalConfirmed) => onChange({ tenYearRentalConfirmed })} />
        <Confirmation label="Neue Wohnung, förderfähige Kosten und weitere Voraussetzungen des § 7b (ggf. Beihilferecht) wurden geprüft." checked={input.special7bEligibilityConfirmed} onChange={(special7bEligibilityConfirmed) => onChange({ special7bEligibilityConfirmed })} />
        <p className="text-[11px] leading-relaxed text-muted-foreground">Für Bauanträge 2023–September 2029: höchstens 5.200 €/m² Kosten, Förderbasis höchstens 4.000 €/m². Die App prüft die Datums- und Kostengrenzen.</p>
      </div> : null}
    </FormSection> : null}
    {input.propertyKind === "heritage" ? <FormSection number="03" title="Bescheinigte Denkmalkosten" open>
      <NumberField label="Begünstigte Denkmalkosten" value={(input.certifiedHeritageCostsCents ?? 0) / 100} onChange={(value) => money("certifiedHeritageCostsCents", value)}
        hint="Teil der gesamten Gebäudebasis, kein zusätzlicher Betrag. Bereits enthaltene Sanierungskosten abzüglich Zuschüssen." />
      <DateField label="Abschluss der Denkmalmaßnahmen" value={input.heritageCompletionDate} onChange={(heritageCompletionDate) => onChange({ heritageCompletionDate })} />
      <Confirmation label={input.usage === "rented" ? "Behördliche Bescheinigung liegt vor; Maßnahmen waren abgestimmt und sind nach § 7i begünstigt (bei Erwerb: nach Kaufvertrag durchgeführt)." : "Bescheinigung und Abstimmung liegen vor; Voraussetzungen des § 10f einschließlich Eigennutzung, Objektbegrenzung und Ausschluss einer Doppelförderung sind erfüllt."}
        checked={input.heritageEligibilityConfirmed} onChange={(heritageEligibilityConfirmed) => onChange({ heritageEligibilityConfirmed })} />
      <div className="flex gap-2 text-[11px] leading-relaxed text-muted-foreground"><Info className="mt-0.5 size-4 shrink-0" /><p>{input.usage === "rented" ? "Nur die begünstigten Maßnahmen: 8 Jahre × 9 %, danach 4 Jahre × 7 %. Die restliche Gebäudebasis wird regulär abgeschrieben." : "10 Jahre × 9 % der begünstigten Kosten als Sonderausgaben. Keine normale Gebäude-AfA bei Eigennutzung."}</p></div>
    </FormSection> : null}
    <FormSection number="04" title="Persönliche Annahmen" open>
      <div className="grid grid-cols-2 gap-3">
        <NumberField label="Grenzsteuersatz" suffix="%" value={Math.round(input.marginalTaxRate * 10000) / 100} max={60} onChange={(value) => onChange({ marginalTaxRate: value / 100 })} />
        <NumberField label="Betrachtungszeitraum" suffix="Jahre" value={input.years} min={1} max={60} step="1" onChange={(years) => onChange({ years })} />
      </div>
      <p className="text-[11px] leading-relaxed text-muted-foreground">Steuerentlastung = Abzug × konstanter Grenzsteuersatz. Volle steuerliche Nutzbarkeit wird angenommen. Ohne Solidaritätszuschlag und Kirchensteuer.</p>
    </FormSection>
  </div>;
}
