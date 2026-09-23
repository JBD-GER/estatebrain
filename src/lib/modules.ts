import { propertyTypeOptions } from "@/lib/domain/property";

export type ModuleField = {
  name: string;
  label: string;
  type: "text" | "textarea" | "money" | "number" | "date" | "select";
  placeholder?: string;
  required?: boolean;
  options?: Array<{ label: string; value: string }>;
  relation?: "properties" | "units" | "tenants";
  percentageRate?: boolean;
  virtual?: boolean;
};

export type ModuleColumn = {
  key: string;
  label: string;
  format?:
    | "text"
    | "money"
    | "date"
    | "status"
    | "propertyType"
    | "number"
    | "percent"
    | "rate";
};

export type ModuleDefinition = {
  slug: string;
  title: string;
  eyebrow: string;
  description: string;
  table: PublicTableName;
  columns: ModuleColumn[];
  fields: ModuleField[];
  createLabel?: string;
  readOnly?: boolean;
  taxSensitive?: boolean;
  emptyTitle: string;
  emptyDescription: string;
};

const propertyTypeModuleOptions = propertyTypeOptions.map((option) => ({
  label: `${option.abbreviation} · ${option.label}`,
  value: option.value,
}));

export const moduleDefinitions: Record<string, ModuleDefinition> = {
  portfolio: {
    slug: "portfolio",
    title: "Portfolio",
    eyebrow: "Gesamtbestand",
    description:
      "Marktwerte, Eigenkapital, Rendite und Risikoverteilung über alle Immobilien.",
    table: "properties",
    columns: [
      { key: "name", label: "Immobilie" },
      { key: "city", label: "Ort" },
      { key: "current_market_value_cents", label: "Marktwert", format: "money" },
      { key: "purchase_price_cents", label: "Kaufpreis", format: "money" },
      { key: "rentable_area_sqm", label: "Fläche", format: "number" },
      { key: "status", label: "Status", format: "status" },
    ],
    fields: [],
    readOnly: true,
    emptyTitle: "Noch kein Portfolio vorhanden",
    emptyDescription:
      "Lege deine erste Immobilie an, um Marktwert, Eigenkapital und Rendite zu sehen.",
  },
  immobilien: {
    slug: "immobilien",
    title: "Immobilien",
    eyebrow: "Stammdaten & Performance",
    description:
      "Verwalte Objektdaten, Marktwerte, laufende Kosten und Zuständigkeiten.",
    table: "properties",
    columns: [
      { key: "name", label: "Bezeichnung" },
      { key: "street", label: "Adresse" },
      { key: "city", label: "Ort" },
      { key: "property_mode", label: "Modus", format: "status" },
      { key: "property_type", label: "Typ", format: "propertyType" },
      { key: "current_market_value_cents", label: "Marktwert", format: "money" },
      { key: "rentable_area_sqm", label: "Vermietbare m²", format: "number" },
    ],
    fields: [
      { name: "name", label: "Bezeichnung", type: "text", required: true },
      {
        name: "street",
        label: "Straße und Hausnummer",
        type: "text",
        required: true,
      },
      { name: "postal_code", label: "Postleitzahl", type: "text", required: true },
      { name: "city", label: "Ort", type: "text", required: true },
      {
        name: "property_mode",
        label: "Objektmodus",
        type: "select",
        required: true,
        options: [
          { label: "Bestandsimmobilie", value: "existing" },
          { label: "Fiktives Szenario", value: "scenario" },
        ],
      },
      {
        name: "property_type",
        label: "Immobilientyp",
        type: "select",
        required: true,
        options: propertyTypeModuleOptions,
      },
      {
        name: "construction_year",
        label: "Baujahr",
        type: "number",
        required: true,
      },
      {
        name: "purchase_date",
        label: "Kaufdatum",
        type: "date",
        required: true,
      },
      {
        name: "purchase_price_cents",
        label: "Kaufpreis gesamt",
        type: "money",
        required: true,
      },
      {
        name: "land_area_sqm",
        label: "Grundstücksfläche in m²",
        type: "number",
        required: true,
      },
      {
        name: "standard_land_value_cents_per_sqm",
        label: "Bodenrichtwert je m²",
        type: "money",
        required: true,
      },
      {
        name: "land_ownership_share",
        label: "Miteigentumsanteil am Grundstück in %",
        type: "number",
        percentageRate: true,
      },
      {
        name: "real_estate_transfer_tax_rate",
        label: "Grunderwerbsteuersatz in %",
        type: "number",
        percentageRate: true,
        required: true,
      },
      {
        name: "broker_fee_cents",
        label: "Maklerkosten",
        type: "money",
        required: true,
      },
      {
        name: "notary_fee_cents",
        label: "Notarkosten",
        type: "money",
        required: true,
      },
      {
        name: "land_registry_fee_cents",
        label: "Grundbuchkosten",
        type: "money",
        required: true,
      },
      {
        name: "other_acquisition_costs_cents",
        label: "Weitere Kaufnebenkosten",
        type: "money",
        required: true,
      },
      {
        name: "rentable_area_sqm",
        label: "Vermietbare Fläche in m²",
        type: "number",
      },
    ],
    createLabel: "Immobilie anlegen",
    emptyTitle: "Noch keine Immobilie erfasst",
    emptyDescription:
      "Lege dein erstes Objekt an und ergänze anschließend Einheiten, Finanzierung und Dokumente.",
  },
  einheiten: {
    slug: "einheiten",
    title: "Einheiten",
    eyebrow: "Vermietbare Flächen",
    description:
      "Wohnungen, Gewerbe- und Stellplatzeinheiten mit Markt-/SOLL-Miete und Belegungsstatus.",
    table: "units",
    columns: [
      { key: "unit_number", label: "Einheit" },
      { key: "property_name", label: "Immobilie" },
      { key: "floor", label: "Etage" },
      { key: "area_sqm", label: "Fläche", format: "number" },
      {
        key: "target_cold_rent_cents",
        label: "Markt-/SOLL-Kaltmiete (mtl.)",
        format: "money",
      },
      { key: "status", label: "Status", format: "status" },
    ],
    fields: [
      {
        name: "property_id",
        label: "Immobilie",
        type: "select",
        relation: "properties",
        required: true,
      },
      { name: "unit_number", label: "Bezeichnung", type: "text", required: true },
      { name: "floor", label: "Etage", type: "text" },
      { name: "area_sqm", label: "Wohnfläche in m²", type: "number", required: true },
      { name: "rooms", label: "Zimmer", type: "number" },
      {
        name: "target_cold_rent_cents",
        label: "Markt-/SOLL-Kaltmiete (mtl.)",
        type: "money",
        required: true,
      },
      {
        name: "ancillary_prepayment_cents",
        label: "Nebenkostenbetrag (mtl.)",
        type: "money",
      },
      {
        name: "ancillary_charge_type",
        label: "Nebenkostenart",
        type: "select",
        options: [
          { label: "Vorauszahlung", value: "advance" },
          { label: "Betriebskostenpauschale", value: "flat_rate" },
          { label: "Keine gesonderten Nebenkosten", value: "none" },
        ],
        required: true,
      },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "Vermietet", value: "rented" },
          { label: "Leerstand", value: "vacant" },
          { label: "Sanierung", value: "renovation" },
        ],
        required: true,
      },
    ],
    createLabel: "Einheit anlegen",
    emptyTitle: "Noch keine Einheit vorhanden",
    emptyDescription:
      "Erfasse Wohnungen und andere vermietbare Flächen deiner Immobilien.",
  },
  mieter: {
    slug: "mieter", title: "Mieterdaten", eyebrow: "Kontaktdaten", description: "Namen und Kontaktdaten verwalten. Neue Mieter werden zusammen mit einem Mietverhältnis angelegt.",
    table: "tenants", readOnly: true,
    columns: [{key:"first_name",label:"Vorname"},{key:"last_name",label:"Nachname"},{key:"company_name",label:"Firma"},{key:"email",label:"E-Mail"},{key:"phone",label:"Telefon"}],
    fields: [
      {name:"tenant_type",label:"Mietertyp",type:"select",required:true,options:[{label:"Privatperson",value:"person"},{label:"Unternehmen",value:"company"}]},
      {name:"first_name",label:"Vorname",type:"text"},{name:"last_name",label:"Nachname",type:"text"},{name:"company_name",label:"Firmenname",type:"text"},
      {name:"email",label:"E-Mail",type:"text"},{name:"phone",label:"Telefon",type:"text"},
      {name:"street",label:"Straße",type:"text"},{name:"house_number",label:"Hausnummer",type:"text"},{name:"postal_code",label:"Postleitzahl",type:"text"},{name:"city",label:"Ort",type:"text"},
    ],emptyTitle:"Noch keine Mieterdaten",emptyDescription:"Lege oben ein Mietverhältnis mit einem Mieter an.",
  },
  mietverhaeltnisse: {
    slug: "mietverhaeltnisse",
    title: "Mietverhältnisse",
    eyebrow: "Verträge & Mietstatus",
    description:
      "Aktive Verträge, Vertragsmieten, Kautionen, Laufzeiten und Zahlungsstatus.",
    table: "leases",
    columns: [
      { key: "unit_name", label: "Einheit" },
      { key: "tenant_name", label: "Hauptmieter" },
      { key: "starts_on", label: "Mietbeginn", format: "date" },
      {
        key: "cold_rent_cents",
        label: "Vertrags-Kaltmiete (mtl.)",
        format: "money",
      },
      {
        key: "ancillary_charge_type",
        label: "Nebenkostenart",
        format: "status",
      },
      { key: "ancillary_prepayment_cents", label: "Nebenkosten (mtl.)", format: "money" },
      { key: "ends_on", label: "Mietende", format: "date" },
      { key: "status", label: "Status", format: "status" },
    ],
    fields: [
      { name: "lease_number", label: "Vertragsnummer", type: "text" },
      { name: "starts_on", label: "Mietbeginn", type: "date", required: true },
      { name: "ends_on", label: "Mietende", type: "date" },
      { name: "due_day", label: "Zahlungstag im Monat (1–31)", type: "number", required: true },
      { name: "cold_rent_cents", label: "Kaltmiete pro Monat", type: "money", required: true },
      { name: "ancillary_prepayment_cents", label: "Nebenkosten pro Monat", type: "money", required: true },
      { name: "parking_rent_cents", label: "Stellplatzmiete pro Monat", type: "money", required: true },
      { name: "other_rent_cents", label: "Weitere Miete pro Monat", type: "money", required: true },
      { name: "deposit_cents", label: "Kaution", type: "money", required: true },
      { name: "ancillary_charge_type", label: "Nebenkostenart", type: "select", required: true, options: [
        {label: "Vorauszahlung", value: "advance"}, {label: "Pauschale", value: "flat_rate"}, {label: "Keine", value: "none"},
      ] },
      { name: "rent_effective_from", label: "Neue Mietbeträge gültig ab (Monatsbeginn)", type: "date", required: true, virtual: true },
      { name: "status", label: "Vertragsstatus", type: "select", required: true, options: [
        {label: "Aktiv", value: "active"}, {label: "Gekündigt", value: "notice_given"}, {label: "Beendet", value: "ended"},
      ] },
    ],
    readOnly: true,
    emptyTitle: "Noch kein Mietverhältnis erfasst",
    emptyDescription:
      "Lege zuerst Mieter und Einheiten an, um einen Mietvertrag zu erfassen.",
  },
  cashflow: {
    slug: "cashflow",
    title: "Cashflow",
    eyebrow: "Liquidität verstehen",
    description:
      "Einnahmen, Betriebsausgaben, Finanzierung und geschätzte Steuerwirkung sauber getrennt.",
    table: "income_entries",
    columns: [
      { key: "entry_date", label: "Datum", format: "date" },
      { key: "description", label: "Beschreibung" },
      { key: "category", label: "Kategorie", format: "status" },
      { key: "amount_cents", label: "Betrag", format: "money" },
      { key: "payment_status", label: "Zahlung", format: "status" },
    ],
    fields: [],
    readOnly: true,
    taxSensitive: true,
    emptyTitle: "Noch keine Cashflow-Daten",
    emptyDescription:
      "Erfasse Einnahmen und Ausgaben oder starte den Demo-Zahlungsabgleich.",
  },
  einnahmen: {
    slug: "einnahmen",
    title: "Einnahmen",
    eyebrow: "Mieten & Erstattungen",
    description:
      "Alle Einnahmen mit Immobilie, Einheit, Zahlungsstatus und Herkunft.",
    table: "income_entries",
    columns: [
      { key: "entry_date", label: "Datum", format: "date" },
      { key: "description", label: "Beschreibung" },
      { key: "category", label: "Kategorie", format: "status" },
      { key: "amount_cents", label: "Betrag", format: "money" },
      { key: "payment_status", label: "Zahlung", format: "status" },
    ],
    fields: [
      {
        name: "property_id",
        label: "Immobilie",
        type: "select",
        relation: "properties",
        required: true,
      },
      { name: "entry_date", label: "Datum", type: "date", required: true },
      {
        name: "category",
        label: "Einnahmenart",
        type: "select",
        required: true,
        options: [
          { label: "Kaltmiete", value: "base_rent" },
          { label: "Nebenkosten", value: "service_charge" },
          { label: "Stellplatz", value: "parking" },
          { label: "Nachzahlung", value: "additional_payment" },
          { label: "Erstattung", value: "reimbursement" },
          { label: "Sonstige Einnahme", value: "other" },
        ],
      },
      { name: "description", label: "Beschreibung", type: "text", required: true },
      { name: "amount_cents", label: "Betrag", type: "money", required: true },
      {
        name: "payment_status",
        label: "Zahlungsstatus",
        type: "select",
        options: [
          { label: "Bezahlt", value: "paid" },
          { label: "Offen", value: "open" },
          { label: "Teilweise", value: "partial" },
        ],
        required: true,
      },
    ],
    createLabel: "Einnahme erfassen",
    emptyTitle: "Noch keine Einnahmen",
    emptyDescription:
      "Erfasse Mieteingänge, Erstattungen und sonstige Einnahmen nachvollziehbar.",
  },
  ausgaben: {
    slug: "ausgaben",
    title: "Ausgaben",
    eyebrow: "Kosten & Zuordnung",
    description:
      "Ausgaben werden aus geprüften Rechnungen und Belegen übernommen.",
    table: "expense_entries",
    columns: [
      { key: "entry_date", label: "Datum", format: "date" },
      { key: "description", label: "Beschreibung" },
      { key: "payment_status", label: "Zahlung", format: "status" },
      { key: "amount_cents", label: "Betrag", format: "money" },
      { key: "document_status", label: "Beleg", format: "status" },
    ],
    fields: [],
    readOnly: true,
    taxSensitive: true,
    emptyTitle: "Noch keine Ausgaben",
    emptyDescription:
      "Lade eine Rechnung oder einen Beleg hoch und ordne ihn einer Immobilie zu.",
  },
  belege: {
    slug: "belege",
    title: "Rechnungen & Belege",
    eyebrow: "Dokumente vollständig vorbereiten",
    description:
      "Rechnungen und Belege prüfen, einer Immobilie zuordnen und als Ausgabe übernehmen.",
    table: "documents",
    columns: [
      { key: "original_file_name", label: "Dokument" },
      { key: "document_type", label: "Typ", format: "status" },
      { key: "document_date", label: "Datum", format: "date" },
      { key: "review_status", label: "Prüfstatus", format: "status" },
      { key: "ocr_status", label: "Erkennung", format: "status" },
      { key: "created_at", label: "Hochgeladen", format: "date" },
    ],
    fields: [],
    readOnly: true,
    createLabel: "Beleg hochladen",
    emptyTitle: "Noch keine Dokumente",
    emptyDescription:
      "Lade eine Rechnung hoch und ergänze erkannte oder manuelle Angaben.",
  },
  bank: {
    slug: "bank",
    title: "Bank & Zahlungen",
    eyebrow: "Demo-Zahlungsabgleich",
    description:
      "Transaktionen erkennen, begründete Zuordnungsvorschläge prüfen und manuell bestätigen.",
    table: "bank_transactions",
    columns: [
      { key: "booked_on", label: "Buchung", format: "date" },
      { key: "counterparty_name", label: "Gegenpartei" },
      { key: "remittance_information", label: "Verwendungszweck" },
      { key: "amount_cents", label: "Betrag", format: "money" },
      { key: "match_status", label: "Zuordnung", format: "status" },
    ],
    fields: [],
    readOnly: true,
    emptyTitle: "Keine Transaktionen vorhanden",
    emptyDescription:
      "Nutze Demo-Transaktionen oder verbinde später einen Open-Banking-Provider.",
  },
  finanzierungen: {
    slug: "finanzierungen",
    title: "Finanzierungen",
    eyebrow: "Darlehen & Zinsbindung",
    description:
      "Restschuld, Rate, Zins-/Tilgungsverlauf, LTV und Anschlussfinanzierung.",
    table: "loans",
    columns: [
      { key: "lender_name", label: "Darlehensgeber" },
      { key: "loan_number", label: "Darlehen" },
      { key: "loan_type", label: "Finanzierungsart", format: "status" },
      { key: "current_balance_cents", label: "Restschuld", format: "money" },
      {
        key: "nominal_interest_rate",
        label: "Sollzins (p. a.)",
        format: "rate",
      },
      {
        key: "monthly_payment_cents",
        label: "Darlehensrate (mtl.)",
        format: "money",
      },
      { key: "fixed_rate_until", label: "Zinsbindung", format: "date" },
    ],
    fields: [
      {
        name: "property_id",
        label: "Immobilie",
        type: "select",
        relation: "properties",
        required: true,
      },
      {
        name: "loan_type",
        label: "Finanzierungsart",
        type: "select",
        required: true,
        options: [
          { label: "Annuitätendarlehen", value: "annuity" },
          { label: "Ratentilgungsdarlehen", value: "repayment" },
          { label: "Endfälliges Darlehen", value: "interest_only" },
          { label: "Variables Darlehen", value: "variable" },
          { label: "Sonstiges", value: "other" },
        ],
      },
      { name: "lender_name", label: "Darlehensgeber", type: "text", required: true },
      { name: "loan_number", label: "Darlehensnummer", type: "text" },
      {
        name: "original_principal_cents",
        label: "Ursprünglicher Betrag",
        type: "money",
        required: true,
      },
      {
        name: "current_balance_cents",
        label: "Aktuelle Restschuld",
        type: "money",
        required: true,
      },
      {
        name: "nominal_interest_rate",
        label: "Sollzins (p. a.) in %",
        type: "number",
        required: true,
        percentageRate: true,
      },
      {
        name: "initial_repayment_rate",
        label: "Anfängliche Tilgung (p. a.) in %",
        type: "number",
        percentageRate: true,
      },
      {
        name: "monthly_payment_cents",
        label: "Darlehensrate (mtl.)",
        type: "money",
        required: true,
      },
      {
        name: "disbursed_on",
        label: "Auszahlung / Darlehensbeginn",
        type: "date",
      },
      { name: "fixed_rate_until", label: "Ende Zinsbindung", type: "date" },
    ],
    createLabel: "Finanzierung anlegen",
    emptyTitle: "Noch keine Finanzierung",
    emptyDescription:
      "Erfasse Darlehen, um Restschuld, LTV und Zinsbindung zu überwachen.",
  },
  steuern: {
    slug: "steuern",
    title: "Steuerübersicht",
    eyebrow: "Unverbindliche Steuerwirkung",
    description:
      "Mieteinnahmen, Werbungskosten, Zinsen und Abschreibung transparent nachvollziehen.",
    table: "tax_calculation_snapshots",
    columns: [
      { key: "period_end", label: "Zeitraum bis", format: "date" },
      { key: "rental_income_cents", label: "Mieteinnahmen", format: "money" },
      { key: "operating_expenses_cents", label: "Aufwendungen", format: "money" },
      { key: "depreciation_cents", label: "Abschreibung", format: "money" },
      { key: "estimated_taxable_result_cents", label: "Ergebnis", format: "money" },
      { key: "estimated_tax_effect_cents", label: "Steuerwirkung", format: "money" },
    ],
    fields: [],
    readOnly: true,
    taxSensitive: true,
    emptyTitle: "Noch keine Steuerberechnung",
    emptyDescription:
      "Hinterlege Steuerannahmen, Einnahmen, Kosten und Abschreibung für eine Modellrechnung.",
  },
  sanierungen: {
    slug: "sanierungen",
    title: "Sanierungen",
    eyebrow: "Bedarf & Rücklagen",
    description:
      "Maßnahmen priorisieren, Kosten planen und Auswirkungen auf Cashflow und Rendite verstehen.",
    table: "renovation_projects",
    columns: [
      { key: "name", label: "Maßnahme" },
      { key: "planned_start_date", label: "Geplanter Start", format: "date" },
      { key: "priority", label: "Priorität", format: "status" },
      { key: "estimated_cost_cents", label: "Schätzkosten", format: "money" },
      { key: "actual_cost_cents", label: "Ist-Kosten", format: "money" },
      { key: "actual_end_date", label: "Abschlussdatum", format: "date" },
      { key: "status", label: "Status", format: "status" },
    ],
    fields: [
      {
        name: "property_id",
        label: "Immobilie",
        type: "select",
        relation: "properties",
        required: true,
      },
      { name: "name", label: "Maßnahme", type: "text", required: true },
      {
        name: "priority",
        label: "Priorität",
        type: "select",
        options: [
          { label: "Niedrig", value: "low" },
          { label: "Mittel", value: "medium" },
          { label: "Hoch", value: "high" },
          { label: "Dringend", value: "urgent" },
        ],
        required: true,
      },
      {
        name: "estimated_cost_cents",
        label: "Geschätzte Kosten",
        type: "money",
        required: true,
      },
      { name: "planned_start_date", label: "Geplanter Start", type: "date" },
      { name: "actual_cost_cents", label: "Gesamtkosten bei Abschluss", type: "money", required: true },
      { name: "actual_end_date", label: "Abschlussdatum (Cashflow-Monat)", type: "date" },
      { name: "status", label: "Status", type: "select", required: true, options: [
        {label: "Geplant", value: "open"}, {label: "In Arbeit", value: "in_progress"},
        {label: "Abgeschlossen", value: "done"}, {label: "Abgebrochen", value: "cancelled"},
      ] },
      { name: "description", label: "Beschreibung", type: "textarea" },
    ],
    createLabel: "Maßnahme planen",
    emptyTitle: "Keine Sanierung geplant",
    emptyDescription:
      "Erfasse Maßnahmen, um Rücklagen und zukünftige Cashflow-Belastungen zu planen.",
  },
  markt: {
    slug: "markt",
    title: "Markt & Bewertung",
    eyebrow: "Quellenbasierte Annahmen",
    description:
      "Marktwerte und Vergleichsmieten mit Quelle, Stand und Unsicherheit dokumentieren.",
    table: "valuations",
    columns: [
      { key: "valued_on", label: "Stand", format: "date" },
      { key: "market_value_cents", label: "Marktwert", format: "money" },
      { key: "source_type", label: "Quellentyp", format: "status" },
      { key: "source_name", label: "Quelle" },
      { key: "confidence", label: "Konfidenz", format: "rate" },
    ],
    fields: [
      {
        name: "property_id",
        label: "Immobilie",
        type: "select",
        relation: "properties",
        required: true,
      },
      { name: "valued_on", label: "Bewertungsdatum", type: "date", required: true },
      { name: "market_value_cents", label: "Marktwert", type: "money", required: true },
      {
        name: "source_type",
        label: "Quellentyp",
        type: "select",
        options: [
          { label: "Manuelle Einschätzung", value: "manual" },
          { label: "Gutachten", value: "appraisal" },
          { label: "Marktbericht", value: "market_report" },
          { label: "Ertragswert", value: "income_approach" },
        ],
        required: true,
      },
      { name: "source_name", label: "Quelle", type: "text", required: true },
    ],
    createLabel: "Bewertung erfassen",
    emptyTitle: "Noch keine Bewertung",
    emptyDescription:
      "Hinterlege einen manuellen Marktwert mit Quelle und Bewertungsdatum.",
  },
  potenziale: {
    slug: "potenziale",
    title: "Potenziale",
    eyebrow: "Nachvollziehbare Hinweise",
    description:
      "Wirtschaftliche Auffälligkeiten priorisieren, prüfen und verantwortlichen Personen zuweisen.",
    table: "optimization_insights",
    columns: [
      { key: "title", label: "Hinweis" },
      { key: "priority", label: "Priorität", format: "status" },
      { key: "estimated_impact_cents", label: "Mögliche Wirkung", format: "money" },
      { key: "explanation", label: "Begründung" },
      { key: "status", label: "Status", format: "status" },
    ],
    fields: [],
    readOnly: true,
    emptyTitle: "Keine offenen Potenziale",
    emptyDescription:
      "Estate Brain zeigt hier nachvollziehbare Hinweise, sobald genügend Daten vorliegen.",
  },
  kommunikation: {
    slug: "kommunikation",
    title: "Kommunikation",
    eyebrow: "Vermieter & Mieter",
    description:
      "Nachrichten und Anliegen pro Mietverhältnis – interne Notizen bleiben intern.",
    table: "conversations",
    columns: [
      { key: "subject", label: "Betreff" },
      { key: "category", label: "Kategorie", format: "status" },
      { key: "priority", label: "Priorität", format: "status" },
      { key: "last_message_at", label: "Letzte Nachricht", format: "date" },
      { key: "status", label: "Status", format: "status" },
    ],
    fields: [
      {name:"status",label:"Status",type:"select",required:true,options:[{label:"Offen",value:"open"},{label:"Wartet auf Mieter",value:"waiting_tenant"},{label:"Wartet auf Team",value:"waiting_team"},{label:"Erledigt",value:"resolved"},{label:"Geschlossen",value:"closed"}]},
      { name: "subject", label: "Betreff", type: "text", required: true },
      {
        name: "category",
        label: "Kategorie",
        type: "select",
        options: [
          { label: "Reparatur", value: "repair" },
          { label: "Schaden", value: "damage" },
          { label: "Nebenkosten", value: "utilities" },
          { label: "Zahlung", value: "payment" },
          { label: "Dokument", value: "document" },
          { label: "Allgemein", value: "general" },
          {label:"Kündigung",value:"termination"},{label:"Übergabe",value:"handover"},{label:"Sonstiges",value:"other"},
        ],
        required: true,
      },
      {
        name: "priority",
        label: "Priorität",
        type: "select",
        options: [
          { label: "Normal", value: "medium" },
          {label:"Niedrig",value:"low"},
          { label: "Hoch", value: "high" },
          { label: "Dringend", value: "urgent" },
        ],
        required: true,
      },
    ],
    createLabel: "Anliegen starten",
    emptyTitle: "Noch keine Unterhaltung",
    emptyDescription:
      "Starte eine Unterhaltung oder lade einen Mieter zum Mieterportal ein.",
  },
  aufgaben: {
    slug: "aufgaben",
    title: "Aufgaben",
    eyebrow: "Heute, überfällig, zugewiesen",
    description:
      "Operative Arbeit mit Priorität, Frist, Verantwortlichen und Status koordinieren.",
    table: "tasks",
    columns: [
      { key: "title", label: "Aufgabe" },
      { key: "category", label: "Kategorie", format: "status" },
      { key: "priority", label: "Priorität", format: "status" },
      { key: "due_at", label: "Fällig", format: "date" },
      { key: "status", label: "Status", format: "status" },
    ],
    fields: [
      { name: "title", label: "Titel", type: "text", required: true },
      { name: "description", label: "Beschreibung", type: "textarea" },
      {
        name: "property_id",
        label: "Immobilie",
        type: "select",
        relation: "properties",
      },
      {
        name: "category",
        label: "Kategorie",
        type: "select",
        options: [
          { label: "Verwaltung", value: "administration" },
          { label: "Reparatur", value: "repair" },
          { label: "Dokument", value: "document" },
          { label: "Finanzierung", value: "financing" },
          { label: "Steuer", value: "tax" },
          { label: "Sonstiges", value: "other" },
        ],
        required: true,
      },
      {
        name: "priority",
        label: "Priorität",
        type: "select",
        options: [
          { label: "Niedrig", value: "low" },
          { label: "Mittel", value: "medium" },
          { label: "Hoch", value: "high" },
          { label: "Dringend", value: "urgent" },
        ],
        required: true,
      },
      { name: "due_at", label: "Fällig am", type: "date" },
      {
        name: "status",
        label: "Status",
        type: "select",
        options: [
          { label: "Offen", value: "open" },
          { label: "In Arbeit", value: "in_progress" },
          { label: "Erledigt", value: "done" },
        ],
        required: true,
      },
    ],
    createLabel: "Aufgabe anlegen",
    emptyTitle: "Keine offenen Aufgaben",
    emptyDescription:
      "Lege wiederkehrende oder einmalige Aufgaben für dein Team an.",
  },
  berichte: {
    slug: "berichte",
    title: "Berichte & Exporte",
    eyebrow: "Nachvollziehbare Auswertungen",
    description:
      "Portfolio-, Cashflow-, Finanzierungs- und Steuer-Vorbereitungsberichte exportieren.",
    table: "tax_years",
    columns: [
      { key: "year", label: "Jahr" },
      { key: "status", label: "Status", format: "status" },
      { key: "locked_at", label: "Abgeschlossen", format: "date" },
      { key: "updated_at", label: "Aktualisiert", format: "date" },
    ],
    fields: [],
    readOnly: true,
    taxSensitive: true,
    emptyTitle: "Noch kein Steuerjahr vorbereitet",
    emptyDescription:
      "Erstelle ein Steuerjahr, sobald Einnahmen, Ausgaben und Belege vollständig sind.",
  },
  team: {
    slug: "team",
    title: "Team",
    eyebrow: "Rollen & Zugriffe",
    description:
      "Eigentümer, Verwaltung, Buchhaltung und Mitarbeitende sicher zusammenbringen.",
    table: "organization_members",
    columns: [
      { key: "display_name", label: "Person" },
      { key: "email", label: "E-Mail" },
      { key: "role", label: "Rolle", format: "status" },
      { key: "status", label: "Status", format: "status" },
      { key: "created_at", label: "Seit", format: "date" },
    ],
    fields: [],
    readOnly: true,
    emptyTitle: "Noch keine weiteren Teammitglieder",
    emptyDescription:
      "Lade Mitarbeitende oder deine Buchhaltung mit der passenden Rolle ein.",
  },
  integrationen: {
    slug: "integrationen",
    title: "Integrationen",
    eyebrow: "Provider & Demo-Modi",
    description:
      "Bank, OCR, Marktdaten, E-Mail und Geocoding modular verbinden.",
    table: "integration_connections",
    columns: [
      { key: "integration_type", label: "Integration", format: "status" },
      { key: "provider", label: "Provider" },
      { key: "mode", label: "Modus", format: "status" },
      { key: "status", label: "Status", format: "status" },
      { key: "last_synced_at", label: "Letzte Synchronisierung", format: "date" },
    ],
    fields: [],
    readOnly: true,
    emptyTitle: "Keine Live-Integration verbunden",
    emptyDescription:
      "Alle Kernflows funktionieren im Demo- oder manuellen Modus. Live-Provider kannst du später ergänzen.",
  },
  "daten-pruefen": {
    slug: "daten-pruefen",
    title: "Daten prüfen",
    eyebrow: "Datenqualität",
    description:
      "Fehlende Belege, unklare Zuordnungen und widersprüchliche Angaben gezielt klären.",
    table: "documents",
    columns: [
      { key: "original_file_name", label: "Datensatz" },
      { key: "review_status", label: "Prüfgrund", format: "status" },
      { key: "document_type", label: "Bereich", format: "status" },
      { key: "updated_at", label: "Aktualisiert", format: "date" },
    ],
    fields: [],
    readOnly: true,
    emptyTitle: "Daten sind vollständig",
    emptyDescription:
      "Derzeit wurden keine offensichtlichen Datenqualitätsprobleme gefunden.",
  },
  einstellungen: {
    slug: "einstellungen",
    title: "Einstellungen",
    eyebrow: "Organisation & Datenschutz",
    description:
      "Profil, Organisation, Datenschutz, Datenexport, Aufbewahrung und Löschanfragen.",
    table: "organizations",
    columns: [
      { key: "name", label: "Organisation" },
      { key: "kind", label: "Art", format: "status" },
      { key: "default_currency", label: "Währung" },
      { key: "tax_year_start_month", label: "Beginn Steuerjahr" },
      { key: "updated_at", label: "Aktualisiert", format: "date" },
    ],
    fields: [],
    readOnly: true,
    emptyTitle: "Organisation nicht gefunden",
    emptyDescription:
      "Bitte lade die Seite neu oder wähle eine andere Organisation.",
  },
};

export function getModuleDefinition(slug: string) {
  return moduleDefinitions[slug] ?? null;
}

export const allowedModuleSlugs = Object.keys(moduleDefinitions);
import type { Database } from "@/types/database";

type PublicTableName = keyof Database["public"]["Tables"];
