import type { Metadata } from "next";

import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Datenschutz – Estate Brain",
  description:
    "Vorbereitete Datenschutzhinweise für Estate Brain. Die Angaben sind vor Veröffentlichung zu vervollständigen und rechtlich zu prüfen.",
};

const sections: LegalSection[] = [
  {
    heading: "Verantwortliche Stelle",
    paragraphs: [
      "[Vollständiger Name beziehungsweise Firma]\n[Anschrift]\n[E-Mail-Adresse]\n[Telefonnummer, sofern erforderlich]",
      "Datenschutzbeauftragte Person: [Kontaktdaten eintragen, sofern bestellt oder gesetzlich erforderlich]",
    ],
  },
  {
    heading: "Worum es in diesen Hinweisen geht",
    paragraphs: [
      "Diese Datenschutzhinweise sollen transparent erläutern, welche personenbezogenen Daten beim Besuch der Website und bei der Nutzung von Estate Brain verarbeitet werden. Die endgültige Fassung muss die tatsächlich eingesetzten Dienste, Speicherorte, Auftragsverarbeiter, Fristen und Rechtsgrundlagen abbilden.",
    ],
  },
  {
    heading: "Daten beim Besuch der Website",
    paragraphs: [
      "Beim Aufruf der Website können technisch erforderliche Verbindungsdaten verarbeitet werden, etwa IP-Adresse, Zeitpunkt des Zugriffs, angefragte Ressource, übertragene Datenmenge, Browser- und Geräteinformationen sowie Fehlerprotokolle.",
      "Zweck, Rechtsgrundlage, konkrete Speicherdauer und eingesetzter Hostinganbieter sind vor Veröffentlichung anhand der tatsächlichen Infrastruktur zu ergänzen: [Hostinganbieter, Anschrift, Region und Aufbewahrungsfrist eintragen].",
    ],
  },
  {
    heading: "Registrierung und Kontoverwaltung",
    paragraphs: [
      "Bei Registrierung, Anmeldung, E-Mail-Verifizierung, Passwortwiederherstellung und Profilpflege werden die hierfür erforderlichen Konto- und Kontaktdaten verarbeitet. Dazu können insbesondere Name, E-Mail-Adresse, verschlüsselte Authentifizierungsdaten, Sitzungsinformationen und sicherheitsrelevante Protokolle gehören.",
      "Die konkrete Rechtsgrundlage, Löschfrist und der eingesetzte Authentifizierungsdienst sind einzutragen.",
    ],
  },
  {
    heading: "Nutzung der Immobilienverwaltung",
    paragraphs: [
      "Je nach Nutzung können Daten zu Organisationen, Immobilien, Einheiten, Mietverhältnissen, Kontakten, Zahlungen, Finanzierungen, Aufgaben, Nachrichten, steuerlichen Annahmen und wirtschaftlichen Auswertungen verarbeitet werden. Nutzer dürfen nur solche Daten einstellen, die sie rechtmäßig verarbeiten dürfen.",
      "Besondere Kategorien personenbezogener Daten sollten nur verarbeitet werden, wenn dies für den vorgesehenen Zweck erforderlich und rechtlich zulässig ist.",
    ],
  },
  {
    heading: "Dokumente und Dateispeicherung",
    paragraphs: [
      "Hochgeladene Rechnungen, Verträge, Belege, Bilder und sonstige Dokumente können personenbezogene und vertrauliche Angaben enthalten. In der endgültigen Fassung sind Speicheranbieter, Speicherregion, Zugriffsschutz, unterstützte Dateitypen, Prüfroutinen, Löschfristen und gegebenenfalls eingesetzte Erkennungsdienste konkret zu benennen.",
    ],
  },
  {
    heading: "Bank- und Transaktionsdaten",
    paragraphs: [
      "Bei einer eingerichteten Bankanbindung können Kontobezeichnungen, maskierte Kontoinformationen und Transaktionsdaten verarbeitet werden. Bankzugangsdaten sollen nicht durch Estate Brain gespeichert werden. Die tatsächliche Verarbeitung durch einen Open-Banking-Anbieter, dessen Rolle, Rechtsgrundlage, Speicherort und Laufzeit sind vor Aktivierung der Integration vollständig zu dokumentieren.",
      "Ohne eingerichteten Anbieter werden ausschließlich bereitgestellte Demodaten oder manuell erfasste Vorgänge verwendet.",
    ],
  },
  {
    heading: "Zwecke und Rechtsgrundlagen",
    paragraphs: [
      "Die Verarbeitung kann – abhängig vom konkreten Nutzungskontext – der Vertragserfüllung, vorvertraglichen Maßnahmen, der Erfüllung gesetzlicher Pflichten, berechtigten Interessen oder einer Einwilligung dienen. Für jeden tatsächlichen Verarbeitungsvorgang sind Zweck und passende Rechtsgrundlage nach der DSGVO gesondert festzulegen.",
    ],
    items: [
      "Bereitstellung, Sicherung und Verbesserung der Anwendung",
      "Verwaltung von Nutzerkonten, Organisationen und Berechtigungen",
      "Speicherung und Strukturierung der vom Nutzer eingestellten Daten",
      "Erstellung angeforderter Auswertungen und Exporte",
      "Bearbeitung von Support-, Sicherheits- und Datenschutzanfragen",
    ],
  },
  {
    heading: "Empfänger und Auftragsverarbeiter",
    paragraphs: [
      "Personenbezogene Daten können an vertraglich gebundene Dienstleister übermittelt werden, soweit dies für Hosting, Datenbank, Dateispeicherung, E-Mail-Versand, Fehleranalyse, Zahlungsabwicklung oder optionale Integrationen erforderlich ist. Die tatsächlich eingesetzten Empfänger und Auftragsverarbeiter sind hier vollständig einzutragen: [Liste ergänzen].",
      "Falls Daten außerhalb des Europäischen Wirtschaftsraums verarbeitet werden, müssen Übermittlungsgrundlage und ergänzende Schutzmaßnahmen konkret erläutert werden.",
    ],
  },
  {
    heading: "Speicherdauer und Löschung",
    paragraphs: [
      "Personenbezogene Daten werden nur so lange gespeichert, wie dies für den jeweiligen Zweck erforderlich ist oder gesetzliche Aufbewahrungspflichten bestehen. Die konkreten Fristen für Kontodaten, Fachdaten, Dokumente, Protokolle, Sicherungen und Supportkommunikation sind vor Veröffentlichung festzulegen.",
      "Bei Löschanfragen können rechtliche Aufbewahrungspflichten oder berechtigte Sicherungsinteressen einer sofortigen vollständigen Löschung entgegenstehen. Betroffene Daten sind in diesem Fall angemessen zu sperren oder zu beschränken.",
    ],
  },
  {
    heading: "Cookies und lokale Speicherung",
    paragraphs: [
      "Der Steuervergleich ist nur im angemeldeten Dashboard verfügbar. Berechnungen mit den eingegebenen Annahmen erfolgen im Browser. Erst mit der Funktion „Szenario speichern“ werden Name, Annahmen und gewähltes Abschreibungsmodell in der Datenbank gespeichert, der jeweiligen Organisation zugeordnet und für berechtigte Mitglieder verfügbar. Szenarien können im Bereich „Gespeichert“ wieder gelöscht werden. Der Steuervergleich legt keine Szenarien im lokalen Browserspeicher ab.",
      "Technisch notwendige Cookies oder vergleichbare Speichertechniken können für Anmeldung, Sicherheit und Spracheinstellungen eingesetzt werden. Nicht notwendige Analyse-, Marketing- oder Komfortdienste dürfen erst nach einer wirksamen Einwilligung verwendet werden. Die tatsächlich eingesetzten Technologien und deren Laufzeiten sind hier zu dokumentieren: [Liste ergänzen].",
    ],
  },
  {
    heading: "Rechte betroffener Personen",
    paragraphs: [
      "Betroffene Personen können – abhängig von den gesetzlichen Voraussetzungen – Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch verlangen sowie eine erteilte Einwilligung mit Wirkung für die Zukunft widerrufen.",
      "Anfragen sind an [Datenschutz-Kontaktadresse] zu richten. Darüber hinaus besteht ein Beschwerderecht bei einer zuständigen Datenschutzaufsichtsbehörde: [zuständige Behörde und Kontaktdaten eintragen].",
    ],
  },
  {
    heading: "Datensicherheit",
    paragraphs: [
      "Für Estate Brain sind technische und organisatorische Maßnahmen wie Zugriffsbeschränkungen, Mandantentrennung, sichere Übertragung, geschützte Dateibereiche, Protokollierung administrativer Aktionen und serverseitige Validierung vorgesehen. Die endgültige Erklärung darf nur Maßnahmen nennen, die tatsächlich umgesetzt, dokumentiert und regelmäßig überprüft werden.",
    ],
  },
  {
    heading: "Änderungen dieser Hinweise",
    paragraphs: [
      "Diese Hinweise werden angepasst, wenn sich Funktionen, Dienstleister oder rechtliche Anforderungen ändern. Das Datum der jeweils geltenden Fassung und – bei wesentlichen Änderungen – eine geeignete Information der Nutzer sind vorzusehen.",
    ],
  },
];

export default function DatenschutzPage() {
  return (
    <LegalPage
      eyebrow="Information zum Datenschutz"
      title="Datenschutzhinweise"
      intro="Diese Seite beschreibt als Vorlage, wie personenbezogene Daten beim Besuch und bei der Nutzung von Estate Brain behandelt werden sollen."
      sections={sections}
    />
  );
}
