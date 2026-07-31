import type { Metadata } from "next";

import { LegalPage, type LegalSection } from "@/components/marketing/legal-page";

export const metadata: Metadata = {
  title: "Nutzungsbedingungen – Estate Brain",
  description:
    "Vorbereitete Nutzungsbedingungen für Estate Brain. Die Angaben sind vor Veröffentlichung zu vervollständigen und rechtlich zu prüfen.",
};

const sections: LegalSection[] = [
  {
    heading: "Anbieter und Geltungsbereich",
    paragraphs: [
      "Diese Nutzungsbedingungen regeln als Vorlage die Nutzung der Anwendung Estate Brain zwischen [vollständiger Anbieter] und registrierten Nutzern. Sie gelten für die öffentliche Website, registrierte Konten und die innerhalb der Anwendung bereitgestellten Funktionen, soweit keine abweichende Vereinbarung getroffen wird.",
      "Angaben zu Vertragssprache, Kundengruppen, räumlichem Geltungsbereich und einbezogenen Dokumenten sind vor Veröffentlichung zu ergänzen.",
    ],
  },
  {
    heading: "Gegenstand der Anwendung",
    paragraphs: [
      "Estate Brain unterstützt private Immobilieninvestoren bei der Erfassung, Strukturierung und Auswertung wirtschaftlicher Daten. Dazu können insbesondere Immobilien- und Einheitenverwaltung, Einnahmen, Ausgaben, Dokumente, Zahlungszuordnungen, Cashflow-Darstellungen, Finanzierungen, Sanierungsplanung, Kommunikation und Exporte gehören.",
      "Der konkret geschuldete Funktionsumfang ergibt sich aus der jeweils aktuellen Leistungsbeschreibung und dem gegebenenfalls gewählten Tarif.",
    ],
  },
  {
    heading: "Keine Steuer-, Rechts- oder Finanzierungsberatung",
    paragraphs: [
      "Estate Brain dient ausschließlich der finanziellen Übersicht und Vorbereitung von Unterlagen. Steuerliche Darstellungen sind unverbindliche Schätzungen auf Basis der vom Nutzer hinterlegten Daten und Annahmen. Sie ersetzen keine Beratung oder Prüfung durch einen Steuerberater.",
      "Die Anwendung erbringt keine Rechtsberatung und gibt keine verbindlichen Kauf-, Verkaufs-, Anlage- oder Finanzierungsentscheidungen vor. Nutzer müssen fachlich oder rechtlich bedeutsame Ergebnisse eigenständig prüfen beziehungsweise durch entsprechend qualifizierte Personen prüfen lassen.",
    ],
  },
  {
    heading: "Registrierung und Nutzerkonto",
    paragraphs: [
      "Für geschützte Funktionen ist ein persönliches Nutzerkonto erforderlich. Nutzer müssen vollständige und zutreffende Angaben machen, Zugangsdaten vertraulich behandeln und den Anbieter bei Verdacht auf unberechtigte Nutzung unverzüglich informieren.",
      "Regeln zu Mindestalter, Unternehmereigenschaft, E-Mail-Verifizierung, gesperrten Konten und Identitätsprüfung sind vor Veröffentlichung anhand des tatsächlichen Angebots festzulegen.",
    ],
  },
  {
    heading: "Organisationen, Rollen und Einladungen",
    paragraphs: [
      "Berechtigte Nutzer können Organisationen anlegen und weitere Personen mit bestimmten Rollen einladen. Die einladende beziehungsweise administrierende Person ist dafür verantwortlich, Berechtigungen angemessen zu vergeben, aktuell zu halten und nicht mehr erforderliche Zugriffe zu entfernen.",
      "Nutzer dürfen nur auf Daten zugreifen, für die ihnen eine wirksame Berechtigung erteilt wurde. Der Versuch, technische Zugriffsbeschränkungen zu umgehen oder organisationsfremde Daten einzusehen, ist unzulässig.",
    ],
  },
  {
    heading: "Pflichten beim Einstellen von Daten",
    paragraphs: [
      "Nutzer sind für die Rechtmäßigkeit, Richtigkeit und Qualität der von ihnen eingestellten Daten und Dokumente verantwortlich. Sie müssen insbesondere sicherstellen, dass sie personenbezogene Daten von Mietern, Mitarbeitenden, Dienstleistern oder anderen Personen verarbeiten und in Estate Brain speichern dürfen.",
    ],
    items: [
      "Keine rechtswidrigen, schädlichen oder fremde Rechte verletzenden Inhalte einstellen",
      "Keine Schadsoftware, manipulierten Dateien oder unzulässigen automatisierten Zugriffe verwenden",
      "Steuerliche Annahmen und importierte Daten vor Verwendung fachlich prüfen",
      "Erforderliche eigene Sicherungen und gesetzliche Aufbewahrungspflichten beachten",
    ],
  },
  {
    heading: "Dokumente, Importe und Integrationen",
    paragraphs: [
      "Erkannte Dokumentdaten, Kategorisierungsvorschläge, Zahlungszuordnungen und importierte Informationen können unvollständig oder fehlerhaft sein. Nutzer müssen Vorschläge vor einer verbindlichen Weiterverwendung kontrollieren.",
      "Optionale Dienste wie Bank-, Dokumenterkennungs-, E-Mail-, Zahlungs- oder Marktdatenanbieter können eigenen Bedingungen und Datenschutzhinweisen unterliegen. Nicht konfigurierte externe Dienste dürfen als Demo oder vorbereitete Schnittstelle dargestellt werden und stehen erst nach wirksamer Einrichtung als echte Integration zur Verfügung.",
    ],
  },
  {
    heading: "Verfügbarkeit und Änderungen",
    paragraphs: [
      "Der Anbieter bemüht sich um einen sicheren und zuverlässigen Betrieb. Wartung, Sicherheitsmaßnahmen, technische Störungen oder Ereignisse außerhalb des Einflussbereichs können die Verfügbarkeit vorübergehend einschränken.",
      "Konkrete Zusagen zu Verfügbarkeit, Supportzeiten, Wartungsfenstern, Funktionsänderungen und Vorankündigungsfristen sind in der endgültigen Fassung beziehungsweise einer Leistungsbeschreibung festzulegen.",
    ],
  },
  {
    heading: "Vergütung und Zahlungsbedingungen",
    paragraphs: [
      "[Tarife, Preise, Abrechnungsintervalle, Steuern, Zahlungsarten, Verlängerung, Preisänderungen und Folgen fehlgeschlagener Zahlungen eintragen.]",
      "Soweit eine kostenlose Test- oder Demophase angeboten wird, sind deren Umfang, Dauer, Übergang in einen kostenpflichtigen Tarif und Kündigungsmöglichkeiten eindeutig zu beschreiben.",
    ],
  },
  {
    heading: "Nutzungsrechte",
    paragraphs: [
      "Nutzer erhalten für die Vertragsdauer ein einfaches, nicht übertragbares und auf den vereinbarten Zweck beschränktes Recht, Estate Brain über die bereitgestellte Oberfläche zu nutzen. Weitergabe, Vervielfältigung, Umgehung technischer Schutzmaßnahmen oder kommerzielle Unterlizenzierung sind nur mit ausdrücklicher Zustimmung zulässig.",
      "Rechte an vom Nutzer eingestellten Inhalten verbleiben grundsätzlich beim jeweiligen Rechteinhaber. Der Anbieter benötigt die zur technischen Bereitstellung, Sicherung und vertragsgemäßen Verarbeitung erforderlichen Rechte.",
    ],
  },
  {
    heading: "Laufzeit, Kündigung und Datenexport",
    paragraphs: [
      "[Vertragsbeginn, Mindestlaufzeit, Verlängerung, ordentliche Kündigungsfrist und Kündigungsweg eintragen.]",
      "Vor Beendigung des Kontos sollten Nutzer verfügbare Datenexporte durchführen. Zeitraum und Umfang eines nachträglichen Zugriffs, gesetzliche Aufbewahrung, Sperrung und endgültige Löschung sind in der finalen Fassung eindeutig festzulegen.",
    ],
  },
  {
    heading: "Haftung",
    paragraphs: [
      "Regelungen zu Haftung und Gewährleistung müssen auf Anbieter, Zielgruppe, Tarifmodell und anwendbares Recht zugeschnitten werden. Insbesondere dürfen gesetzlich zwingende Haftungstatbestände nicht pauschal ausgeschlossen werden.",
      "Ergebnisse aus Berechnungen, Imports, Erkennung oder Zuordnung sind vor wirtschaftlich, steuerlich oder rechtlich relevanten Entscheidungen durch den Nutzer und gegebenenfalls fachkundige Dritte zu prüfen.",
    ],
  },
  {
    heading: "Datenschutz und Vertraulichkeit",
    paragraphs: [
      "Informationen zur Verarbeitung personenbezogener Daten ergeben sich aus den jeweils geltenden Datenschutzhinweisen. Soweit eine Auftragsverarbeitung vorliegt, ist vor Beginn der entsprechenden Nutzung eine geeignete Vereinbarung abzuschließen.",
    ],
  },
  {
    heading: "Schlussbestimmungen",
    paragraphs: [
      "[Anwendbares Recht, Gerichtsstand – soweit zulässig –, Vertragssprache, Änderungen der Bedingungen, Kommunikationsform und Regelungen zur Streitbeilegung eintragen.]",
      "Die Wirksamkeit von Klauseln, insbesondere gegenüber Verbrauchern, muss vor Veröffentlichung fachkundig geprüft werden.",
    ],
  },
];

export default function NutzungsbedingungenPage() {
  return (
    <LegalPage
      eyebrow="Regeln für die Nutzung"
      title="Nutzungsbedingungen"
      intro="Diese Vorlage beschreibt die grundlegenden Regeln für Konten, Organisationen, Daten und Funktionen innerhalb von Estate Brain."
      sections={sections}
    />
  );
}
