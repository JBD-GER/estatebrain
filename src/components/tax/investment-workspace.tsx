"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import dynamic from "next/dynamic";
import { ArrowDownToLine, ArrowRight, ArrowUpRight, BookmarkCheck, Calculator, Check, ChevronDown, Copy, FolderOpen, Info, Landmark, LoaderCircle, Plus, Save, ShieldCheck, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { InvestmentFields } from "@/components/tax/investment-fields";
import { Button } from "@/components/ui/button";
import { calculateInvestmentTax, DEFAULT_INVESTMENT_TAX_INPUT, INVESTMENT_TAX_SOURCES, validateInvestmentTaxInput, type InvestmentTaxInput } from "@/lib/domain/investment-tax";
import { investmentComparisonCsv } from "@/lib/tax/investment-export";
import { type InvestmentScenario } from "@/lib/tax/scenario-schema";
import type { InvestmentPropertyOption } from "@/lib/tax/portfolio-input";
import { saveInvestmentScenarioAction, deleteInvestmentScenarioAction } from "@/app/app/steuervergleich/actions";
import { cn } from "@/lib/utils";

const InvestmentChart = dynamic(() => import("./investment-chart").then((module) => module.InvestmentChart), { ssr: false, loading: () => <div className="h-72 animate-pulse rounded-xl bg-muted/40" aria-label="Diagramm wird geladen" /> });
const COLORS = ["#23634f", "#b17b38", "#668bb0"];
const subscribeHydration = () => () => {};
const euros = (cents: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);
const preciseEuros = (cents: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(cents / 100);
const rate = (value: number) => new Intl.NumberFormat("de-DE", { style: "percent", maximumFractionDigits: 2 }).format(value);

type Draft = { key: string; name: string; input: InvestmentTaxInput; selectedMethod?: string; remoteId?: string; sourceAssumptions?: string[] };
function evaluate(draft: Draft) {
  const issues = validateInvestmentTaxInput(draft.input);
  if (issues.length) return { draft, issues, calculation: null, result: null };
  try {
    const calculation = calculateInvestmentTax(draft.input);
    const result = calculation.scenarios.find((item) => item.id === draft.selectedMethod) ?? calculation.scenarios.find((item) => item.id === calculation.recommendedScenarioId) ?? calculation.scenarios[0];
    return { draft, issues, calculation, result };
  } catch {
    return { draft, issues: [{ field: "input", message: "Bitte prüfe die Eingaben für diese Berechnung." }], calculation: null, result: null };
  }
}

export function InvestmentWorkspace({ initialScenarios = [], storageError, portfolioProperties = [], portfolioError, skippedProperties = 0 }: {
  initialScenarios?: InvestmentScenario[]; storageError?: string;
  portfolioProperties?: InvestmentPropertyOption[]; portfolioError?: string; skippedProperties?: number;
}) {
  const [drafts, setDrafts] = useState<Draft[]>([{ key: "initial", name: "Beispielimmobilie", input: { ...DEFAULT_INVESTMENT_TAX_INPUT } }]);
  const [activeKey, setActiveKey] = useState("initial");
  const [tab, setTab] = useState<"overview" | "schedule" | "basis">("overview");
  const [saved, setSaved] = useState(initialScenarios);
  const [showSaved, setShowSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const hydrated = useSyncExternalStore(subscribeHydration, () => true, () => false);
  const all = useMemo(() => drafts.map(evaluate), [drafts]);
  const activeIndex = Math.max(0, drafts.findIndex((draft) => draft.key === activeKey));
  const current = all[activeIndex];
  const { draft, calculation, result } = current;
  const availableSaved = saved;
  const valid = all.filter((item) => item.result !== null);

  function update(patch: Partial<Draft>) { setDrafts((items) => items.map((item) => item.key === activeKey ? { ...item, ...patch } : item)); }
  function updateInput(patch: Partial<InvestmentTaxInput>) { update({ input: { ...draft.input, ...patch } }); }
  function addScenario() {
    if (drafts.length >= 3) return;
    const key = crypto.randomUUID();
    setDrafts((items) => [...items, { key, name: `Vergleich ${items.length + 1}`, input: { ...draft.input }, selectedMethod: draft.selectedMethod }]);
    setActiveKey(key);
    toast.info("Szenario kopiert. Passe jetzt Kaufpreis, Gebäudeart oder Steuermodell an.");
  }
  function removeScenario(key: string) {
    if (drafts.length <= 1) return;
    const remaining = drafts.filter((item) => item.key !== key);
    setDrafts(remaining);
    if (activeKey === key) setActiveKey(remaining[0].key);
  }
  function importProperty(id: string) {
    const property = portfolioProperties.find((item) => item.id === id);
    if (!property || drafts.length >= 3) return;
    const key = crypto.randomUUID();
    setDrafts((items) => [...items, { key, name: property.name, input: { ...property.input }, sourceAssumptions: property.assumptions }]);
    setActiveKey(key);
    toast.success("Immobiliendaten als neues Vergleichsszenario übernommen. Bitte die Modellannahmen prüfen.");
  }
  function loadScenario(item: InvestmentScenario) {
    if (drafts.length >= 3) { toast.info("Entferne zuerst ein Szenario aus dem Vergleich (maximal drei)."); return; }
    const key = crypto.randomUUID();
    setDrafts((items) => [...items, { key, name: item.name, input: { ...item.input }, selectedMethod: item.selectedMethod ?? undefined, remoteId: item.id }]);
    setActiveKey(key);
    setShowSaved(false);
    toast.success("Gespeichertes Szenario zum Vergleich hinzugefügt.");
  }
  function saveScenario() {
    if (!result || !draft.name.trim()) { toast.error("Bitte ergänze einen Namen und gültige Eingaben."); return; }
    startTransition(async () => {
      try {
        const response = await saveInvestmentScenarioAction({ id: draft.remoteId, name: draft.name, input: draft.input, selectedMethod: result.id });
        if (!response.success) { toast.error(response.error); return; }
        setSaved((items) => [response.scenario, ...items.filter((item) => item.id !== response.scenario.id)]);
        setDrafts((items) => items.map((item) => item.key === draft.key ? { ...item, remoteId: response.scenario.id } : item));
        toast.success("Szenario in deiner Organisation gespeichert.");
      } catch { toast.error("Speichern nicht möglich. Bitte versuche es erneut."); }
    });
  }

  function deleteSaved(id: string) {
    startTransition(async () => {
      try {
        const response = await deleteInvestmentScenarioAction(id);
        if (!response.success) { toast.error(response.error); return; }
        setSaved((items) => items.filter((item) => item.id !== id));
        setDrafts((items) => items.map((item) => item.remoteId === id ? { ...item, remoteId: undefined } : item));
        toast.success("Gespeichertes Szenario gelöscht.");
      } catch { toast.error("Löschen nicht möglich. Bitte versuche es erneut."); }
    });

  }
  function exportCsv() {
    const items = valid.flatMap((item) => item.result ? [{ name: item.draft.name, input: item.draft.input, result: item.result }] : []);
    if (!items.length) return;
    const url = URL.createObjectURL(new Blob([investmentComparisonCsv(items)], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "estatebrain-steuervergleich.csv"; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <div className="mx-auto max-w-[1440px] space-y-7 pb-10" data-testid="investment-workspace" data-hydrated={hydrated}>
    <header className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
      <div>
        <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-primary"><span className="size-1.5 rounded-full bg-primary" />Deine Immobilien · Deine Steuerplanung</div>
        <h1 className="text-3xl font-semibold tracking-[-0.045em] sm:text-4xl">Dein Steuer-Dashboard.</h1>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">Bestand, Neubau oder Denkmal. Verstehe die Abschreibung und ihre geschätzte Steuerwirkung – Jahr für Jahr.</p>
      </div>
      <div className="flex shrink-0 flex-wrap gap-2">
        <Button variant="outline" className="rounded-xl bg-white text-xs" onClick={() => setShowSaved(!showSaved)} aria-expanded={showSaved}><FolderOpen className="size-4" />Gespeichert {availableSaved.length ? `(${availableSaved.length})` : ""}</Button>
        <Button variant="outline" className="rounded-xl bg-white text-xs" onClick={exportCsv} disabled={!valid.length}><ArrowDownToLine className="size-4" />CSV exportieren</Button>
      </div>
    </header>

    <section className="flex flex-col gap-3 rounded-2xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Immobiliendaten übernehmen">
      <div><h2 className="text-sm font-semibold">Mit deinen Immobilien rechnen</h2><p className="mt-1 text-xs text-muted-foreground">{portfolioProperties.length ? "Kaufdaten aus deinem Portfolio als neues Szenario übernehmen." : "Eigene Werte eingeben oder zunächst vollständige Kaufdaten bei deinen Immobilien hinterlegen."}</p>
        {portfolioError ? <p className="mt-1 text-xs text-amber-800">{portfolioError}</p> : null}
        {skippedProperties ? <p className="mt-1 text-[11px] text-muted-foreground">{skippedProperties} Objekt(e) benötigen ergänzte Angaben oder eine individuelle Eingabe, z. B. Neubauten ohne genaues Fertigstellungsdatum.</p> : null}
      </div>
      <label className="relative w-full shrink-0 sm:w-72"><span className="sr-only">Immobilie aus Portfolio übernehmen</span><select value="" disabled={!hydrated || !portfolioProperties.length || drafts.length >= 3} onChange={(event) => importProperty(event.target.value)} className="h-11 w-full appearance-none rounded-xl border bg-background py-2 pl-3 pr-9 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50"><option value="">{drafts.length >= 3 ? "Maximal 3 Szenarien im Vergleich" : "Immobilie auswählen …"}</option>{portfolioProperties.map((property) => <option key={property.id} value={property.id}>{property.name}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3.5 size-4" /></label>
    </section>

    {showSaved ? <section className="rounded-2xl border bg-card p-5" aria-label="Gespeicherte Szenarien">
      <div className="mb-4 flex items-center justify-between"><div><h2 className="font-semibold">Deine gespeicherten Szenarien</h2><p className="mt-1 text-xs text-muted-foreground">Gemeinsam in deiner Organisation verfügbar.</p></div><button aria-label="Gespeicherte Szenarien schließen" onClick={() => setShowSaved(false)}><X className="size-4" /></button></div>
      {storageError ? <p role="alert" className="mb-3 text-sm text-destructive">{storageError}</p> : null}
      {availableSaved.length === 0 ? <p className="py-4 text-sm text-muted-foreground">Noch kein Szenario gespeichert. Nutze „Szenario speichern“ unter deinen Eingaben.</p> : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{availableSaved.map((item) => <div key={item.id} className="flex items-center gap-2 rounded-xl border p-3"><BookmarkCheck className="size-4 shrink-0 text-primary" /><span className="min-w-0 flex-1 truncate text-sm">{item.name}</span><Button size="sm" variant="ghost" onClick={() => loadScenario(item)} disabled={drafts.length >= 3}>Laden</Button><Button size="icon-sm" variant="ghost" onClick={() => deleteSaved(item.id)} disabled={pending} aria-label={`${item.name} aus Speicher löschen`}><Trash2 className="size-3.5" /></Button></div>)}</div>}
    </section> : null}

    <div className="flex flex-wrap items-center gap-2" aria-label="Vergleichsszenarien">
      {drafts.map((item, index) => <div key={item.key} className={cn("flex max-w-full items-center rounded-xl border transition", item.key === activeKey ? "border-primary/30 bg-white shadow-sm" : "border-transparent bg-secondary/60")}>
        <button className="flex min-w-0 items-center gap-2.5 px-4 py-3 text-xs font-medium" onClick={() => setActiveKey(item.key)} aria-pressed={item.key === activeKey}><span className="size-2 rounded-full" style={{ background: COLORS[index] }} /><span className="max-w-48 truncate">{item.name || `Szenario ${index + 1}`}</span></button>
        {drafts.length > 1 ? <button className="mr-2 rounded-lg p-1.5 text-muted-foreground hover:bg-muted" aria-label={`${item.name} aus Vergleich entfernen`} onClick={() => removeScenario(item.key)}><X className="size-3.5" /></button> : null}
      </div>)}
      <button onClick={addScenario} disabled={drafts.length >= 3} className="flex items-center gap-2 rounded-xl border border-dashed px-4 py-3 text-xs text-muted-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-40"><Plus className="size-4" />Szenario vergleichen</button>
      <span className="ml-auto hidden text-[11px] text-muted-foreground lg:block">Bis zu 3 Immobilien oder Varianten vergleichen</span>
    </div>

    {result ? <a href="#comparison-results" className="flex items-center justify-between rounded-xl bg-secondary p-4 text-xs xl:hidden"><span><span className="block text-muted-foreground">Geschätzte Steuerentlastung · {draft.input.years} Jahre</span><strong className="mt-1 block text-xl tabular-nums">{euros(result.totalTaxSavingCents)}</strong></span><span className="flex items-center gap-1 font-medium text-primary">Zum Ergebnis<ChevronDown className="size-4" /></span></a> : null}

    <div className="grid items-start gap-6 xl:grid-cols-[350px_minmax(0,1fr)]">
      <aside className="min-w-0 rounded-2xl border bg-card px-5 shadow-[0_3px_18px_#173f3503]">
        <fieldset disabled={!hydrated} className="min-w-0">
        <div className="border-b py-5"><div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 text-sm font-semibold"><Calculator className="size-4 text-primary" />Deine Eingaben</h2><span className="rounded-full bg-secondary px-2 py-1 text-[10px] text-primary">Live-Berechnung</span></div>
          <label className="block"><span className="text-xs text-muted-foreground">Szenarioname</span><input aria-label="Szenarioname" maxLength={100} value={draft.name} onChange={(event) => update({ name: event.target.value })} className="mt-1.5 h-10 w-full rounded-lg border bg-background/40 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/15" /></label>
        </div>
        {draft.sourceAssumptions?.length ? <details className="rounded-xl bg-secondary/50 px-3 py-3 text-[11px]" open><summary className="cursor-pointer font-medium">Übernommene Daten prüfen</summary><ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">{draft.sourceAssumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul><p className="mt-2 text-muted-foreground">Änderungen hier betreffen nur das Vergleichsszenario. Die Stammdaten deiner Immobilie bleiben erhalten.</p></details> : null}
        <InvestmentFields key={draft.key} input={draft.input} onChange={updateInput} />
        <div className="border-t py-5"><Button className="w-full rounded-xl" disabled={pending || !result || !draft.name.trim()} onClick={saveScenario}>{pending ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}Szenario speichern</Button><p className="mt-2 text-center text-[10px] text-muted-foreground">In deiner Organisation gespeichert</p></div>
        </fieldset>
      </aside>

      <div id="comparison-results" className="min-w-0 scroll-mt-5 space-y-5">
        {current.issues.length ? <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-6"><h2 className="font-semibold">Noch kurz deine Eingaben prüfen</h2><ul className="mt-3 list-disc space-y-1 pl-4 text-sm">{current.issues.map((issue) => <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>)}</ul><p className="mt-3 text-xs text-muted-foreground">Das Ergebnis erscheint, sobald die Angaben vollständig und gültig sind.</p></div> : null}
        {calculation && result ? <>
          <section className="relative overflow-hidden rounded-2xl bg-[#173f35] p-6 text-white sm:p-7" aria-label="Berechnungsergebnis">
            <div className="pointer-events-none absolute -right-12 -top-16 size-64 rounded-full border border-white/10" /><div className="pointer-events-none absolute -right-4 -top-8 size-48 rounded-full border border-white/10" />
            <div className="relative flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs text-white/65">Geschätzte Steuerentlastung über {draft.input.years} Jahre</p><p className="mt-3 text-4xl font-medium tracking-[-0.045em] tabular-nums sm:text-5xl" data-testid="total-tax-saving">{euros(result.totalTaxSavingCents)}</p><p className="mt-3 text-xs text-[#d9eeaa]">{result.label} · {rate(draft.input.marginalTaxRate)} Grenzsteuersatz</p></div><span className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-[10px] text-white/80"><ShieldCheck className="size-3" />Unverbindliche Schätzung</span></div>
            <div className="relative mt-6 grid gap-4 border-t border-white/15 pt-5 sm:grid-cols-3">
              {[{ label: "Abzug im ersten Jahr", value: euros(result.firstYearDeductionCents) }, { label: "Steuerentlastung im ersten Jahr", value: euros(result.firstYearTaxSavingCents) }, { label: "Gebäudebasis gesamt", value: euros(calculation.basis.buildingBasisCents) }].map((item) => <div key={item.label}><p className="text-[10px] text-white/60">{item.label}</p><p className="mt-1.5 text-xl font-medium tabular-nums">{item.value}</p></div>)}
            </div>
          </section>

          <section className="rounded-2xl border bg-card p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-sm font-semibold">Dein Abschreibungsmodell</h2><p className="mt-1 text-xs text-muted-foreground">Es erscheinen nur nach deinen Angaben mögliche Modelle.</p></div>
              <label className="relative min-w-0 sm:max-w-[55%]"><span className="sr-only">Abschreibungsmodell wählen</span><select value={result.id} onChange={(event) => update({ selectedMethod: event.target.value })} className="h-10 w-full appearance-none rounded-xl border bg-background py-2 pl-3 pr-9 text-xs font-medium outline-none focus:ring-2 focus:ring-primary/20">{calculation.scenarios.map((scenario) => <option key={scenario.id} value={scenario.id}>{scenario.label}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3 size-4" /></label>
            </div>
            {draft.selectedMethod && draft.selectedMethod !== result.id ? <p className="mt-3 text-xs text-amber-800">Das zuvor gewählte Modell ist mit den aktuellen Angaben nicht verfügbar. Angezeigt wird: {result.label}.</p> : null}
            {result.switchedToLinearYear ? <p className="mt-3 text-xs text-primary">Ab {result.switchedToLinearYear} wechselt die Berechnung zur höheren linearen Abschreibung des Restwerts.</p> : null}
          </section>

          <section className="overflow-hidden rounded-2xl border bg-card">
            <div className="flex gap-1 overflow-x-auto border-b px-4 pt-2" role="tablist" aria-label="Auswertung">
              {([{ id: "overview", label: "Steuerwirkung" }, { id: "schedule", label: "Jahr für Jahr" }, { id: "basis", label: "Rechenweg" }] as const).map((item) => <button key={item.id} type="button" role="tab" aria-selected={tab === item.id} tabIndex={tab === item.id ? 0 : -1} onKeyDown={(event) => { const tabs = ["overview", "schedule", "basis"] as const; const index = tabs.indexOf(tab); const next = event.key === "ArrowRight" ? (index + 1) % 3 : event.key === "ArrowLeft" ? (index + 2) % 3 : event.key === "Home" ? 0 : event.key === "End" ? 2 : -1; if (next >= 0) { event.preventDefault(); setTab(tabs[next]); document.getElementById(`tab-${tabs[next]}`)?.focus(); } }} id={`tab-${item.id}`} aria-controls={`panel-${item.id}`} onClick={() => setTab(item.id)} className={cn("whitespace-nowrap border-b-2 px-4 py-3 text-xs font-medium transition", tab === item.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{item.label}</button>)}
            </div>
            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="p-5 sm:p-6">
              {tab === "overview" ? <>
                <div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="text-base font-semibold">Wie sich deine Steuerentlastung entwickelt</h2><p className="mt-1 text-xs text-muted-foreground">Kumulierte Modellwerte ab Anschaffung · nominal, ohne Abzinsung</p></div><span className="rounded-lg bg-secondary p-2 text-primary"><ArrowUpRight className="size-4" /></span></div>
                <InvestmentChart items={all.flatMap((item, index) => item.result ? [{ name: item.draft.name, result: item.result, color: COLORS[index] }] : [])} />
                <div className="mt-5 grid gap-3 sm:grid-cols-3">{all.map((item, index) => <button key={item.draft.key} onClick={() => setActiveKey(item.draft.key)} className={cn("rounded-xl border p-3 text-left transition hover:bg-muted/30", item.draft.key === activeKey && "bg-secondary/25")}><div className="flex items-center gap-2 text-xs"><span className="size-2 shrink-0 rounded-full" style={{ background: COLORS[index] }} /><span className="truncate">{item.draft.name}</span></div><p className="mt-2 text-lg font-semibold tabular-nums">{item.result ? euros(item.result.totalTaxSavingCents) : "Angaben prüfen"}</p><p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{item.draft.input.years} Jahre · {item.result?.label ?? "Unvollständig"}</p></button>)}</div>
                {drafts.length > 1 ? <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">Vergleiche nach Betrachtungsjahren. Unterschiedliche Kaufpreise, Startjahre, Steuersätze oder Laufzeiten beeinflussen das Ergebnis. Höhere Steuerentlastung allein bedeutet keine höhere Rendite.</p> : <button onClick={addScenario} className="mt-5 inline-flex items-center gap-2 text-xs font-medium text-primary"><Copy className="size-3.5" />Mit einer zweiten Variante vergleichen<ArrowRight className="size-3.5" /></button>}
              </> : null}
              {tab === "schedule" ? <>
                <h2 className="text-base font-semibold">Dein jährlicher Abschreibungsplan</h2><p className="mb-5 mt-1 text-xs text-muted-foreground">{draft.name} · {result.label} · Beträge in Euro</p>
                <div className="-mx-2 overflow-x-auto rounded-xl border" tabIndex={0} aria-label="Jahresplan horizontal scrollbar"><table className="w-full min-w-[690px] text-right text-xs"><thead><tr className="bg-secondary/60 text-[10px] text-muted-foreground">{["Jahr", "Normale AfA", "§ 7b", "Denkmalabzug", "Gesamtabzug", "Steuerentlastung", "Restbasis"].map((label) => <th key={label} className="whitespace-nowrap px-3 py-3 font-medium first:text-left">{label}</th>)}</tr></thead><tbody>{result.annualRows.map((row) => <tr key={row.year} className="border-t even:bg-background/50"><th scope="row" className="px-3 py-3 text-left font-medium">{row.year}<span className="mt-1 block text-[9px] font-normal text-muted-foreground">{row.months}/12 Monate</span><span className="mt-1 block max-w-28 text-[9px] font-normal text-muted-foreground">{row.method}</span></th><td className="px-3 py-3 tabular-nums">{preciseEuros(row.regularDepreciationCents)}</td><td className="px-3 py-3 tabular-nums">{preciseEuros(row.specialDepreciationCents)}</td><td className="px-3 py-3 tabular-nums">{preciseEuros(row.heritageDeductionCents)}</td><td className="px-3 py-3 font-medium tabular-nums">{preciseEuros(row.totalDeductionCents)}</td><td className="px-3 py-3 font-semibold text-primary tabular-nums">{preciseEuros(row.taxSavingCents)}</td><td className="px-3 py-3 tabular-nums">{preciseEuros(row.remainingBasisCents)}</td></tr>)}</tbody><tfoot><tr className="border-t bg-secondary/60 font-semibold"><th className="px-3 py-4 text-left" colSpan={4}>Summe im Zeitraum</th><td className="px-3 py-4">{preciseEuros(result.totalDeductionCents)}</td><td className="px-3 py-4 text-primary">{preciseEuros(result.totalTaxSavingCents)}</td><td className="px-3 py-4">{preciseEuros(result.remainingBasisCents)}</td></tr></tfoot></table></div>
                <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">Monatsanteile gelten für die normale lineare und degressive AfA. § 7b und Denkmalabzüge folgen ihren eigenen Jahresregeln. Restbasis ist kein Marktwert.</p>
              </> : null}
              {tab === "basis" ? <>
                <h2 className="text-base font-semibold">So setzt sich deine AfA-Basis zusammen</h2><p className="mb-5 mt-1 text-xs text-muted-foreground">Grundstück und begünstigte Kosten bleiben sauber getrennt.</p>
                <dl className="space-y-0 text-sm">{[
                  ["Kaufpreis gesamt", draft.input.purchasePriceCents], ["Davon Grund und Boden", -calculation.basis.landPurchasePriceCents],
                  ["Gebäudeanteil am Kaufpreis", calculation.basis.buildingPurchasePriceCents], ["+ Anteilige Kaufnebenkosten Gebäude", calculation.basis.buildingAcquisitionCostsCents],
                  ["+ Aktivierungspflichtige Maßnahmen", draft.input.capitalizedMeasuresCents],
                ].map(([label, value]) => <div key={String(label)} className="flex justify-between gap-4 border-b py-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="shrink-0 text-xs font-medium tabular-nums">{preciseEuros(Number(value))}</dd></div>)}
                  <div className="flex justify-between gap-4 rounded-xl bg-secondary p-4"><dt className="font-semibold">Gebäudebasis gesamt</dt><dd className="font-semibold tabular-nums">{preciseEuros(calculation.basis.buildingBasisCents)}</dd></div>
                  {calculation.basis.heritageBasisCents > 0 ? <><div className="flex justify-between gap-4 py-3"><dt className="text-xs text-muted-foreground">Davon begünstigte Denkmalkosten</dt><dd className="text-xs tabular-nums">{preciseEuros(calculation.basis.heritageBasisCents)}</dd></div><div className="flex justify-between gap-4 py-3"><dt className="text-xs text-muted-foreground">Übrige Gebäudekosten</dt><dd className="text-xs tabular-nums">{preciseEuros(calculation.basis.regularBuildingBasisCents)}</dd></div></> : null}
                </dl>
                <div className="mt-5 rounded-xl border border-dashed p-4 text-xs leading-relaxed"><p className="font-medium">Deine geschätzte Steuerwirkung</p><p className="mt-2 text-muted-foreground">{preciseEuros(result.totalDeductionCents)} Gesamtabzug × {rate(draft.input.marginalTaxRate)} Grenzsteuersatz ≈ {preciseEuros(result.totalTaxSavingCents)} Steuerentlastung. Die AfA ist keine Auszahlung; die tatsächliche Entlastung hängt von deiner steuerlichen Situation ab.</p></div>
              </> : null}
            </div>
          </section>

          {calculation.warnings.length ? <section className="rounded-2xl border border-amber-200/70 bg-[#faf8ef] p-5"><h2 className="flex items-center gap-2 text-sm font-semibold"><Info className="size-4 text-amber-700" />Was du für dieses Szenario beachten solltest</h2><ul className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">{calculation.warnings.map((warning, index) => <li key={index} className="flex gap-2"><span className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-600" /><span>{warning}</span></li>)}</ul></section> : null}
          <details className="group rounded-2xl border bg-card p-5"><summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold [&::-webkit-details-marker]:hidden"><Landmark className="size-4 text-primary" />Regeln, Voraussetzungen & Quellen<ChevronDown className="ml-auto size-4 transition group-open:rotate-180" /></summary><div className="mt-5 space-y-4 text-xs leading-relaxed text-muted-foreground">
            <p>Reguläre Gebäude-AfA nach Fertigstellung: vor 1925: 2,5 %; 1925–2022: 2 %; ab 2023: 3 %. Für begünstigten Wohnungsneubau sind 5 % degressiv vom Restwert möglich.</p>
            <p>Ein Denkmal hat keinen pauschalen AfA-Satz von 2,5 %. Die erhöhte Abschreibung gilt nur für bescheinigte Maßnahmen. Bei Eigennutzung ist § 10f ein Sonderausgabenabzug.</p>
            {draft.input.propertyKind === "new_build" ? <div className="grid gap-3 sm:grid-cols-2">{([{ label: "Degressive AfA", value: calculation.eligibility.degressive }, { label: "Sonderabschreibung § 7b", value: calculation.eligibility.special7b }]).map((item) => <div key={item.label} className="rounded-xl bg-background p-3"><p className="flex items-center gap-2 font-semibold text-foreground">{item.value.eligible ? <Check className="size-3 text-primary" /> : <Info className="size-3" />}{item.label}</p>{item.value.eligible ? <p className="mt-2">Nach deinen bestätigten Angaben im Modell verfügbar.</p> : <ul className="mt-2 space-y-1">{item.value.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}</div>)}</div> : null}
            <div className="flex flex-wrap gap-2">{INVESTMENT_TAX_SOURCES.map((source) => <a key={source.url} href={source.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-primary hover:bg-secondary">{source.label}<ArrowUpRight className="size-3" /></a>)}</div>
            <p className="text-[10px]">Gesetzesprüfung: 22.09.2026. Individuelle Sonderfälle und spätere Gesetzesänderungen müssen gesondert geprüft werden.</p>
          </div></details>
        </> : null}
        <div className="flex items-start gap-2.5 px-1 text-[11px] leading-relaxed text-muted-foreground"><ShieldCheck className="mt-0.5 size-4 shrink-0" /><p>Unverbindliche Modellrechnung, keine Steuerberatung. Gezeigt wird ausschließlich die Wirkung der Abschreibung bzw. des Sonderausgabenabzugs. Miete, Zinsen, Tilgung, laufende Kosten und Verkauf sind nicht Bestandteil dieses Vergleichs.</p></div>

      </div>
    </div>
  </div>;
}
