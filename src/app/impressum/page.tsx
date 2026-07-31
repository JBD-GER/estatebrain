import type { Metadata } from "next";

import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Impressum – Estate Brain",
  description:
    "Vorbereitete Impressumsseite für Estate Brain. Die Angaben sind vor Veröffentlichung zu vervollständigen und rechtlich zu prüfen.",
};

const sections: LegalSection[] = [
  {
    heading: "Angaben zum Diensteanbieter",
    paragraphs: [
      "[Vollständiger Name beziehungsweise Firma]\n[Rechtsform, sofern zutreffend]\n[Straße und Hausnummer]\n[Postleitzahl und Ort]\n[Land]",
      "Diese Platzhalter müssen vor Veröffentlichung durch die tatsächlichen Anbieterangaben ersetzt werden.",
    ],
  },
  {
    heading: "Vertretungsberechtigte Person",
    paragraphs: [
      "[Vor- und Nachname der vertretungsberechtigten Person]\n[Funktion, sofern zutreffend]",
    ],
  },
  {
    heading: "Kontakt",
    paragraphs: [
      "E-Mail: [geschäftliche Kontaktadresse]\nTelefon: [Telefonnummer, sofern erforderlich]\nWeitere Kontaktmöglichkeit: [gegebenenfalls eintragen]",
    ],
  },
  {
    heading: "Register- und Steuerangaben",
    paragraphs: [
      "Registergericht: [eintragen, sofern vorhanden]\nRegisternummer: [eintragen, sofern vorhanden]\nUmsatzsteuer-Identifikationsnummer: [eintragen, sofern vorhanden]\nWirtschafts-Identifikationsnummer: [eintragen, sofern vorhanden]",
      "Nicht einschlägige Angaben sind nach rechtlicher Prüfung zu entfernen.",
    ],
  },
  {
    heading: "Verantwortlich für redaktionelle Inhalte",
    paragraphs: [
      "[Vor- und Nachname]\n[ladungsfähige Anschrift]",
      "Nur erforderlich, soweit auf dem Angebot redaktionell-journalistische Inhalte veröffentlicht werden. Die konkrete Pflicht ist rechtlich zu prüfen.",
    ],
  },
  {
    heading: "Verbraucherstreitbeilegung",
    paragraphs: [
      "[Erklärung zur Bereitschaft oder Verpflichtung zur Teilnahme an einem Streitbeilegungsverfahren ergänzen.]",
      "Ob und in welcher Form diese Information erforderlich ist, hängt vom konkreten Anbieter und Geschäftsmodell ab und muss vor Veröffentlichung geprüft werden.",
    ],
  },
  {
    heading: "Hinweis zum Produkt",
    paragraphs: [
      "Estate Brain dient ausschließlich der finanziellen Übersicht und Vorbereitung von Unterlagen. Dargestellte steuerliche Berechnungen sind unverbindliche Schätzungen auf Basis von Nutzereingaben und ersetzen keine Beratung durch einen Steuerberater. Estate Brain erbringt keine Rechts-, Steuer-, Kauf-, Verkaufs- oder Finanzierungsberatung.",
    ],
  },
  {
    heading: "Haftung für Inhalte und Links",
    paragraphs: [
      "Die endgültigen Hinweise zur Verantwortlichkeit für eigene Inhalte sowie für verlinkte externe Angebote sind auf die tatsächlich veröffentlichten Inhalte und Funktionen abzustimmen. Pauschale Haftungsausschlüsse sind rechtlich nicht immer wirksam.",
    ],
  },
  {
    heading: "Urheberrecht",
    paragraphs: [
      "Die in diesem Angebot veröffentlichten Inhalte und Werke unterliegen den jeweils anwendbaren urheberrechtlichen Bestimmungen. Die konkrete Rechteinhaberschaft und zulässige Nutzung von Marken, Texten, Grafiken und Softwarebestandteilen ist vor Veröffentlichung zu dokumentieren.",
    ],
  },
];

export default function ImpressumPage() {
  return (
    <LegalPage
      eyebrow="Rechtliche Anbieterangaben"
      title="Impressum"
      intro="Hier werden die gesetzlich erforderlichen Angaben zum Anbieter von Estate Brain veröffentlicht."
      sections={sections}
    />
  );
}
