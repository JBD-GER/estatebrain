# Immobilien-Steuervergleich

Fachlicher Prüfstand: **23. September 2026**. Implementierung: `src/lib/domain/investment-tax.ts`. Referenz- und Grenzfalltests: `tests/domain/investment-tax.test.ts`.

## Zweck und Grenzen

Der Rechner vergleicht Abschreibungsalternativen für ein vollständig wohnwirtschaftlich genutztes Erwerbsobjekt. Er berechnet **Abzugsbeträge und deren vereinfachte Einkommensteuerwirkung**, ergänzend einen laufenden Cashflow auf Basis eingegebener Miet- und Finanzierungsannahmen. Keine Rendite- oder Erstattungszusage. Einkommensteuerprogression, Soli, Kirchensteuer, Verlustverrechnungsbeschränkungen, diskontierte Gegenwartswerte und Änderungen der Steuersätze sind nicht enthalten. In jedem Kalenderjahr gilt der eingegebene Grenzsteuersatz. Es werden ausreichend steuerpflichtige Einkünfte und gegebenenfalls sofortiger Verlustausgleich angenommen.

Für die Eigennutzung gilt keine normale Gebäude-AfA; ein bestätigtes Baudenkmal kann gesondert nach § 10f modelliert werden. Gewerbe, gemischte Nutzung, verbilligte Vermietung, wechselnde Nutzung, Erbschaft/Schenkung, historische Fördermodelle, individuelle Restnutzungsdauergutachten, spätere Zuschussänderungen und eigene Herstellungsfälle benötigen eine individuelle Berechnung. Zukunftsjahre schreiben den geprüften Rechtsstand fort und prognostizieren keine Gesetzesänderung.

## Eingaben und Schnittstelle

Der Vergleich ist ausschließlich unter Steuerübersicht → Szenarien & Abschreibung (`/app/steuern/szenarien`)
für Rollen mit Steuerzugriff verfügbar. Vorhandene Immobilien können als
editierbare Vergleichsszenarien übernommen werden. Dabei werden Kaufpreis,
Kaufnebenkosten, Grundstücksanteil und tatsächliches Anschaffungsdatum verwendet.
Wenn nur das Baujahr bekannt ist, werden ausschließlich in einem früheren Jahr
fertiggestellte Bestandsobjekte übernommen; der ausdrücklich angezeigte
01.01.-Platzhalter verändert dann weder AfA-Satz noch Anschaffungsmonate.
Vermietung, Grenzsteuersatz und Laufzeit bleiben gekennzeichnete Modellannahmen.
Unvollständige Daten sowie Neubauten ohne genaues Fertigstellungsdatum benötigen
eine manuelle Eingabe. Änderungen an Szenarien verändern keine Immobilien-Stammdaten.

`calculateInvestmentTax(input)` liefert die Kostenaufteilung, Zulässigkeitsprüfungen, die jeweils verfügbaren Alternativen, Jahreswerte, Hinweise und Quellen. `validateInvestmentTaxInput(input)` liefert Feldfehler ohne Umdeutung der Werte. Die Berechnung wirft bei ungültigen Eingaben einen `DomainValidationError`; unbestätigte Förderbedingungen erzeugen stattdessen nachvollziehbare Ausschlussgründe.

- Geldbeträge sind sichere, ganzzahlige **Eurocent**. Quoten sind Dezimalwerte: `0.42` bedeutet 42 %, `0.2` bedeutet 20 %.
- ISO-Kalenderdaten benötigen Format `YYYY-MM-DD`; unmögliche Daten werden verworfen. Das Anschaffungsdatum bezeichnet den wirtschaftlichen Übergang, nicht das Datum des Kaufvertrags.
- Der Zeitraum umfasst 1–60 Kalenderjahre ab dem Anschaffungsjahr. Erstes und letztes Jahr können deshalb von einer Zahl voller Haltedauerjahre abweichen.
- `certifiedHeritageCostsCents` ist ein **bereits enthaltener Teil** der Gebäudekosten, netto nach öffentlichen Zuschüssen. Er wird niemals ein zweites Mal zur Investition addiert. Sein eigenes Abschlussdatum ist erforderlich.
- `capitalizedMeasuresCents` enthält nur zusätzliche Gebäudemaßnahmen, die weder im Kaufpreis noch in den Kaufnebenkosten enthalten sind. Sie werden netto nach Zuschüssen eingegeben und gelten außer gesondert datierten Denkmalmaßnahmen bei AfA-Beginn als abgeschlossen. Die Abgrenzung von sofort abziehbarem Erhaltungsaufwand ist eine fachliche Eingabe, keine automatische Prüfung der 15-%-Regel.
- Wohn-/Nutzfläche für § 7b ist die für das vollständig begünstigte Objekt maßgebliche Fläche. Für die gesetzliche Flächenabgrenzung sind BMF-Randnummern 49–60 heranzuziehen; gemischte oder teilweise begünstigte Objekte werden nicht automatisch aufgeteilt.

Alle Bestätigungen beginnen mit `false`. Checkboxen sind vom Nutzer gelieferte Annahmen und keine behördliche Entscheidung.

## Kostenaufteilung

```text
Gebäudekaufpreis       = Kaufpreis − Grundstücksanteil des Kaufpreises
Gebäudenebenkosten     = Nebenkosten − Grundstücksanteil der Nebenkosten
AfA-Gebäudebasis       = Gebäudekaufpreis + Gebäudenebenkosten + zusätzliche Maßnahmen
Reguläre Denkmalbasis  = AfA-Gebäudebasis − enthaltene bescheinigte Denkmalkosten
```

Grund und Boden samt zugehörigen Nebenkosten sind nicht abschreibbar. Der eingegebene Grundstücksanteil wird proportional auf allgemeine Nebenkosten angewandt. Direkt einem Wirtschaftsgut zuordenbare Nebenkosten und die sachgerechte Kaufpreisaufteilung müssen vorab geklärt werden. [BMF-Schreiben vom 21.05.2025, Rn. 38–47](https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Steuerarten/Einkommensteuer/2025-05-21-anwendungsschreiben-7b-estg-neu.pdf?__blob=publicationFile&v=5).

## Normale und degressive AfA

Die lineare AfA hängt vom ursprünglichen Fertigstellungsdatum ab: vor 1925 jährlich 2,5 %, von 1925 bis einschließlich 2022 jährlich 2 %, ab 2023 jährlich 3 %. Die Bezeichnung „Bestand“ oder „Denkmal“ ändert diesen Satz nicht. Abschreibungsbeginn ist frühestens die spätere von Anschaffung und Fertigstellung. Im ersten Kalenderjahr zählen die Monate ab einschließlich dieses Monats. Auch die degressive AfA wird im ersten Jahr monatsanteilig gekürzt. [§ 7 Abs. 1, 4 und 5a EStG](https://www.gesetze-im-internet.de/estg/__7.html).

5 % degressive AfA erscheinen nur für bestätigte, zur Vermietung vorgesehene EU-/EWR-Neubau-Erwerbsfälle: rechtswirksamer Kaufvertrag vom 01.10.2023 bis 30.09.2029, Erwerb des fertigen Neubaus spätestens am Ende seines Fertigstellungsjahres. Ein Hersteller mit maßgeblicher Baubeginnsanzeige wird in dieser Erwerbsoberfläche nicht abgebildet. Die Jahresabschreibung folgt dem verbleibenden Wert. Der Nutzer kann den dauerhaften Wechsel zur linearen Restwert-AfA nach sechs Steuerjahren wählen (einschließlich eines anteiligen ersten Jahres), den günstigeren jährlichen Abzug automatisch abwarten oder durchgehend degressiv rechnen. Bei Auswahl eines neuen Neubaus ist der Wechsel nach sechs Steuerjahren voreingestellt. Sechs Jahre sind keine gesetzliche Pflicht. Nach dem Wechsel gilt Restwert geteilt durch Restnutzungsdauer, nicht 3 % der ursprünglichen Basis. [§ 7 Abs. 5a EStG](https://www.gesetze-im-internet.de/estg/__7.html).

Für die Restwertverteilung verwendet das Modell 33, 40 oder 50 Jahre ab ursprünglichem AfA-Beginn, vermindert um die bereits verstrichene Zeit einschließlich der Erstjahresmonate. 33 Jahre folgen der Verwaltungskonvention der Restwert-AfA; die reine lineare 3-%-AfA läuft unabhängig davon bis zum vollständigen Verbrauch der Basis. Der Modellwechsel ist keine Feststellung einer individuellen tatsächlichen Nutzungsdauer. [R 7a Abs. 9 EStR](https://esth.bundesfinanzministerium.de/esth/2025/A-Einkommensteuergesetz/II-Einkommen-2-24b/3-Gewinn-4-7i/Paragraf-7a/inhalt.html).

## Sonderabschreibung § 7b

Die Förderung muss aktiviert und ihre weiteren Voraussetzungen bestätigt sein. Dazu gehören eine neue begünstigte Wohnung, ein zulässiger Standort, entgeltliche dauerhafte Wohnnutzung im Anschaffungsjahr und den neun folgenden Jahren sowie gegebenenfalls beihilferechtliche Voraussetzungen. Bei Erwerb wird der fertige Neubau im Fertigstellungsjahr angeschafft.

| Bauantrag/Bauanzeige | Ausschluss bei Gebäudekosten über | Maximale Förderbasis | Weitere Regel |
| --- | ---: | ---: | --- |
| 01.09.2018–31.12.2021 | 3.000 €/m² | 2.000 €/m² | Letztmals im Steuerjahr 2026 |
| 01.01.2023–30.09.2029 | 5.200 €/m² | 4.000 €/m² | EH40 mit Nachhaltigkeits-Klasse und QNG |

Die Kostenobergrenze ist eine Ausschlussgrenze, kein Freibetrag. Die Förderbasis ist höchstens die tatsächliche Gebäudebasis. Modelliert werden viermal bis zu 5 % der Förderbasis; der Höchstsatz wird ausgeschöpft und im Erstjahr nicht monatsanteilig gekürzt. Die normale AfA läuft zusätzlich. Ab dem fünften Jahr wird der Restwert neu verteilt. Ein schädlicher Nutzungswechsel, Verkauf oder eine spätere Grenzüberschreitung kann Rückabwicklung auslösen. [§ 7b EStG](https://www.gesetze-im-internet.de/estg/__7b.html), [§ 52 Abs. 15a EStG](https://www.gesetze-im-internet.de/estg/__52.html).

**Entscheidendes Detail bei degressiver AfA plus § 7b:** In den ersten vier Jahren mindern die Sonderabschreibungen die laufende degressive Bemessungsgröße noch nicht. Erst ab Jahr fünf werden sie beim Restwert berücksichtigt. Der amtliche Fall mit 1.000.000 € Basis ergibt regulär 50.000 €, 47.500 €, 45.125 €, 42.868,75 €, danach 30.725,31 €; parallel fallen viermal 50.000 € Sonderabschreibung an. Ein Referenztest sichert diesen Verlauf. Im Altfall endet die Förderung gegebenenfalls bereits 2026; die Umstellung der regulären AfA bleibt trotzdem nach dem vierjährigen Begünstigungszeitraum. [BMF-Schreiben, Rn. 61–66 und Beispiel 7](https://www.bundesfinanzministerium.de/Content/DE/Downloads/BMF_Schreiben/Steuerarten/Einkommensteuer/2025-05-21-anwendungsschreiben-7b-estg-neu.pdf?__blob=publicationFile&v=5).

## Denkmal

Für vermietete Denkmale werden begünstigte, bescheinigte Kosten ab dem Jahr des Maßnahmenabschlusses acht Jahre mit 9 % und anschließend vier Jahre mit 7 % berücksichtigt. Der andere Gebäudeanteil erhält normale AfA. Erforderlich sind unter anderem ein inländisches Denkmal, behördliche Abstimmung und Bescheinigung, Zuschussabzug sowie bei Anschaffung begünstigte Maßnahmen nach dem rechtswirksamen Erwerbsvertrag. Vor 2004 abgeschlossene Maßnahmen sind im aktuellen Modell ausgeschlossen. [§ 7i EStG](https://www.gesetze-im-internet.de/estg/__7i.html).

Bei Eigennutzung werden zehn Jahresbeträge zu 9 % als Sonderausgaben modelliert, zusammen höchstens 90 %. Die weitere persönliche Begünstigung einschließlich Objektbeschränkung und Ausschluss doppelter Förderung ist ausdrücklich zu bestätigen. Der verbleibende Kostenbetrag ist bei § 10f **kein steuerlicher Buchwert**. [§ 10f EStG](https://www.gesetze-im-internet.de/estg/__10f.html).

Denkmal- und §-7b-Begünstigungen werden im Rechner nicht kombiniert. Innerhalb der Denkmalalternative gibt es keine normale AfA zusätzlich auf dieselben bescheinigten Kosten. Die alternative normale Abschreibung dieser Kosten beginnt ebenfalls frühestens mit Maßnahmenabschluss. [§ 7a Abs. 5 EStG](https://www.gesetze-im-internet.de/estg/__7a.html).

## Geldbeträge, Vergleich und Tests

Die Berechnung rundet auf ganze Cent. Die Summe der Jahresentlastungen entspricht der angezeigten kumulierten Entlastung; jeder Kostenbestand sinkt höchstens bis null. Bei Denkmalkosten wird kumulativ gerundet, damit volle 100 % beziehungsweise 90 % auch bei ungeraden Centbeträgen erhalten bleiben.

`recommendedScenarioId` benennt lediglich die größte modellierte Steuerentlastung unter den bestätigten zulässigen Alternativen innerhalb des gewählten Zeitraums. Das ist keine Investitionsempfehlung. Bei vollständiger Abschreibung wird vielfach nur der Zeitpunkt desselben Gesamtabzugs verschoben.

Die automatisierten Tests prüfen amtliche Zahlenbeispiele, Grundstücksnebenkosten, Stichtage, Erstjahresmonate, Fördergrenzen, fehlende Bestätigungen, §-7b-Restwertumstellung, Methodenwechsel, Maßnahmenabschluss, Eigennutzung, Denkmallaufzeiten, die Begrenzung auf die Basis und die Erhaltung sämtlicher Centbeträge.

## Bestehende Portfolio-Erfassung

Die normale Immobilienerfassung und das Onboarding teilen allgemeine Kaufnebenkosten ebenfalls proportional auf. `landValueCents` bleibt aus Kompatibilitätsgründen der Grundstücksanteil des reinen Kaufpreises. `totalLandValueCents` enthält zusätzlich die Grundstücksnebenkosten; `buildingValueCents` enthält nur den Gebäudekaufpreis mit zugehörigen Nebenkosten. Damit bleibt die Summe beider Teile gleich den gesamten Anschaffungskosten.

Die additive Migration `20260922110423_allocate_property_ancillary_costs.sql` korrigiert die serverseitige Onboarding-Berechnung und den Trigger für künftig automatisch erzeugte AfA-Datensätze. Der `land_share_cents` eines AfA-Datensatzes enthält dort ebenfalls die Grundstücksnebenkosten. Es findet keine pauschale Änderung vorhandener Immobilien, AfA-Anlagen oder manuell aus Steuererklärungen übernommener Abschreibungswerte statt. Ältere automatisch erzeugte Bemessungsgrundlagen sind deshalb fachlich abzugleichen.

Die Migration wurde am 22.09.2026 auf dem verbundenen Projekt angewandt. Referenzabfragen lieferten für 500.000 € Kaufpreis, 57.850 € Nebenkosten und 160.000 € Grundstücksanteil eine Gebäudebasis von 379.338 €. Ein transaktionaler Integrationstest erzeugte eine Immobilie samt automatischem AfA-Datensatz, prüfte die Kostenaufteilung und wurde vollständig zurückgerollt. Die bestehenden Zugriffsbeschränkungen des internen Onboarding-Finalizers und des neuen Rechenhelfers wurden anschließend geprüft.


## Miete, Finanzierung und laufender Cashflow

`src/lib/domain/investment-cashflow.ts` berechnet monatlich und fasst die Ergebnisse nach Kalenderjahr zusammen. Das optionale `cashflow`-Objekt in den gespeicherten Szenarien enthält Kaltmiete, Mietbeginn, jährliche Mietsteigerung, Ausfallquote, laufende Eigentümerkosten sowie Darlehensbetrag, Sollzins, anfängliche Tilgung und Darlehensbeginn. Bestehende Szenarien bleiben ohne diese Angaben gültig; fehlende Beträge entsprechen ausdrücklich 0 €.

Die Miete beginnt frühestens ab Erwerb und Fertigstellung; der Startmonat zählt vollständig. Steigerungen greifen nach jeweils zwölf Monaten ab Mietbeginn. Ein Annuitätendarlehen hält die anfängliche Monatsrate konstant, berechnet Zinsen aus der jeweils verbleibenden Schuld und stoppt die Tilgung bei null. Konstanter Sollzins, keine Anschlussfinanzierung und keine Sondertilgungen sind ausdrückliche Prognoseannahmen.

Bei Vermietung gilt: steuerliches Ergebnis = Kaltmiete nach Ausfall − sofort abziehbare laufende Eigentümerkosten − Zinsen − AfA. Die Tilgung ist kein Werbungskostenabzug. Steuer = Ergebnis × Grenzsteuersatz; ein negatives Ergebnis unterstellt sofort nutzbaren Verlustausgleich. Laufender Cashflow = Miete − Kosten − Zinsen − Tilgung − Steuer. Bei Eigennutzung gibt es keine Miet- oder Zinsabzüge, aber gegebenenfalls den getrennten §-10f-Effekt. [§ 9 EStG](https://www.gesetze-im-internet.de/estg/__9.html).

Nebenkosten werden als durchlaufend angenommen. Rücklagen und aktivierungspflichtige Sanierungen gehören nicht in die monatlichen Eigentümerkosten. Erwerbszahlungen, Eigenkapital, Darlehensauszahlung und Verkauf werden nicht als laufender Cashflow dargestellt. Szenarien verändern weder Mietverträge noch bestehende Finanzierungen. Die AfA-Grafik bleibt ein Vergleich der isolierten Abschreibungswirkung; die zusätzliche Cashflow-Tabelle und der CSV-Export enthalten die Miet- und Finanzierungswerte.
