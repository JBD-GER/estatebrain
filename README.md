# Estate Brain

Estate Brain ist eine deutschsprachige, mandantenfähige SaaS-Anwendung für die Verwaltung und wirtschaftliche Steuerung von Immobilienportfolios. Sie bündelt Objekt- und Einheitsdaten, Mietverhältnisse, Zahlungsflüsse, Belege, Finanzierungen, Steuerannahmen, Sanierungen, Aufgaben und Kommunikation in einer Oberfläche.

Die Anwendung trennt echte Organisationsdaten konsequent von der öffentlichen, vollständig fiktiven Demo. Steuerliche Auswertungen sind Schätzungen auf Basis transparenter Annahmen und ersetzen keine Steuerberatung.

## Funktionsumfang

- öffentliche Landingpage, Authentifizierung, Einladungen und geführtes Onboarding
- Multi-Tenancy mit Organisationswechsel, Rollenmodell und Row Level Security
- Portfolio-, Immobilien-, Einheiten- und Mietvertragsverwaltung
- Einnahmen, Ausgaben, Sollstellungen und demo-basierter Zahlungsabgleich
- privater Dokument-Upload mit validierten Dateitypen und signierten Downloads
- Finanzierungs-, Steuer-, Sanierungs-, Markt-, Aufgaben- und Kommunikationsmodule
- Dashboard mit Cashflow-, Rendite-, Leerstands- und Finanzierungskennzahlen
- globale Suche sowie CSV-Exporte
- eingeschränktes Mieterportal
- öffentliche Demo unter `/demo` ohne Anmeldung und ohne echte Personen- oder Bankdaten

Externe Anbieter für Team-Einladungen, Open Banking, OCR, Markt- und
Geodaten sind optionale Integrationen. Ohne Provider-Konfiguration bleiben
die entsprechenden Abläufe bewusst als Demo oder manuelle Eingabe
gekennzeichnet. Ein produktiver SMTP-Anbieter für Supabase Auth ist dagegen
für einen öffentlichen Self-Service-Launch erforderlich, damit
Registrierungsbestätigungen und Passwort-Wiederherstellungen zuverlässig
zugestellt werden.

## Technologie

- Next.js 16 mit App Router, React 19 und TypeScript
- Tailwind CSS 4, shadcn/ui und Radix UI
- Supabase für PostgreSQL, Auth, Storage, RPCs und Row Level Security
- Zod und React Hook Form für Eingabevalidierung
- Recharts für Dashboard-Visualisierungen
- Vitest und Testing Library für automatisierte Tests
- Playwright für Browser-Smoke-Tests
- Vercel als Produktionsplattform

Für Details zu Datenfluss und Sicherheitsgrenzen siehe [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Release-, Migrations- und Betriebsabläufe stehen in [docs/OPERATIONS.md](docs/OPERATIONS.md).

## Voraussetzungen

- Node.js 24 empfohlen; mindestens Node.js 22
- npm
- ein Supabase-Projekt oder Docker für die lokale Supabase-Umgebung
- optional: Supabase CLI Login für Remote-Migrationen
- für öffentlichen Self-Service: ein produktiver SMTP-Anbieter in Supabase
  Auth für Bestätigungs- und Wiederherstellungs-E-Mails

Die Supabase CLI ist als Entwicklungsabhängigkeit enthalten und wird über `npx supabase` ausgeführt.

## Lokale Einrichtung

```bash
git clone https://github.com/JBD-GER/estatebrain.git
cd estatebrain
npm ci
cp .env.example .env.local
```

Danach in `.env.local` mindestens diese drei Werte eintragen:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://<projekt-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Die Datenbankmigration kann gegen ein vorhandenes Supabase-Projekt angewendet werden:

```bash
npx supabase login
npx supabase link --project-ref <projekt-ref>
npx supabase db push --dry-run
npx supabase db push
```

Alternativ lässt sich Supabase lokal starten. Da die Demo über Anwendungsdaten beziehungsweise die gesicherte Demo-RPC erzeugt wird und keine statische Seed-Datei benötigt, wird der Seed-Schritt beim Reset übersprungen:

```bash
npx supabase start
npx supabase db reset --local --no-seed
npx supabase status
```

Die von `supabase status` ausgegebenen lokalen API-Daten anschließend in `.env.local` übernehmen. Dann:

```bash
npm run dev
```

Die Anwendung ist unter [http://localhost:3000](http://localhost:3000) erreichbar. Für eine schnelle Produktvorschau ohne Konto kann direkt [http://localhost:3000/demo](http://localhost:3000/demo) geöffnet werden.

## Umgebungsvariablen

Variablen mit `NEXT_PUBLIC_` werden an den Browser ausgeliefert und dürfen keine Geheimnisse enthalten. Alle übrigen Provider-Schlüssel bleiben ausschließlich serverseitig.

| Variable | Erforderlich | Zweck |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ja | öffentliche URL des Supabase-Projekts |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | ja | öffentlicher Supabase Publishable Key |
| `NEXT_PUBLIC_APP_URL` | ja | kanonische App-URL für Links und Auth-Weiterleitungen |
| `NEXT_PUBLIC_LEGAL_READY` | ja | erst nach Ergänzung und Rechtsprüfung der öffentlichen Rechtstexte auf `true` setzen; bis dahin blockiert `robots.txt` die Indexierung |
| `SUPABASE_SECRET_KEY` | optional | privilegierte serverseitige Wartungsabläufe; niemals im Browser verwenden |
| `RESEND_API_KEY` | optional | Versand von Team-Einladungen aus der Anwendung |
| `RESEND_FROM_EMAIL` | optional | verifizierte Absenderadresse für Einladungs-E-Mails |
| `OPEN_BANKING_PROVIDER` | optional | Kennung des Open-Banking-Anbieters |
| `OPEN_BANKING_CLIENT_ID` | optional | serverseitige Client-ID des Banking-Anbieters |
| `OPEN_BANKING_CLIENT_SECRET` | optional | serverseitiges Secret des Banking-Anbieters |
| `OCR_PROVIDER` | optional | Kennung des OCR-Anbieters |
| `OCR_API_KEY` | optional | serverseitiger OCR-Zugang |
| `MARKET_DATA_PROVIDER` | optional | Kennung des Marktdaten-Anbieters |
| `MARKET_DATA_API_KEY` | optional | serverseitiger Marktdaten-Zugang |
| `GEOCODING_API_KEY` | optional | serverseitiger Geocoding-Zugang |
| `INTEGRATION_ENCRYPTION_KEY` | optional | Schlüssel für verschlüsselte Integrationsdaten |
| `CRON_SECRET` | optional | Schutz für geplante serverseitige Jobs |

Die Vorlage [.env.example](.env.example) enthält ausschließlich Platzhalter. `.env.local` und echte Secrets dürfen nicht committet werden.

## Datenbank und Migrationen

Das initiale Schema liegt unter `supabase/migrations/` und umfasst unter anderem:

- Organisationen, Mitgliedschaften, Einladungen und Rollen
- Immobilien, Einheiten, Mieter, Mietverhältnisse und Sollstellungen
- Einnahmen, Ausgaben, Banktransaktionen und Zahlungszuordnungen
- Dokumente, Extraktionen und private Storage-Richtlinien
- Steuern, AfA, Finanzierungen, Bewertungen und Sanierungen
- Kommunikation, Aufgaben, Benachrichtigungen, Integrationen und Audit-Logs

Alle mandantenbezogenen Tabellen sind durch RLS abgesichert. Neue Schemaänderungen werden ausschließlich als zusätzliche Migration angelegt; bereits angewendete Migrationen werden nicht nachträglich verändert.

Für einen sicheren Remote-Rollout immer zuerst `npx supabase db push --dry-run` ausführen. Details und Prüfungen nach einer Migration stehen in [docs/OPERATIONS.md](docs/OPERATIONS.md).

## Rollen und Berechtigungen

| Rolle | Typischer Zugriff |
| --- | --- |
| `owner` | vollständige Organisation, Team, Integrationen, Portfolio und Finanzen |
| `admin` | operative Administration einschließlich Team und Integrationen |
| `property_manager` | Portfolioverwaltung, Dokumente, Aufgaben, Kommunikation sowie Einnahmen, Ausgaben und Sollstellungen; keine Banktransaktionen, Darlehen oder persönlichen Steuerdaten |
| `accounting` | Buchhaltung einschließlich Bankabgleich, Finanzierungen, Steuerübersicht, Dokumente und Exporte |
| `employee` | Portfolio-Lesezugriff, Dokumente, Aufgaben und Kommunikation |
| `tenant` | eigener Portal-, Dokument- und Kommunikationszugriff |

Desktop- und Mobile-Navigation, Schnellzugriffe und Anlage-Aktionen werden aus
demselben Rollenvertrag gefiltert. Sensible Module werden bei fehlender
Berechtigung vor der ersten Datenabfrage mit einem klaren
`403 · Zugriff verweigert` beendet. Verbindlich durchgesetzt werden Zugriffe
zusätzlich in Server Actions und durch Supabase RLS; ein clientseitig gesetzter
Organisationswert ist nie alleinige Berechtigungsgrundlage.

## Demo

Die öffentliche Route `/demo` verwendet nur fest definierte, als Demo markierte Daten. Namen, Adressen, Kontodaten, Verträge und Kennzahlen sind fiktiv. Es werden dort keine Nutzerdaten gespeichert.

Im Onboarding kann zusätzlich eine Demo-Organisation im angemeldeten Mandanten erzeugt werden. Diese Daten unterliegen denselben RLS-Regeln wie reguläre Organisationsdaten und sind klar als Demo gekennzeichnet.

## Skripte

| Befehl | Beschreibung |
| --- | --- |
| `npm run dev` | lokalen Next.js-Entwicklungsserver starten |
| `npm run build` | optimierten Produktions-Build erstellen |
| `npm run start` | zuvor erstellten Produktions-Build starten |
| `npm run typecheck` | TypeScript ohne Ausgabe prüfen |
| `npm run lint` | ESLint ausführen |
| `npm run test` | Vitest-Testlauf ausführen |
| `npm run test:watch` | Vitest im Watch-Modus starten |
| `npm run test:e2e` | Playwright-Browser-Tests ausführen |
| `npm run check` | Typecheck, Lint, Unit-Tests und Build nacheinander ausführen |

## Deployment auf Vercel

1. Repository in Vercel importieren und als Framework `Next.js` verwenden.
2. Die drei erforderlichen öffentlichen Variablen für Production und Preview setzen.
3. Nur tatsächlich aktivierte Provider-Secrets serverseitig ergänzen.
4. In Supabase unter Auth die Produktionsdomain und gegebenenfalls die Preview-Domains als erlaubte Redirect-URLs eintragen.
5. Vor dem Produktions-Rollout die Migration per Dry Run prüfen und anwenden.
6. Deployment auslösen und die Smoke-Checks aus [docs/OPERATIONS.md](docs/OPERATIONS.md) durchführen.

Vercel baut das Projekt mit `npm run build`. Pushes und Pull Requests werden zusätzlich über `.github/workflows/ci.yml` mit Node.js 24 geprüft.

## Sicherheit und fachliche Hinweise

- Geldbeträge werden als ganzzahlige Cent-Werte gespeichert und berechnet.
- Dokumente liegen in privaten Storage-Buckets; Downloads erfolgen zeitlich begrenzt über signierte URLs.
- Mutationen validieren Eingaben und prüfen Organisation sowie Rolle serverseitig.
- RLS ist die letzte, verbindliche Mandantengrenze in der Datenbank.
- Die Anwendung zeigt steuerliche Berechnungen und Prognosen nur als unverbindliche Schätzungen.
- Rechtstexte im Projekt sind Vorlagen und vor einem produktiven Einsatz fachlich zu prüfen.

## Lizenz

Privates Projekt. Alle Rechte vorbehalten.
