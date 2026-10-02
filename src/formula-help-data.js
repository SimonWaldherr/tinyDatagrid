// Shared descriptions and argument signatures; consumed by the formula catalog.
export const formulaHelpRows = `
DURATION.CREATE|amount; unit="second"|Zeitspanne mit expliziter Einheit: Stunden, Minuten, Sekunden oder Millisekunden.|Duration with explicit hours, minutes, seconds or milliseconds.
DURATION.SECONDS|duration|Zeitspanne in Sekunden auslesen.|Read duration in seconds.
DECIMAL.PARSE|value|Exakte Dezimalzahl aus eindeutiger Zahl oder Text mit Dezimalpunkt; keine Rundung.|Exact decimal from an unambiguous number or decimal-point text; no rounding.
DECIMAL.ADD|first; second|Addiert zwei Dezimalzahlen exakt.|Adds two decimals exactly.
DECIMAL.SUBTRACT|first; second|Subtrahiert zwei Dezimalzahlen exakt.|Subtracts two decimals exactly.
DECIMAL.MULTIPLY|first; second|Multipliziert zwei Dezimalzahlen exakt.|Multiplies two decimals exactly.
DECIMAL.DIVIDE|first; second; digits=18; mode="half-up"|Dezimaldivision mit expliziter Stellenzahl und Rundungsregel.|Decimal division with explicit precision and rounding mode.
DECIMAL.ROUND|value; digits=0; mode="half-up"|Rundet dezimal: half-up, half-even, toward-zero oder away-zero.|Decimal rounding: half-up, half-even, toward-zero or away-zero.
DECIMAL.FORMAT|value|Exakte Dezimalzahl als Text ohne Genauigkeitsverlust.|Exact decimal as text without precision loss.
DECIMAL.NUMBER|value|Konvertiert nur dann in Number, wenn keine Stellen verloren gehen.|Converts to Number only when no digits are lost.
MANDELBROT|real; imaginary; maxIterations=200|Optional: Fluchtiteration (maximal 10000), oder das Limit bei nicht entkommenen Punkten.|Optional: escape iteration (up to 10000), or the limit for points that did not escape.
SUM|values…|Addiert Zahlen und Bereiche.|Adds numbers and ranges.
AVERAGE/AVG|values…|Mittelwert der nichtleeren Zahlen; ohne Werte #N/A.|Mean of nonempty numbers; no values gives #N/A.
MIN/MAX|values…|Kleinster bzw. größter Zahlenwert.|Smallest or largest numeric value.
MEDIAN|values…|Mittlerer Wert der sortierten Zahlen.|Middle value of sorted numbers.
LARGE/SMALL|array; k|k-größter bzw. k-kleinster Wert (ab 1).|kth largest or smallest value (one-based).
COUNT|values…|Zählt echte Zahlenwerte einschließlich BigInt und Decimal; keine Textkonvertierung.|Counts actual numbers including BigInt and Decimal, without text conversion.
COUNTA|values…|Zählt nichtleere Werte.|Counts nonempty values.
COUNTBLANK|values…|Zählt leere Werte.|Counts empty values.
ABS|number|Absolutbetrag einer Zahl.|Absolute value of a number.
ROUND|number; digits=0|Rundet auf die angegebene Dezimalstellenzahl.|Rounds to the given decimal places.
ROUNDUP/ROUNDDOWN|number; digits=0|Rundet vom Nullpunkt weg bzw. zum Nullpunkt hin.|Rounds away from or toward zero.
FLOOR/INT/CEIL|number|Ganze Zahl: abwärts (FLOOR/INT), aufwärts (CEIL).|Integer rounding: down (FLOOR/INT), up (CEIL).
SQRT|number|Quadratwurzel.|Square root.
POW/POWER|base; exponent|Potenz einer Zahl.|Raises a number to a power.
MOD|number; divisor|Rest einer Division.|Remainder of division.
SIGN|number|Vorzeichen: −1, 0 oder 1.|Sign: −1, 0 or 1.
IF|condition; yes; no=false|Wertet nur den gewählten Zweig aus.|Evaluates only the selected branch.
IFS|condition; value; …|Wert zur ersten erfüllten Bedingung.|Value for the first true condition.
SWITCH|value; match; result; …; default?|Wählt anhand übereinstimmender Werte.|Selects a result by matching values.
CHOOSE|index; values…|Wählt einen Wert über seinen Index ab 1.|Selects a value by one-based index.
IFERROR/IFNA|value; fallback|Ersatz bei Fehlern bzw. nur bei #N/A.|Fallback for errors, or only #N/A.
AND/OR/XOR|values…|Logisches Und, Oder oder ungerade Anzahl wahrer Werte.|Logical AND, OR, or odd parity of true values.
NOT|value|Kehrt den Wahrheitswert um.|Inverts a boolean value.
TRUE/FALSE||Liefert wahr bzw. falsch.|Returns true or false.
ISBLANK/ISNUMBER/ISTEXT/ISLOGICAL/ISERROR|value|Prüft auf leer, Zahl, Text, Boolean bzw. Formelfehler.|Checks for blank, number, text, boolean, or formula error.
N/VALUE|value|Zahlkonvertierung; VALUE meldet ungültigen Text als Fehler.|Numeric conversion; VALUE reports invalid text as an error.
CONCAT|values…|Verbindet Werte ohne Trennzeichen.|Joins values without a separator.
LEN|text|Textlänge in Unicode-Codepunkten.|Text length in Unicode code points.
TEXTJOIN|separator; ignoreEmpty; values…|Verbindet Werte mit einem Trennzeichen.|Joins values with a separator.
UPPER/LOWER/PROPER|text|Groß-, Klein- bzw. Wortanfangsschreibung.|Uppercase, lowercase, or initial capitals.
LEFT/RIGHT|text; length=1|Zeichen vom Anfang bzw. Ende.|Characters from the start or end.
MID|text; start; length|Teiltext ab Position 1.|Substring using a one-based position.
FIND/SEARCH|needle; text; start=1|Textposition ab 1; SEARCH ignoriert Großschreibung; Position in Unicode-Codepunkten.|One-based text position; SEARCH ignores case; positions use Unicode code points.
SUBSTITUTE|text; old; new; occurrence?|Ersetzt passenden Text, optional nur ein Vorkommen.|Replaces matching text, optionally one occurrence.
REPLACE|text; start; length; replacement|Ersetzt einen Textabschnitt ab Position 1.|Replaces a section at a one-based position.
TEXT|value; format|Formatiert Zahlen als Text mit Dezimalstellen oder Prozent.|Formats numbers as decimal or percentage text.
SUMIF/COUNTIF/AVERAGEIF|range; criteria; values?|Summe, Anzahl oder Mittelwert mit einer Bedingung; COUNTIF hat zwei Argumente.|Sum, count, or mean for one condition; COUNTIF takes two arguments.
SUMIFS/AVERAGEIFS|values; range; criteria; …|Summe bzw. Mittelwert mit mehreren Bedingungen.|Sum or mean with multiple conditions.
COUNTIFS|range; criteria; …|Zählt Werte, die alle Bedingungen erfüllen.|Counts values matching all conditions.
INDEX|array; row=1; column=1|Liest einen Arraywert, Indizes beginnen bei 1.|Reads an array value with one-based indices.
MATCH/VERGLEICH|value; array; matchType=0|Position eines Treffers; Standard: exakte, typgleiche Suche ohne Wildcards.|Position of a match; Default: exact, type-sensitive matching without wildcards.
XMATCH|value; array; matchMode=0; searchMode=1|Trefferposition mit Suchrichtung und Vergleichsmodus.|Match position with direction and comparison mode.
VLOOKUP/SVERWEIS|value; table; column; approximate=false|Sucht in der ersten Spalte; Standard: exakte Suche; true aktiviert Annäherung.|Looks in the first column; Default: exact; true enables approximate matching.
HLOOKUP/WVERWEIS|value; table; row; approximate=false|Sucht in der ersten Zeile; Standard: exakte Suche; true aktiviert Annäherung.|Looks in the first row; Default: exact; true enables approximate matching.
XLOOKUP/XVERWEIS|value; lookup; result; missing?; matchMode=0; searchMode=1|Sucht in einem Bereich und liefert den zugehörigen Wert.|Searches one range and returns a corresponding value.
LOOKUP/VERWEIS|value; lookup; result?|Exakte, typgleiche Suche in einem Vektor.|Exact, type-sensitive lookup in a vector.
FILTER|array; include; ifEmpty=""|Filtert Zeilen anhand einer Wahrheitsmaske.|Filters rows using a boolean mask.
UNIQUE|array|Entfernt doppelte Zeilen.|Removes duplicate rows.
SORT|array; column=1; order=1|Sortiert Arrayzeilen, order −1 für absteigend.|Sorts array rows; order −1 is descending.
SEQUENCE|rows=1; columns=1; start=1; step=1|Erzeugt ein Zahlenarray.|Generates a numeric array.
TEXTSPLIT|text; columnDelimiter; rowDelimiter?|Teilt Text in Spalten und optional Zeilen; erhält leere Felder und Texttypen.|Splits text into columns and optionally rows; preserves empty fields and text types.
CSV.PARSE|text; delimiter=","|Liest CSV mit Anführungszeichen und Zeilenumbrüchen als Texttabelle; fehlende Felder bleiben leer.|Parses quoted CSV including embedded newlines as a text table; missing fields stay blank.
REGEXP_EXTRACTALL|text; pattern; flags="u"|Alle Treffer als Zeilen; Untergruppen als Spalten, sonst vollständige Treffer. Ohne Treffer leer.|All matches as rows; capture groups as columns, or full matches if no groups. Blank if no matches.
GROUPBY|source; rowFields; valueFields; aggregates="SUM"|Gruppiert eine Tabelle mit Kopfzeile; Feldlisten und Berechnungen als Bereiche oder SPLIT-Arrays.|Groups a header-first table; field and aggregate lists may be ranges or SPLIT arrays.
UNPIVOT|source; idFields; fieldName="Field"; valueName="Value"|Behält ID-Spalten; verwandelt übrige Spalten in Feld/Wert-Zeilen einschließlich leerer Werte.|Keeps ID columns; converts other columns to field/value rows, including blank values.
TABLE.JOIN|left; right; leftKeys; rightKeys; mode="inner"|Verknüpft Tabellen mit Kopfzeilen: inner, left, right, full. Typgleiche Schlüssel; leere Schlüssel ohne Treffer.|Joins header-first tables: inner, left, right, full. Type-sensitive keys; blank keys never match.
CHOOSECOLS/CHOOSEROWS|array; indices…|Wählt Spalten bzw. Zeilen. Indizes ab 1; negative zählen vom Ende. Reihenfolge und Wiederholungen bleiben erhalten.|Selects columns or rows. One-based indexes; negative indexes count from the end. Preserves order and repeats.
TAKE/DROP|array; rows; columns?|Behält/entfernt erste Zeilen und optional Spalten; negative Zahlen zählen vom Ende. Leeres Ergebnis ist leerer Text.|Keeps/removes leading rows and optionally columns; negative counts select the end. Empty result is blank text.
TOCOL/TOROW|array; ignoreBlank=FALSE|Flacht einen Bereich zeilenweise zu einer Spalte bzw. Zeile ab; optional ohne leere Werte.|Flattens an array in row order to one column or row; optionally skips blanks.
DATE.SEQUENCE|start; count; unit="day"; step=1|Lokale Kalenderdatumsfolge aus ISO-Datum YYYY-MM-DD oder Datumswert: day, week, month, year. Monatsende wird geklemmt.|Local calendar dates from ISO YYYY-MM-DD or a Date: day, week, month, year. Clamps to month end.
FREQUENCY|values; bins|Häufigkeiten bis einschließlich aufsteigender Klassengrenzen; letzte Zeile zählt Werte darüber. Leere Werte ignoriert.|Counts values up to each increasing bin boundary; last row counts overflow. Ignores blank values.
TRANSPOSE|array|Vertauscht Zeilen und Spalten.|Swaps rows and columns.
ROWS/COLUMNS|array|Anzahl der Zeilen bzw. Spalten.|Number of rows or columns.
HSTACK/VSTACK|arrays…|Verbindet Arrays horizontal bzw. vertikal.|Joins arrays horizontally or vertically.
SUMPRODUCT|arrays…|Summe der elementweisen Produkte.|Sum of elementwise products.
LET|name; value; …; expression|Benannte Zwischenwerte innerhalb einer Formel.|Named intermediate values within a formula.
LAMBDA|parameter; …; expression|Definiert eine Funktion innerhalb einer Formel.|Defines a function inside a formula.
MAP|array; lambda|Ruft die Funktion für jede Zeile mit deren Werten auf.|Calls the function for each row's values.
REDUCE/SCAN|initial; array; lambda|Faltet Werte; SCAN liefert alle Zwischenergebnisse.|Folds values; SCAN returns intermediate results.
BYROW|array; lambda|Ruft eine Funktion mit jeder Zeile als Array auf.|Calls a function with each row as an array.
PIVOT|source; rowField; valueField; aggregate="SUM"; columnField=""; scope="all"|Gruppiert einen Bereich mit Kopfzeile als Pivot-Array. scope="visible" berücksichtigt Filter (direkter Zellbereich erforderlich).|Groups a header-first range into a pivot array. scope="visible" respects filters (requires a direct cell range).
MAKEARRAY|rows; columns; lambda|Array aus einer Funktion mit Zeilen-/Spaltenindex ab 1.|Array from a function of one-based row/column indices.
ENCODEURL/DECODEURL|text|URL-Komponente prozentkodieren bzw. dekodieren, etwa für einen Suchparameter.|Percent-encode or decode a URL component, for example a query parameter.
EDATE/EOMONTH|date; months|Datum um Monate verschieben, Monatsende klemmen; EOMONTH liefert den letzten Tag.|Shift months, clamping to month end; EOMONTH returns the last day.
WEEKDAY|date; type=1|Wochentag: 1 = Sonntag zuerst, 2 = Montag zuerst, 3 = Montag als 0.|Weekday: 1 = Sunday first, 2 = Monday first, 3 = Monday as zero.
WEEKNUM|date; type=1|Kalenderwoche: 1 = Sonntag, 2 = Montag; 21 = ISO-Woche.|Week number: 1 = Sunday, 2 = Monday; 21 = ISO week.
ISOWEEKNUM/DATE.ISOWEEKYEAR|date|ISO-Kalenderwoche bzw. zugehöriges ISO-Wochenjahr.|ISO week number or its ISO week year.
DATEDIF|start; end; unit|Volle Tage D, Monate M, Jahre Y oder Restmonate YM zwischen zwei Daten.|Complete days D, months M, years Y or remaining months YM between dates.
NETWORKDAYS|start; end; holidays?|Arbeitstage inklusive beider Grenzen, ohne Samstag, Sonntag und Feiertagsbereich.|Inclusive workdays excluding Saturday, Sunday and a holiday range.
NETWORKDAYS.INTL|start; end; weekend=1; holidays?|Arbeitstage mit eigener Wochenendmaske, Montag zuerst, z. B. 0000011.|Workdays with a custom weekend mask, Monday first, e.g. 0000011.
WORKDAY|start; days; holidays?|Datum nach positiven oder negativen Arbeitstagen, ohne Starttag.|Date after positive or negative workdays, excluding the start day.
WORKDAY.INTL|start; days; weekend=1; holidays?|Arbeitstage verschieben mit eigener Wochenendmaske und Feiertagen.|Shift workdays with a custom weekend mask and holidays.
DATE.ADD|date; amount; unit="day"|Kalendertage, Wochen, Monate oder Jahre addieren; day, week, month, year.|Add calendar days, weeks, months or years; day, week, month, year.
DATE.DIFF|start; end; unit="day"|Kalendertage oder verstrichene hour, minute, second, millisecond.|Calendar days or elapsed hour, minute, second, millisecond.
DATE.ISO|date|Kalenderdatum als YYYY-MM-DD im lokalen Kalender.|Calendar date as YYYY-MM-DD in the local calendar.
DATE.FORMAT|date; pattern="YYYY-MM-DD"; zone="local"|Tokens YYYY MM DD HH mm ss; Zeitzone local oder UTC, Literale in [Klammern].|Tokens YYYY MM DD HH mm ss; zone local or UTC, literals in [brackets].
DATE.TIMESTAMP|date|Unix-Zeitstempel in Sekunden.|Unix timestamp in seconds.
DATE.FROMTIMESTAMP|seconds|Datum aus Unix-Sekunden, auch mit Nachkommastellen.|Date from Unix seconds, including fractions.
DATE.ISLEAP|year|Prüft das gregorianische Schaltjahr.|Tests for a Gregorian leap year.
TIME|hours; minutes; seconds|Eigener Uhrzeitwert; Stunden 0–23, Minuten 0–59, Sekunden 0 bis unter 60.|Typed clock time; hours 0–23, minutes 0–59, seconds 0 to under 60.
TIMEVALUE|time|HH:mm[:ss] oder Zeitstempel als eigenen Uhrzeitwert lesen.|Read HH:mm[:ss] or a timestamp as a typed clock time.
TIME.FORMAT|time|Uhrzeit als HH:mm:ss; Zahlen sind keine Uhrzeiten.|Clock time as HH:mm:ss; numbers are not clock times.
TIME.ADD|time; amount; unit="hour"|Uhrzeit um hour, minute oder second verschieben, mit Tagesüberlauf.|Shift time by hour, minute or second, wrapping at midnight.
DURATION.FORMAT|seconds|Zeitspanne als HH:mm:ss, auch über 24 Stunden oder negativ.|Duration as HH:mm:ss, including over 24 hours or negative values.
COLOR.RGB|red; green; blue|RGB-Kanäle von 0 bis 255 als #rrggbb.|RGB channels from 0 to 255 as #rrggbb.
COLOR.HSL|hue; saturation; lightness|Farbton in Grad, Sättigung und Helligkeit 0–100 als Hexfarbe.|Hue in degrees, saturation and lightness 0–100 as a hex color.
COLOR.HEX|color|#RGB oder #RRGGBB als normalisierte Hexfarbe.|Normalize #RGB or #RRGGBB to a hex color.
COLOR.RED/COLOR.GREEN/COLOR.BLUE|color|RGB-Kanal von 0 bis 255 aus einer Hexfarbe.|RGB channel from 0 to 255 from a hex color.
COLOR.HUE/COLOR.SATURATION/COLOR.LIGHTNESS|color|Farbton in Grad bzw. Sättigung oder Helligkeit in Prozent.|Hue in degrees, or saturation or lightness in percent.
COLOR.MIX|first; second; weight=0.5|sRGB-Kanäle mischen; Gewicht 0–1 bestimmt den Anteil der zweiten Farbe.|Mix sRGB channels; weight 0–1 sets the second color's contribution.
COLOR.LIGHTEN/COLOR.DARKEN|color; amount|Mit Weiß bzw. Schwarz mischen, Anteil 0–1.|Mix with white or black, amount 0–1.
COLOR.INVERT/COLOR.COMPLEMENT|color|RGB-Kanäle invertieren bzw. HSL-Farbton um 180 Grad drehen.|Invert RGB channels or rotate HSL hue by 180 degrees.
COLOR.LUMINANCE|color|Relative sRGB-Leuchtdichte von 0 bis 1 nach WCAG.|Relative sRGB luminance from 0 to 1 using WCAG.
COLOR.CONTRAST|first; second|WCAG-Kontrastverhältnis von 1 bis 21.|WCAG contrast ratio from 1 to 21.
COLOR.TEXT|background|Schwarz oder Weiß, je nachdem, was höheren Kontrast bietet.|Black or white, whichever gives higher contrast.
COLOR.PALETTE|first; second; count|Farbverlauf mit 2–256 Farben als ausfüllbare Spalte.|Gradient of 2–256 colors as a spillable column.
TODAY/NOW||Heutiges Datum bzw. aktueller Zeitpunkt bei Neuberechnung.|Today's date or current timestamp on recalculation.
DATE|year; month; day|Datum aus Jahr, Monat ab 1 und Tag.|Date from year, one-based month, and day.
YEAR/MONTH/DAY|date|Liest den jeweiligen lokalen Datumsbestandteil.|Reads the named local date component.
HOUR/MINUTE/SECOND|time|Zeitbestandteil aus Datumswert, HH:mm[:ss] oder Uhrzeitwert.|Time component from a Date, HH:mm[:ss], or a typed clock time.
DATEVALUE|text|Liest ISO-Datum YYYY-MM-DD oder ISO-Zeitstempel mit Zeitzone.|Parses ISO YYYY-MM-DD or an ISO timestamp with timezone.
DAYS|end; start|Differenz lokaler Kalendertage: Ende minus Start.|Local calendar-day difference: end minus start.
PI||Kreiszahl π.|The constant π.
EXP/LN|number|Exponentialfunktion zur Basis e bzw. natürlicher Logarithmus.|Exponential with base e, or natural logarithm.
LOG|number; base=10|Logarithmus zur gewählten Basis.|Logarithm with the chosen base.
LTRIM/RTRIM/TRIM|text; characters?|Entfernt äußere Zeichen links, rechts oder beidseitig; Standard: Leerraum.|Removes outer characters on the left, right, or both; defaults to whitespace.
SQUEEZE|text|Entfernt äußeren Leerraum und fasst inneren zusammen.|Trims and collapses internal whitespace.
SUBSTR/SUBSTRING|text; start; length?|Teiltext ab 1; negative Positionen zählen vom Ende.|Substring from 1; negative positions count from the end.
REVERSE|text|Kehrt Unicode-Codepunkte um.|Reverses Unicode code points.
REPEAT|text; count|Wiederholt Text.|Repeats text.
STARTSWITH/ENDSWITH/CONTAINS|text; search|Prüft Anfang, Ende oder enthaltenen Text; Großschreibung zählt.|Checks prefix, suffix, or contained text; case-sensitive.
SPLIT|text; delimiter|Teilt Text in ein einzeiliges Array.|Splits text into a one-row array.
REPLACEALL|text; search; replacement|Ersetzt alle wörtlichen Treffer.|Replaces all literal matches.
PADSTART/PADEND|text; length; fill=" "|Füllt links bzw. rechts bis zur Ziellänge auf.|Pads left or right to the target length.
REGEXP/REGEXTEST/REGEXMATCH|text; pattern; flags="u"|Prüft ein JavaScript-Regex-Muster; Ergebnis ist Boolean.|Tests a JavaScript regex; returns a boolean.
REGEXP_EXTRACT/REGEXEXTRACT|text; pattern; group=0; flags="u"|Erster Treffer oder Gruppe; kein Treffer ergibt #N/A.|First match or capture group; no match gives #N/A.
REGEXP_REPLACE/REGEXREPLACE|text; pattern; replacement; flags="gu"|Regex-Ersetzung; $1 bezeichnet eine Gruppe.|Regex replacement; $1 refers to a capture group.
REGEXP_SPLIT|text; pattern; flags="u"|Teilt Text an Regex-Treffern; Ergebnis ist ein Array.|Splits text at regex matches; returns an array.
GEO.DISTANCE|lat1; lon1; lat2; lon2; unit="km"|Großkreisentfernung auf der Erdkugel; Koordinaten in Grad.|Great-circle distance on a spherical Earth; coordinates in degrees.
GEO.BEARING|lat1; lon1; lat2; lon2|Anfangspeilung in Grad im Uhrzeigersinn ab Norden.|Initial bearing in degrees clockwise from north.
GEO.DESTINATION|lat; lon; bearing; distance; unit="km"|Zielpunkt als Array mit Breitengrad und Längengrad.|Destination as an array of latitude and longitude.
GEOM.DISTANCE|x1; y1; x2; y2|Kartesischer Abstand zwischen zwei Punkten.|Cartesian distance between two points.
GEOM.CIRCLE.AREA/GEOM.CIRCLE.CIRCUMFERENCE|radius|Kreisfläche bzw. Kreisumfang.|Circle area or circumference.
GEOM.RECTANGLE.AREA|width; height|Rechteckfläche.|Rectangle area.
GEOM.TRIANGLE.AREA|base; height|Dreiecksfläche; senkrechte Höhe.|Triangle area using perpendicular height.
GEOM.SPHERE.AREA/GEOM.SPHERE.VOLUME|radius|Kugeloberfläche bzw. Kugelvolumen.|Sphere surface area or volume.
GEOM.POLYGON.AREA/GEOM.POLYGON.PERIMETER|points|Fläche bzw. Umfang eines Polygons aus zwei Spalten x/y.|Area or perimeter of a polygon from two x/y columns.
HASH.SHA256/HASH.FNV1A/HASH.CRC32|value|UTF-8-Hash als Hextext; FNV1A und CRC32 sind nicht kryptografisch.|UTF-8 hash as hex text; FNV1A and CRC32 are noncryptographic.
RANDOM||Zufallszahl von 0 (inklusive) bis 1 (exklusive).|Random number from 0 inclusive to 1 exclusive.
RANDOM.INT|min; max|Gleichverteilte ganze Zahl, beide Grenzen inklusive.|Uniform integer with inclusive bounds.
RANDOM.SEEDED|seed; index=0|Reproduzierbare Zufallszahl für Seed und Index.|Repeatable random number for a seed and index.
RANDOM.NORMAL|mean=0; deviation=1|Normalverteilte Zufallszahl.|Normally distributed random number.
RANDOM.UUID||Zufällige UUID Version 4.|Random version 4 UUID.
RADIANS/DEGREES|angle|Grad in Bogenmaß bzw. Bogenmaß in Grad.|Degrees to radians, or radians to degrees.
SIN/COS/TAN|radians|Sinus, Kosinus bzw. Tangens; Winkel in Bogenmaß.|Sine, cosine, or tangent; angles in radians.
ASIN/ACOS/ATAN|number|Inverse Winkelfunktion; Ergebnis in Bogenmaß.|Inverse trigonometric function; result in radians.
ATAN2|y; x|Richtung in Bogenmaß; y steht vor x.|Direction in radians; y precedes x.
HYPOT|numbers…|Euklidische Norm der Komponenten.|Euclidean norm of the components.
JSON.PARSE|text|Wandelt JSON-Text in ein JSON-Objekt, -Array oder einen Wert um.|Parses JSON text into an object, array or scalar.
JSON.STRINGIFY|value; indent=0|Serialisiert einen Wert oder Bereich als JSON-Text.|Serializes a value or range as JSON text.
JSON.VALID|text|Prüft, ob Text gültiges JSON ist.|Checks whether text is valid JSON.
JSON.TYPE|json; path?|Typ: object, array, string, number, boolean oder null.|Type: object, array, string, number, boolean or null.
JSON.GET|json; path; default?|Liest per Pfad (a.b[0], $..id, [?(@.x>1)]); über Bereiche zeilenweise.|Reads by path (a.b[0], $..id, [?(@.x>1)]); works row by row over ranges.
JSON.HAS|json; path|Prüft, ob ein Pfad existiert.|Checks whether a path exists.
JSON.KEYS|json; path?|Schlüssel eines Objekts (bzw. Indizes eines Arrays) als Spalte.|Object keys (or array indexes) as a column.
JSON.VALUES|json; path?|Werte eines Objekts oder Arrays als Spalte.|Values of an object or array as a column.
JSON.ENTRIES|json; path?|Schlüssel/Wert-Paare als zweispaltige Tabelle.|Key/value pairs as a two-column table.
JSON.LENGTH|json; path?|Anzahl der Elemente, Schlüssel oder Zeichen.|Number of elements, keys or characters.
JSON.SET|json; path; value; …|Kopie mit gesetzten Werten; fehlende Pfade werden angelegt.|Copy with values set; missing paths are created.
JSON.REMOVE|json; path; …|Kopie ohne die angegebenen Pfade.|Copy without the given paths.
JSON.MERGE|json; json; …|Führt Objekte rekursiv zusammen; Arrays werden ersetzt.|Deep-merges objects; arrays are replaced.
JSON.OBJECT|key; value; …|Baut ein Objekt aus Schlüssel/Wert-Paaren oder einem Bereich.|Builds an object from key/value pairs or a range.
JSON.ARRAY|values…|Baut ein Array aus Werten und Bereichen.|Builds an array from values and ranges.
JSON.CONCAT|array; more…|Hängt Arrays und Werte aneinander.|Concatenates arrays and values.
JSON.LOOKUP|value; array; key_path; result_path?; not_found?|Findet ein Element über einen Schlüsselwert (wie XLOOKUP).|Finds an element by key value (like XLOOKUP).
JSON.SORT|array; path?; order=1|Sortiert ein Array stabil, optional nach Pfad.|Stable sort of an array, optionally by path.
JSON.UNIQUE|array; path?|Entfernt doppelte Elemente.|Removes duplicate elements.
JSON.TABLE|json; columns?; header=TRUE; flatten=FALSE|Array von Objekten als Tabelle; füllt mehrere Zellen.|Array of objects as a table; spills across cells.
JSON.FROMTABLE|range; header=TRUE|Bereich als Array von Objekten (Kopfzeile = Schlüssel).|Range as an array of objects (header row = keys).
JSON.FLATTEN|json; max_depth?|Alle Blattwerte als Pfad/Wert-Tabelle.|All leaf values as a path/value table.
`;
