# Formelmodell: Struktur und Entscheidungen

Die [vollständige Übersicht](formula-overview.md) wird aus dem zentralen Katalog erzeugt. Sie enthält jede vorhandene Operation, ihre vier Namen, Argumente, Kurzbeschreibung und Verfügbarkeit. Excel-Kompatibilität ist kein Entwurfsziel. Bestehende Schreibweisen bleiben dort sinnvoll, wo sie verständlich sind.

## Bereits umgesetzt

Eine Funktion hat eine stabile ID, genau eine Berechnung und beliebig viele Namen. `AVERAGE`, `AVG`, `MITTELWERT`, `MOYENNE` und `MEDIA` erreichen dieselbe Implementierung. `POWER`/`POW`, `INT`/`FLOOR`, die Lookup- und Regex-Aliase haben ebenfalls keine separaten Berechnungen mehr.

Der Ablauf ist:

```text
Formeltext → Unicode-Tokenizer → Syntaxbaum
          → Alias auf stabile ID auflösen
          → Auswertungsregel / gemeinsame Implementierung
          → Ergebnis und Abhängigkeiten
```

Die Auflösung erfolgt vor der Auswertung der Argumente. Deshalb wertet `WENN`, `IF`, `SI` oder `SE` nur den ausgewählten skalaren Zweig aus. Dasselbe gilt für Fehlerersatz und die anderen speziell ausgewerteten Konstrukte. Eine bloße Wrapper-Funktion hätte diese Eigenschaft verloren. Für Arraybedingungen gelten die bisherigen Regeln: beide Ergebnisarrays werden vor der elementweisen Auswahl berechnet.

`src/formula-catalog.js` definiert Identität, vier Namen, bestehende Aliase, Kategorie, Auswertungsart und Verfügbarkeit. Gemeinsame Signaturen/Beschreibungen liegen in `src/formula-help-data.js`. Die Berechnungen liegen weiterhin in den Fachmodulen (Kalender, Farben, JSON, Tabellen, Text, Geometrie) bzw. im Kern. Es gibt keine vier Sprachversionen der Berechnungen. Neue Sprachsegmente fehlen nicht stillschweigend: unvollständige Übersetzungen oder Alias-Kollisionen brechen die Kataloginitialisierung ab.

Groß-/Kleinschreibung und Unicode-Normalisierung werden zentral behandelt. Akzentlose Schreibweisen funktionieren zusätzlich, beispielsweise `MÉDIANE` und `MEDIANE`. Spracheinstellungen ändern weder die Bedeutung noch gespeicherte Formeln. Eine Formel darf Sprachen mischen. Textliterale, Feldnamen, JSON-Schlüssel, URLs und Variablen werden nicht übersetzt.

Die Eingabehilfe bietet pro Funktion den Namen der gewählten Sprache an. Signaturhilfe erkennt auch die anderen Namen und alte Aliase. Die Suchliste findet Funktionen über ihre verschiedenen Schreibweisen. Französische und italienische Funktionsnamen sind vollständig vorhanden; ausführliche Hilfetexte verwenden dort derzeit den englischen Text. Das ist eine separate redaktionelle Erweiterung.

Kalendarische Einheiten sind ein eigener, gemeinsamer Enum-Katalog: Singular und Plural in allen vier Sprachen, etwa `day/Tag/jour/giorno`, `year/Jahr/année/anno`. Es wird ausschließlich das Einheitenargument normalisiert. Technische Optionen anderer Funktionen (Regex-Flags, Join-Modi, Pivot-Aggregate, JSON-Pfade, Format-Tokens) behalten vorerst ihre dokumentierte Schreibweise.

`WEB.GET`, `WEB.JSON` und `WEB.STATUS` sowie ihre Sprachaliase werden nur vom App-Adapter bereitgestellt. Der Katalog startet keine Abfragen. Im Browser erscheinen diese Funktionen nicht in den Vorschlägen und können nicht ausgeführt werden. Die App verwendet weiter die native HTTPS-Schnittstelle, Aktivierung, Antwortcache und Neuberechnung. Kurzbefehle besitzen den gemeinsamen Formelkern, aber keinen Web-Adapter.

Benutzerdefinierte Funktionen werden ebenfalls über IDs registriert. Wer eine bekannte Übersetzung überschreibt, überschreibt die gemeinsame Funktion für alle Namen. Zwei Namen derselben ID in einer Registrierung werden als Duplikat abgelehnt, bevor etwas geändert wird. Entfernen eines Overrides stellt die gemeinsame Standardimplementierung wieder her. Bekannte Namen aller vier Sprachen sind damit reserviert; eigene Erweiterungen sollten einen eigenen Namensraum verwenden, etwa `APP.MEINWERT`.

## Kalenderkorrekturen und Migration

| Änderung                      | Verhalten und Migration                                                                                                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATE.DIFF(start; end; unit)` | Liefert Ende minus Start. Bestehende Formeln mit der früheren Reihenfolge müssen ihre ersten beiden Argumente tauschen. `DATEDIF` verwendet bereits Start → Ende.                                                         |
| `DATEVALUE(text)`             | Akzeptiert ISO `YYYY-MM-DD` oder ISO-Zeitstempel mit expliziter Zeitzone. Mehrdeutige Texte wie `02/03/2026` müssen vor der Formel in ein eindeutiges Datum umgewandelt werden.                                           |
| `DATE(year; month; day)`      | Keine automatische Verschiebung ungültiger Kalendertage und keine automatische 1900-Ergänzung bei Jahren unter 100. `DATE(2026;2;30)` meldet einen Fehler; Verschiebungen gehören in `DATE.ADD`.                          |
| `DAYS(end; start)`            | Behält seine ältere Argumentreihenfolge, zählt jetzt lokale Kalendertage korrekt über Sommerzeitgrenzen. Für neue Formeln `DATE.DIFF` verwenden.                                                                          |
| `DATE.SEQUENCE`               | Verwendet jetzt denselben lokalen Kalender wie `DATE.ADD` und `DATE`, statt UTC-Datumswerte mit lokalen Auswertungen zu mischen. Monats-/Jahresschritte beziehen sich auf das Ausgangsdatum; 31.01. → 28./29.02. → 31.03. |

Kalendertage und verstrichene Stunden sind verschiedene Größen. `DATE.DIFF` mit `day` zählt Kalendergrenzen; mit `hour` misst es tatsächliche Zeit. Ein Tag am Sommerzeitwechsel kann 23 oder 25 Stunden haben. Kalenderdaten sind `CalendarDate`, Zeitstempel sind JavaScript-Date-Werte, Uhrzeiten `ClockTime` und Zeitspannen `DurationValue`. Kalenderdaten werden mit ihren Kalenderkomponenten gespeichert. Eine explizite Zeitzone ist für Zeitstempel erforderlich; die Kalenderdarstellung erfolgt lokal, außer bei `DATE.FORMAT(...; ...; "UTC")`.

## Schutzregeln inzwischen umgesetzt

Exakte Dezimaloperationen, getrennte Zeittypen, strukturierte Fehler, Unicode-Codepunkte, exakte Suchstandards, Argumentzahlen und Volatilität sind umgesetzt. Details, Migration und verbleibende Grenzen stehen in [Regeln gegen Tabellenfehler](excel-safety.md). Der Katalog enthält jetzt `arity` und `volatile`; fachliche Argumenttypen werden weiterhin in den gemeinsamen Rechenmodulen geprüft.

## Empfohlene nächste Strukturänderungen

Die folgenden Entscheidungen sind Vorschläge und noch **nicht** implementiert. Sie sollten vor einer stabilen Version in einem zusammenhängenden Schritt erfolgen, jeweils mit Migration und aussagekräftigen Tests.

| Bereich                    | Empfehlung                                                                                                                                                                                         | Grund und Umsetzung                                                                                                                                                                                                                                                                                               |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Namensräume                | Bevorzugte Namen `MATH.*`, `STAT.*`, `TEXT.*`, `LOGIC.*`, `TYPE.*`, `ARRAY.*`, `TABLE.*`, `DATE.*`, `TIME.*`, `DURATION.*`, `COLOR.*`, `JSON.*`, `GEO.*`, `GEOM.*`, `HASH.*`, `RANDOM.*`, `WEB.*`. | Der Katalog hat diese Kategorien bereits. Neue Namen als Aliase hinzufügen; ID und Berechnung bleiben stabil. Sprachlich entsprechend `TEXT.*`, `TEXTE.*`, `TESTO.*`. Autocomplete nach Aufgabe gruppieren. Kurze geläufige Namen weiter akzeptieren.                                                             |
| Wochen                     | Standard Montag=1, ISO-Kalenderwoche.                                                                                                                                                              | Die heutigen numerischen `type`-Optionen sind Excel-Erbe und schwer merkbar. Künftige bevorzugte Funktionen verwenden explizite Optionen; alte Namen können ihre dokumentierten Standards behalten, müssen dann eigenständige Kompatibilitätsoperationen bleiben.                                                 |
| Kalenderdifferenzen        | `DATE.DIFF` für Kalendertage, `DATE.COMPLETE` für volle Monate/Jahre, `INSTANT.DIFF` für verstrichene Sekunden/Stunden.                                                                            | Vermeidet Einheitenabhängigkeit der Kalender-/Zeitstempelinterpretation und die kryptischen D/M/Y/YM-Optionen von `DATEDIF`. Kalender- und Zeitrechnungen erhalten getrennte Implementierungen.                                                                                                                   |
| Kriterien                  | Für neue Formeln bevorzugt `FILTER` plus `SUM`/`AVERAGE`, oder ein Predicate mit `LAMBDA`.                                                                                                         | `SUMIFS` und ähnliche Paare sind schwer lesbar und haben unterschiedliche Argumentreihenfolgen. Bestehende Funktionen behalten; neue Standardbeispiele zeigen den sichtbaren Filter.                                                                                                                              |
| Farben                     | Interner Farbwert mit RGB/HSL/Alpha, dokumentierten Farbräumen; HEX als explizite Ausgabe.                                                                                                         | Heute sind Farben `#rrggbb`-Texte und `COLOR.MIX` mischt sRGB-Kanäle. Für Transparenz und wahrnehmungsnahe Verläufe weitere klar benannte Operationen statt still geänderter Mischregeln. Farbwerte können danach direkt mit Zellformatierungen verbunden werden.                                                 |
| Fehler und leere Arrays    | Strukturierte Fehlerwerte und echte leere Arrays.                                                                                                                                                  | Fehlerobjekte sind umgesetzt. Manche leere Ergebnisse sind weiterhin `""`; echte leere Arrays brauchen noch eine einheitliche Weiterverarbeitung und Anzeige. Anzeige und Export müssen diese Werte explizit abbilden.                                                                                            |
| Signaturen und Validierung | Argumenttypen, optionale Werte, Rückgabetyp, Range-Regel und Volatilität in den Katalog aufnehmen.                                                                                                 | Argumentzahlen und Volatilität stehen im Katalog; Typvalidatoren liegen weiterhin in den Fachmodulen. Ein gemeinsamer definierter Vertrag soll künftig Hilfe, Formular-Builder und Prüfung erzeugen. Summen reduzieren Bereiche, skalare Funktionen rechnen elementweise, Tabellenfunktionen erhalten die Matrix. |
| Web                        | Web als asynchronen Datenanbieter behandeln, Formelberechnung synchron halten.                                                                                                                     | Der bestehende Adapter folgt bereits diesem Muster. Weiterentwicklung: typisierte Zustände Laden/Fehler/Fertig, dokumentbezogene Quellen und kontrollierte Aktualisierung. Netzwerkzugriff bleibt App-Fähigkeit, kein verdeckter Effekt einer normalen Kernfunktion.                                              |

## Umsetzung in sinnvoller Reihenfolge

1. Zentraler Katalog, Sprachauflösung, gemeinsame Kalenderregeln und vollständige Referenz: umgesetzt und getestet.
2. Separate Dezimal-, Fehler-, Datum-/Uhrzeit-/Dauer-Werte und gemeinsame numerische Regeln: umgesetzt. Ein einheitliches Leere-Array-Modell und vollständige deklarative Typverträge folgen.
3. Unicode-Textindex und exakte Suchstandards: umgesetzt. Neue Dateien besitzen eine Formelmodellkennung; alte Formeln müssen anhand der dokumentierten Änderungen geprüft werden.
4. Bevorzugte strukturierte Namen in der Eingabehilfe, Aufgaben-Kategorien und ein Formular-Builder mit Argumentfeldern für das iPhone. Gespeicherte Formeln müssen dafür nicht umbenannt werden.
5. Alpha/Farbräume und erweiterte native Webquellen auf den gemeinsamen Typen aufbauen.

Jede neue Funktion braucht eine ID, einen Eintrag in der Referenz, vier Namen bzw. bewusst identische technische Namen und genau eine Implementierung. Die Prüfsuite überprüft den Katalog gegen alle vorhandenen Kern-Callbacks und testet jede akzeptierte Alias-Schreibweise auf denselben Aufruf. Dokumentation wird mit `npm run docs:formulas` erzeugt; `npm test` erkennt veraltete Übersichten.
