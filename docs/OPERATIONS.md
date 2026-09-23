# Betrieb und Releases

## Release-Ablauf

Ein Release gilt erst als bereit, wenn Anwendung, Schema und Umgebung gemeinsam geprüft wurden.

1. `npm ci` in einem sauberen Checkout ausführen.
2. `npm run check` erfolgreich abschließen.
3. Neue Supabase-Migrationen mit `npx supabase db push --dry-run` prüfen.
4. Datenbank-Backup beziehungsweise Point-in-Time-Recovery des Zielprojekts kontrollieren.
5. Migrationen anwenden und Supabase Security sowie Performance Advisor prüfen.
6. Vercel-Umgebungsvariablen für das Ziel-Environment kontrollieren.
7. Vercel-Deployment auslösen.
8. Produktions-Smoke-Checks durchführen.

Die GitHub-Actions-Pipeline verwendet Node.js 24 und führt Installation, Typecheck, Lint, Unit-Tests und Produktions-Build aus. Ein Merge nach `main` sollte nur bei grüner Pipeline erfolgen.

## Umgebungen

Vercel-Variablen werden getrennt für Development, Preview und Production gepflegt. Mindestens erforderlich sind:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_APP_URL`

Provider- und Wartungsvariablen werden nur gesetzt, wenn die Integration aktiv ist:

- `SUPABASE_SECRET_KEY`
- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`
- `OPEN_BANKING_PROVIDER`
- `OPEN_BANKING_CLIENT_ID`
- `OPEN_BANKING_CLIENT_SECRET`
- `OCR_PROVIDER`
- `OCR_API_KEY`
- `MARKET_DATA_PROVIDER`
- `MARKET_DATA_API_KEY`
- `GEOCODING_API_KEY`
- `INTEGRATION_ENCRYPTION_KEY`
- `CRON_SECRET`

Secrets gehören weder in Git noch in Build-Logs. Werte werden in Vercel und Supabase direkt gepflegt und regelmäßig rotiert.

Für den Steuervergleich sind keine zusätzlichen Secrets notwendig. Er ist ausschließlich unter `/app/steuern/szenarien` verfügbar. Gespeicherte Vergleiche verwenden den vorhandenen Supabase-Client mit Benutzersitzung und RLS. Eine lokale `.env`-Datei ist für Vercel-Deployments nicht erforderlich; die drei Pflichtvariablen werden im jeweiligen Vercel-Environment hinterlegt. Für lokale Anmeldung werden dieselben öffentlichen Konfigurationswerte lokal benötigt, niemals der Secret Key. Die Portfolio-Übersicht bleibt unter `/app/uebersicht` erreichbar. Öffentliche Altlinks zu `/rechner` führen zu den geschützten Steuerszenarien.

## Supabase-Migrationen

Remote-Projekt verbinden:

```bash
npx supabase login
npx supabase link --project-ref <projekt-ref>
```

Änderungen vorab prüfen und anschließend anwenden:

```bash
npx supabase db push --dry-run
npx supabase db push
```

Regeln:

- Bereits remote angewendete Migrationen nicht verändern.
- Jede Schemaänderung als neue, zeitgestempelte Migration anlegen.
- Tabellen immer mit expliziten Grants, RLS-Policies, Constraints und relevanten Indizes veröffentlichen.
- Datenmigrationen wiederholbar oder durch eindeutige Vorbedingungen absichern.
- Löschende oder irreversibel transformierende Änderungen separat sichern und in einer Preview-Umgebung testen.
- Nach dem Rollout Tabellenzugriff für mindestens zwei Organisationen und jede betroffene Rolle gegenprüfen.

Lokale Neuinitialisierung:

```bash
npx supabase start
npx supabase db reset --local --no-seed
```

Die Demo wird durch die Anwendung beziehungsweise eine autorisierte Datenbankfunktion erzeugt; es gibt keinen automatischen Produktions-Seed.

### Steuervergleich

Die Migration `20260922105513_investment_tax_scenarios.sql` ergänzt ausschließlich die Tabelle `investment_scenarios`. Sie speichert versionierte Eingaben, den ausgewählten Abschreibungsweg und den Namen eines Vergleichs je Organisation. Eigentümer, Administratoren und Buchhaltung dürfen diese Planungsdaten lesen und bearbeiten. Persönliche Steuerprofile behalten ihre bestehenden Berechtigungen. Anonyme Benutzer, Mieter, Mitarbeiter und Immobilienverwalter haben keinen Tabellenzugriff; Änderungen der Organisation und der Herkunftsdaten sind für API-Benutzer ausgeschlossen.

Die Eingaben werden vor dem Speichern und nach dem Laden gegen das gemeinsame Schema und die fachliche Validierung geprüft. Geldbeträge liegen als ganze Centbeträge vor. Die Datenbank begrenzt JSON-Dokumente zusätzlich auf 16 KiB. In der Oberfläche werden die 100 zuletzt bearbeiteten Vergleiche geladen.

Den Rollen- und Organisationsschutz mit ausschließlich zurückgerollten Testdaten prüfen:

```bash
npx supabase db query --linked --file supabase/tests/investment_scenarios_rls.sql
```

Der Test prüft Erstellen, Lesen, Ändern und Löschen durch berechtigte Rollen, die Trennung zweier Organisationen, verweigerte Rollen, gesperrte Eigentumsänderungen sowie die JSON-Größenbegrenzung.

## Supabase Auth

Für jede produktive oder geteilte Preview-Umgebung müssen die erlaubten Auth-Redirects im Supabase-Dashboard gepflegt sein. Dazu gehören mindestens:

- `<app-url>/auth/callback`
- `<app-url>/auth/confirm`
- die verwendeten Passwort-Reset- und Einladungsziele

Offene Wildcards nur für bewusst kontrollierte Preview-Domains verwenden. Nach Domainänderungen Registrierung, Login, E-Mail-Bestätigung, Passwort-Reset und Einladung erneut testen.

## Produktions-Smoke-Checks

Nach jedem Release:

- `/`, `/impressum`, `/datenschutz` und `/nutzungsbedingungen` laden
- `/demo` zeigt ausschließlich klar markierte fiktive Daten
- Registrierung, Login, Logout und Passwort-Reset funktionieren
- neuer Benutzer durchläuft das Onboarding
- Organisationswechsel zeigt keine Daten eines anderen Mandanten
- berechtigter Benutzer kann Immobilie, Einheit, Einnahme und Ausgabe erfassen
- unberechtigte Rolle erhält keinen Schreibzugriff
- Dokument-Upload validiert Dateityp und Größe
- Dokument-Download erfordert Zugriff und liefert nur eine kurzlebige URL
- Suche und CSV-Export geben ausschließlich Organisationsdaten aus
- Mieter sieht im Portal nur eigene Daten
- Dashboard lädt ohne Server- oder Browserfehler

Bei aktivierten Integrationen zusätzlich den echten Provider-Healthcheck und einen kontrollierten End-to-End-Test ausführen.

## Beobachtung und Fehleranalyse

Bei einem Fehler zuerst eingrenzen, ob er im Browser, in einer Vercel Function, in Supabase Auth, PostgreSQL oder Storage entsteht.

- Vercel Deployment- und Runtime-Logs auf Request-ID, Route und Status prüfen.
- Supabase Auth-, Postgres- und Storage-Logs im gleichen Zeitfenster prüfen.
- Security Advisor nach neuen RLS-, Grant- oder Function-Hinweisen kontrollieren.
- Performance Advisor und langsame Queries prüfen, bevor Limits erhöht werden.
- Keine sensitiven Formulardaten, Tokens, Dokumentinhalte oder Provider-Secrets in Tickets kopieren.

## Rücknahme

Bei reinem Anwendungscode kann auf das letzte bekannte gute Vercel-Deployment zurückgerollt werden. Datenbankmigrationen werden nicht blind rückwärts ausgeführt. Bei Schema- oder Datenfehlern:

1. Schreibzugriffe auf den betroffenen Ablauf begrenzen.
2. Auswirkung und betroffene Organisationen bestimmen.
3. Forward-Fix als neue Migration bevorzugen.
4. Für Datenwiederherstellung Backup oder Point-in-Time-Recovery in eine getrennte Instanz einspielen und Ergebnis prüfen.
5. Erst danach Produktionsdaten gezielt wiederherstellen.

## Regelmäßige Aufgaben

- Abhängigkeiten und Sicherheitsmeldungen prüfen
- RLS- und Rollenregressionstests nach Berechtigungsänderungen ausführen
- inaktive Einladungen, Integrationen und Sessions kontrollieren
- Storage-Wachstum und fehlgeschlagene Uploads beobachten
- Datenbankgröße, Indizes und langsame Queries überwachen
- Provider-Secrets und Verschlüsselungsschlüssel nach internem Rotationsplan erneuern
- rechtliche Vorlagen und steuerliche Hinweise fachlich aktuell halten


## Somantic und laufende Dateneingabe (23.09.2026)

- Produktion benötigt `SOMANTIC_API_KEY` und `SUPABASE_SECRET_KEY` ausschließlich serverseitig. Bewertungen laufen über `POST https://www.somantic.net/api/estimate`; die Feldregeln entsprechen der [Anbieterdokumentation](https://www.somantic.net/developers/docs).
- Die Jahressperre für Somantic-Bewertungen ist vorerst aufgehoben: Nach einer abgeschlossenen Bewertung kann dieselbe Immobilie sofort erneut bewertet werden, auch nach einer datenarmen Antwort. Jeder Abruf erhält einen eigenen Datensatz in `somantic_valuation_reports`; frühere Berichte bleiben bis zur ausdrücklichen Löschung erhalten. Immobiliensperre und partieller Unique-Index verhindern parallele oder noch unbestätigte Abrufe (`pending`/`uncertain`), unabhängig vom Kalenderjahr. Erneutes Öffnen/Exportieren eines Berichts erzeugt keinen API-Aufruf.
- Die Bewertungshistorie zeigt den aktuellen Marktwert je Immobilie, ohne historische Bewertungen zu addieren. „Manuelle Bewertung“ ergänzt einen eigenen Wert. Berechtigte Nutzer können abgeschlossene Somantic-Berichte und manuelle Bewertungen löschen; der RPC `delete_property_valuation` entfernt Bericht und verknüpften Wert gemeinsam. Die bestehende Projektion übernimmt danach die vorherige Bewertung oder setzt den aktuellen Marktwert auf `null`. Laufende/unbestätigte Anfragen bleiben vor Löschung geschützt.
- Der Bericht erklärt fehlende Kauf- und Mietwerte getrennt anhand der jeweiligen Vergleichsanzahl. Somantic liefert bei weniger als fünf Kauf- bzw. Mietvergleichsobjekten keinen entsprechenden Schätzwert. Der im Popup empfohlene und vorbelegte breitere Vergleich (`comparison_scope=broader`) entfernt ausschließlich `property_type` und `features` aus dem Anbieter-Request; diese Angaben bleiben im Bericht und in den gespeicherten Objektdaten erhalten. Adresse, Haus/Wohnung, Wohnfläche, Zimmer, Baujahr und Vermietung bleiben unverändert. Kein automatischer Zweitabruf und keine Hochrechnung aus unzureichenden Quadratmeterstatistiken.
- Ein bekannter Ablehnungsstatus erlaubt nach einer Minute einen erneuten Versuch. Bei Timeout, Netzfehler oder unklarem Anbieterfehler bleibt der Abruf gesperrt (`uncertain` oder `pending`). Somantic dokumentiert keinen Idempotenzschlüssel und keine Statusabfrage: niemals ungeprüft entsperren oder erneut abrufen. Mit gespeicherter Antwort kann der Service-Only-RPC `finish_somantic_valuation` idempotent die Übernahme abschließen. Ohne Antwort zuerst den Verarbeitungsstand beim Anbieter klären.
- Neue Mietverträge erzeugen monatliche Forderungen und ab Fälligkeit automatisch als eingegangen angenommene Zahlungen. Der tägliche Cron `estatebrain-monthly-rents` holt auch versäumte Monate nach. Für Altverträge beginnt die Automatik im Migrationsmonat. Korrigierte/gelöschte Zahlungseingänge werden nicht wieder automatisch ersetzt. Bankzuordnungen werden im Bankabgleich korrigiert.
- Sanierungskosten werden als eingegebener Gesamtbetrag im Abschlussmonat berücksichtigt. Zugeordnete Belege werden in dieser Cashflow-Berechnung nicht zusätzlich addiert. Allgemeine Ausgaben bleiben an ihrem eigenen Buchungsdatum. Diese Verschiebung ist keine steuerliche Qualifizierung der Sanierung.
- Löschen entfernt Stammdaten aus den aktiven Listen; abhängige aktive Einheiten/Mietverhältnisse müssen zuvor entfernt werden. Beleglöschung archiviert die verknüpfte Ausgabe. Nachweise bleiben erhalten. Änderungszeitpunkte schützen vor dem Überschreiben zwischenzeitlich geänderter Datensätze.
- SQL-Integrationstest ohne bleibende Testdaten: `npx supabase db query --linked --file supabase/tests/lifecycle_somantic.sql`.

- Vertragsmiete und Renditekennzahlen addieren die separat gespeicherte Stellplatzmiete zur Kaltmiete. Der ursprüngliche Kaltmietbetrag wird nicht verändert, damit monatliche Forderungen die Stellplatzmiete nur einmal buchen.
- Der verfügbare Cashflow zieht den Nebenkostenanteil von den bestätigten Mieteinnahmen ab. Die Aufteilung verwendet die historischen Komponenten der Monatsforderung, bei Teilzahlungen anteilig und insgesamt auf deren Nebenkostenbetrag begrenzt. Umlagefähige Ausgaben werden im verfügbaren Cashflow nicht erneut abgezogen; die vollständigen Einnahmen/Ausgaben bleiben in Buchhaltung und Steuergrundlage erhalten. Eingänge ohne zugeordnete Forderung erhalten keinen erfundenen Nebenkostenanteil. Explizit als Nebenkosten kategorisierte Einnahmen werden vollständig herausgerechnet.
