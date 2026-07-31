# Architektur

## Überblick

Estate Brain ist eine Next.js-Anwendung mit serverseitigem Datenzugriff auf Supabase. PostgreSQL und Row Level Security bilden die verbindliche Sicherheitsgrenze zwischen Organisationen.

```text
Browser
  │
  ├─ öffentliche Seiten und /demo
  │
  └─ authentifizierte App
       │
       ▼
Next.js Proxy (Session-Aktualisierung)
       │
       ▼
Server Components / Server Actions / Route Handler
       │
       ├─ Auth- und Rollenprüfung
       ├─ Zod-Validierung
       └─ organisationsbezogener Data Access
              │
              ▼
Supabase Auth + PostgreSQL/RLS + privater Storage
```

## Schichten

### Oberfläche

`src/app/` enthält öffentliche Seiten, Auth-Flows, Onboarding, die geschützte Anwendung, das Mieterportal und Route Handler. Wiederverwendbare UI liegt in `src/components/`.

Der öffentliche Demo-Bereich arbeitet mit statischen, fiktiven Daten. Die geschützte Anwendung bezieht ihre Daten ausschließlich aus der aktuell autorisierten Organisation.

### Authentifizierung und Autorisierung

Die Supabase-Session wird im Next.js Proxy aktualisiert. Serverseitige Datenzugriffe ermitteln den Benutzer aus verifizierten Auth-Claims. Der Cookie `estatebrain_org` speichert nur die gewünschte Organisationsauswahl für die Oberfläche; die tatsächliche Mitgliedschaft wird bei jeder geschützten Operation erneut geprüft.

Die Berechtigungskette ist:

1. gültige Supabase-Session,
2. aktive Organisationsmitgliedschaft,
3. passende Anwendungsberechtigung für die Rolle,
4. RLS-Policy in PostgreSQL.

Server Actions und API-Routen sind als öffentliche Eingänge zu behandeln: Eingaben werden validiert, IDs nicht ungeprüft übernommen und Organisationsbezüge serverseitig ergänzt.

### Datenzugriff

Serverseitige Data-Access-Funktionen kapseln mandantenbezogene Abfragen. UI-Komponenten erhalten nur die Daten, die sie tatsächlich darstellen. Fachlogik und Berechnungen liegen unabhängig von React in `src/lib/domain/` und sind dadurch deterministisch testbar.

Geldbeträge werden in der Datenbank und Fachlogik als ganzzahlige Cent-Werte geführt. Flächen und Prozentsätze verwenden geeignete numerische Typen. Steuer- und Prognosewerte behalten ihre Annahmen und einen fachlichen Disclaimer.

### Datenmodell

Das Schema ist in fachliche Bereiche gegliedert:

- Identität: Profile, Organisationen, Mitgliedschaften und Einladungen
- Bestand: Immobilien, Zuweisungen, Einheiten, Mieter und Mietverhältnisse
- Miete und Buchhaltung: Mietpläne, Sollstellungen, Zahlungen, Einnahmen und Ausgaben
- Banking: Verbindungen, Konten, Transaktionen und bestätigte Zuordnungen
- Dokumente: Metadaten, Extraktionen, Verknüpfungen und privater Storage
- Planung: Darlehen, Bewertungen, Marktvergleiche, Sanierungen und Rücklagen
- Zusammenarbeit: Gespräche, Nachrichten, Vorgänge, Aufgaben, Kommentare und Benachrichtigungen
- Governance: Steuerprofile, Integrationen und unveränderlich nachvollziehbare Audit-Ereignisse

Jede mandantenbezogene Zeile besitzt einen eindeutigen Organisationsbezug oder leitet ihn über eine geschützte Beziehung ab. Indizes unterstützen die häufigen Filter nach Organisation, Status und Zeitraum.

### Dokumente

Uploads akzeptieren nur die vorgesehenen Dateitypen und Größen. Der Storage-Bucket ist privat; der Objektpfad enthält den Organisationskontext. Downloads werden erst nach Authentifizierung und Autorisierung als kurzlebige signierte URL ausgegeben. Eine Datenbankzeile allein gewährt keinen Storage-Zugriff.

### Integrationen

Open Banking, E-Mail, OCR, Markt- und Geodaten sind über optionale, serverseitige Adapter vorgesehen. Fehlende Zugangsdaten führen nicht zu erfundenen Ergebnissen: Die Oberfläche bleibt bei manuellen oder ausdrücklich als Demo bezeichneten Abläufen.

## Sicherheitsinvarianten

- Keine privilegierten Schlüssel in `NEXT_PUBLIC_*` oder im Client-Bundle.
- Kein mandantenbezogener Zugriff allein auf Basis einer URL-, Formular- oder Cookie-ID.
- RLS bleibt für alle Data-API-Tabellen aktiviert.
- Der Service-Schlüssel wird nicht für normale Nutzerabfragen verwendet.
- Schreiboperationen prüfen Rolle und erlaubte Felder serverseitig.
- Private Dokumente werden nicht als öffentliche Storage-URLs ausgeliefert.
- Demo-Daten sind fiktiv und eindeutig markiert.
- Protokolle enthalten keine Zugangsdaten oder vollständigen sensiblen Nutzdaten.

## Erweiterung

Neue Module sollten die bestehende Schichtung beibehalten:

1. Schemaänderung als neue Supabase-Migration mit RLS, Grants, Constraints und Indizes.
2. Fachregeln als reine Funktionen unter `src/lib/domain/`.
3. organisationsgesicherter Data Access oder Route Handler.
4. serverseitig autorisierte Mutation mit Zod-Schema.
5. UI-Komponenten mit minimalem Datenvertrag.
6. Unit-, Sicherheits- und gegebenenfalls Browser-Tests.
