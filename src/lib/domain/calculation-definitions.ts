export interface CalculationDefinition {
  label: string;
  formula: string;
  inputs: readonly string[];
  rounding: string;
  missingValueHandling: string;
  explanation: string;
}

/**
 * Reader-facing definitions can be rendered beside every KPI. They document
 * formulas independently from presentation code and mirror the implementation.
 */
export const CALCULATION_DEFINITIONS = {
  targetRent: {
    label: "Sollmiete",
    formula: "Summe aller fälligen, nicht stornierten Mietforderungen",
    inputs: ["Fällige Mietforderungen in Cent", "Status je Forderung"],
    rounding: "Keine Zwischenrundung; Quellen sind bereits ganze Cent.",
    missingValueHandling:
      "Fehlende Beträge werden nicht als 0 behandelt, sondern separat gezählt.",
    explanation:
      "Zeigt, welcher Betrag im gewählten Zeitraum vertraglich fällig war.",
  },
  actualRent: {
    label: "Ist-Miete",
    formula: "Summe aller gebuchten, nicht stornierten Mietzahlungen",
    inputs: ["Zahlungseingänge in Cent", "Buchungsstatus"],
    rounding: "Keine Zwischenrundung; Quellen sind bereits ganze Cent.",
    missingValueHandling:
      "Fehlende Beträge werden separat gezählt; ausstehende Buchungen bleiben außen vor.",
    explanation:
      "Zeigt nur tatsächlich gebuchte und berücksichtigte Zahlungseingänge.",
  },
  arrears: {
    label: "Mietrückstand",
    formula: "max(0, Sollmiete − Ist-Miete)",
    inputs: ["Sollmiete in Cent", "Ist-Miete in Cent"],
    rounding: "Ganzzahlig in Cent.",
    missingValueHandling:
      "Beide Summen müssen vorliegen; Überzahlungen werden separat ausgewiesen.",
    explanation:
      "Offener Mietbetrag ohne Verrechnung einer Überzahlung als negativer Rückstand.",
  },
  vacancy: {
    label: "Leerstandsquote",
    formula: "Leerstehende Fläche ÷ vermietbare Gesamtfläche",
    inputs: ["Leerstehende m²", "Gesamte vermietbare m²"],
    rounding: "Quote auf sechs Dezimalstellen.",
    missingValueHandling:
      "Bei 0 m² Gesamtfläche ist die Quote nicht berechenbar (`null`).",
    explanation: "Flächengewichteter Anteil der leerstehenden Mietfläche.",
  },
  grossRentalYield: {
    label: "Bruttomietrendite",
    formula: "Jährliche Kaltmiete ÷ Kaufpreis",
    inputs: ["Jährliche Kaltmiete in Cent", "Kaufpreis in Cent"],
    rounding: "Quote auf sechs Dezimalstellen.",
    missingValueHandling:
      "Bei Kaufpreis 0 ist die Kennzahl nicht berechenbar (`null`).",
    explanation: "Einfache Mietrendite vor Kosten und Finanzierung.",
  },
  netRentalYield: {
    label: "Nettomietrendite",
    formula:
      "(Jahresmiete − nicht umlagefähige Betriebskosten) ÷ (Kaufpreis + Kaufnebenkosten)",
    inputs: [
      "Jahresmiete",
      "Nicht umlagefähige Betriebskosten",
      "Kaufpreis",
      "Kaufnebenkosten",
    ],
    rounding: "Quote auf sechs Dezimalstellen.",
    missingValueHandling:
      "Optionale Kaufnebenkosten sind explizit 0; Gesamtkosten 0 ergeben `null`.",
    explanation: "Rendite nach laufenden Objektkosten, aber vor Finanzierung.",
  },
  operatingCashflow: {
    label: "Operativer Cashflow",
    formula: "Liquiditätswirksame Betriebseinnahmen − Betriebsausgaben",
    inputs: ["Betriebseinnahmen in Cent", "Betriebsausgaben in Cent"],
    rounding: "Ganzzahlig in Cent.",
    missingValueHandling: "Alle übergebenen Beträge müssen valide Centwerte sein.",
    explanation: "Objektergebnis vor Zins, Tilgung und Steuer.",
  },
  cashflowAfterFinancing: {
    label: "Cashflow nach Finanzierung",
    formula:
      "Operativer Cashflow − Zinsen − Tilgung − sonstige Finanzierungskosten",
    inputs: ["Operativer Cashflow", "Zinsen", "Tilgung", "Finanzierungskosten"],
    rounding: "Ganzzahlig in Cent.",
    missingValueHandling:
      "Optionale sonstige Finanzierungskosten werden explizit mit 0 angesetzt.",
    explanation:
      "Tilgung mindert hier die Liquidität, unabhängig von ihrer steuerlichen Behandlung.",
  },
  cashflowAfterTax: {
    label: "Geschätzter Cashflow nach Steuern",
    formula: "Cashflow vor Steuer − geschätzte Steuer",
    inputs: ["Cashflow vor Steuer", "Geschätzte Steuer (+ Last, − Entlastung)"],
    rounding: "Ganzzahlig in Cent.",
    missingValueHandling:
      "Ohne Steuerannahme bleibt der geschätzte Nachsteuer-Cashflow `null`.",
    explanation:
      "Unverbindliche Liquidität nach der separat berechneten Steuerwirkung.",
  },
  returnOnEquity: {
    label: "Eigenkapitalrendite",
    formula: "Jährlicher Investor-Cashflow ÷ eingesetztes Eigenkapital",
    inputs: ["Jährlicher Cashflow", "Eingesetztes Eigenkapital"],
    rounding: "Quote auf sechs Dezimalstellen.",
    missingValueHandling:
      "Bei eingesetztem Eigenkapital 0 ist die Kennzahl `null`.",
    explanation: "Cash-Rendite auf das gebundene eigene Kapital.",
  },
  purchasePriceFactor: {
    label: "Kaufpreisfaktor",
    formula: "Kaufpreis ÷ jährliche Kaltmiete",
    inputs: ["Kaufpreis", "Jährliche Kaltmiete"],
    rounding: "Auf zwei Dezimalstellen.",
    missingValueHandling: "Bei Jahresmiete 0 ist die Kennzahl `null`.",
    explanation:
      "Gibt an, wie vielen Jahreskaltmieten der Kaufpreis entspricht.",
  },
  perSquareMeter: {
    label: "Betrag je Quadratmeter",
    formula: "Betrag in Cent ÷ Fläche in m²",
    inputs: ["Miete oder Kosten", "Fläche in m²"],
    rounding: "Auf den nächsten Cent je m².",
    missingValueHandling: "Bei Fläche 0 ist die Kennzahl `null`.",
    explanation: "Vergleichbarer Betrag je Quadratmeter.",
  },
  annuity: {
    label: "Darlehensannuität",
    formula: "Kapital × Monatszins ÷ (1 − (1 + Monatszins)^−Laufzeit)",
    inputs: ["Darlehensbetrag", "Jahreszins", "Laufzeit in Monaten"],
    rounding: "Monatliche Rate auf Cent, kaufmännisch halb weg von 0.",
    missingValueHandling: "Betrag, Zinssatz und positive Laufzeit sind Pflicht.",
    explanation: "Konstante Rate eines vollständig amortisierenden Darlehens.",
  },
  amortization: {
    label: "Zins- und Tilgungsplan",
    formula:
      "Monatszins = Restschuld × Jahreszins ÷ 12; Tilgung = Rate − Monatszins",
    inputs: ["Restschuld", "Jahreszins", "Rate", "Sondertilgungen"],
    rounding: "Zins und Rate in jeder Periode auf Cent.",
    missingValueHandling:
      "Eine Rate unter dem Monatszins wird nicht als Zinskapitalisierung geraten, sondern abgelehnt.",
    explanation: "Centgenaue Restschuldentwicklung je Zahlungstermin.",
  },
  loanToValue: {
    label: "Loan-to-Value",
    formula: "Aktuelle Restschuld ÷ aktueller Marktwert",
    inputs: ["Restschuld", "Marktwert"],
    rounding: "Quote auf sechs Dezimalstellen.",
    missingValueHandling: "Bei Marktwert 0 ist die Kennzahl `null`.",
    explanation: "Anteil der Fremdfinanzierung am hinterlegten Marktwert.",
  },
  debtServiceCoverage: {
    label: "Schuldendienstdeckungsgrad (DSCR)",
    formula: "Net Operating Income ÷ Zins- und Tilgungsdienst",
    inputs: ["Net Operating Income", "Schuldendienst desselben Zeitraums"],
    rounding: "Auf vier Dezimalstellen.",
    missingValueHandling: "Bei Schuldendienst 0 ist die Kennzahl `null`.",
    explanation:
      "Zeigt, wie oft das operative Nettoergebnis den Schuldendienst deckt.",
  },
  depreciation: {
    label: "Geschätzte Abschreibung (AfA)",
    formula:
      "Abschreibungsbasis × angenommener Jahressatz × Monate ÷ 12 + manuelle Korrektur",
    inputs: [
      "Gebäudebasis",
      "Nutzungsbeginn",
      "AfA-Satz",
      "Zusatzkomponenten",
      "Korrektur",
    ],
    rounding: "Je Komponente auf Cent; anschließend Summe.",
    missingValueHandling:
      "Basis, Datum und Satz sind Pflicht; Zusatzwerte und Korrektur sind explizit optional.",
    explanation:
      "Editierbare unterjährige Modellrechnung, keine verbindliche steuerliche Einordnung.",
  },
  taxableResult: {
    label: "Geschätztes steuerliches Ergebnis",
    formula:
      "Steuerpflichtige Einnahmen − abzugsfähige Ausgaben − Zinsen − AfA − sonstige Aufwendungen",
    inputs: [
      "Steuerpflichtige Einnahmen",
      "Abzugsfähige Betriebsausgaben",
      "Zinsen",
      "AfA",
      "Sonstige Aufwendungen",
    ],
    rounding: "Ganzzahlig in Cent.",
    missingValueHandling:
      "Pflichtwerte werden validiert; Tilgung wird bewusst nicht einbezogen.",
    explanation:
      "Modellergebnis aus den vom Nutzer als steuerlich relevant eingestuften Positionen.",
  },
  estimatedTax: {
    label: "Geschätzte Steuerwirkung",
    formula: "Steuerliches Ergebnis × angenommener Steuersatz",
    inputs: ["Steuerliches Ergebnis", "Steuersatz", "Verlustverrechnungsannahme"],
    rounding: "Auf Cent, halb weg von 0.",
    missingValueHandling:
      "Ohne Steuersatz werden Steuerbetrag und Cashflow-Wirkung `null`.",
    explanation:
      "Positive Werte sind Belastung, negative Werte modellierte Entlastung.",
  },
  renovationReserve: {
    label: "Sanierungsrücklage",
    formula:
      "Summe (offener Maßnahmenbetrag inkl. Puffer − zugeteilte Rücklage) ÷ Monate bis Plantermin",
    inputs: ["Maßnahmen", "Sicherheitspuffer", "Plantermine", "Vorhandene Rücklage"],
    rounding: "Monatliche Sparrate je Maßnahme auf volle Cent aufrunden.",
    missingValueHandling:
      "Abgeschlossene/stornierte Maßnahmen werden ausgeschlossen; Rücklage ist optional 0.",
    explanation:
      "Chronologische, unverzinste Rücklagenplanung aus erfassten Annahmen.",
  },
  equity: {
    label: "Geschätztes Eigenkapital",
    formula: "Aktueller Marktwert − Summe aktueller Restschulden",
    inputs: ["Marktwert", "Restschulden"],
    rounding: "Ganzzahlig in Cent.",
    missingValueHandling:
      "Marktwert und alle bekannten Restschulden müssen explizit vorliegen.",
    explanation: "Rechnerisches Brutto-Eigenkapital vor Verkaufskosten.",
  },
  saleScenario: {
    label: "Verkaufsszenario",
    formula:
      "Verkaufspreis − Restschulden − Exit-Kosten + kumulierter Cashflow",
    inputs: [
      "Erwarteter Verkaufspreis",
      "Restschulden",
      "Verkaufskosten",
      "Vorfälligkeit",
      "Manuelle Steuerannahme",
      "Kumulierter Cashflow",
    ],
    rounding: "Geld in Cent; Renditequoten bis sechs Dezimalstellen.",
    missingValueHandling:
      "Optionale Exit-Kosten/Cashflows sind explizit 0; es werden keine Steuervorschriften geraten.",
    explanation:
      "Unverbindliches Szenario, keine Verkaufs-, Rechts- oder Steuerberatung.",
  },
} as const satisfies Record<string, CalculationDefinition>;

export type CalculationDefinitionKey = keyof typeof CALCULATION_DEFINITIONS;
