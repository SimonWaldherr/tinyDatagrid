// Short UI documentation; detailed domain rules remain in docs/functions.md.
const rows=`
SUM|values…|Addiert Zahlen und Bereiche.|Adds numbers and ranges.
AVERAGE/AVG|values…|Mittelwert der nichtleeren Werte.|Mean of nonempty values.
MIN/MAX|values…|Kleinster bzw. größter Zahlenwert.|Smallest or largest numeric value.
MEDIAN|values…|Mittlerer Wert der sortierten Zahlen.|Middle value of sorted numbers.
LARGE/SMALL|array; k|k-größter bzw. k-kleinster Wert (ab 1).|kth largest or smallest value (one-based).
COUNT|values…|Zählt nichtleere numerische Werte.|Counts nonempty numeric values.
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
LEN|text|Textlänge in UTF-16-Codeeinheiten.|Text length in UTF-16 code units.
TEXTJOIN|separator; ignoreEmpty; values…|Verbindet Werte mit einem Trennzeichen.|Joins values with a separator.
UPPER/LOWER/PROPER|text|Groß-, Klein- bzw. Wortanfangsschreibung.|Uppercase, lowercase, or initial capitals.
LEFT/RIGHT|text; length=1|Zeichen vom Anfang bzw. Ende.|Characters from the start or end.
MID|text; start; length|Teiltext ab Position 1.|Substring using a one-based position.
FIND/SEARCH|needle; text; start=1|Textposition ab 1; SEARCH ignoriert Großschreibung.|One-based text position; SEARCH ignores case.
SUBSTITUTE|text; old; new; occurrence?|Ersetzt passenden Text, optional nur ein Vorkommen.|Replaces matching text, optionally one occurrence.
REPLACE|text; start; length; replacement|Ersetzt einen Textabschnitt ab Position 1.|Replaces a section at a one-based position.
TEXT|value; format|Formatiert Zahlen als Text mit Dezimalstellen oder Prozent.|Formats numbers as decimal or percentage text.
SUMIF/COUNTIF/AVERAGEIF|range; criteria; values?|Summe, Anzahl oder Mittelwert mit einer Bedingung; COUNTIF hat zwei Argumente.|Sum, count, or mean for one condition; COUNTIF takes two arguments.
SUMIFS/AVERAGEIFS|values; range; criteria; …|Summe bzw. Mittelwert mit mehreren Bedingungen.|Sum or mean with multiple conditions.
COUNTIFS|range; criteria; …|Zählt Werte, die alle Bedingungen erfüllen.|Counts values matching all conditions.
INDEX|array; row=1; column=1|Liest einen Arraywert, Indizes beginnen bei 1.|Reads an array value with one-based indices.
MATCH/VERGLEICH|value; array; matchType=1|Position eines Treffers; 0 wählt exakte Suche.|Position of a match; 0 selects exact matching.
XMATCH|value; array; matchMode=0; searchMode=1|Trefferposition mit Suchrichtung und Vergleichsmodus.|Match position with direction and comparison mode.
VLOOKUP/SVERWEIS|value; table; column; approximate=true|Sucht in der ersten Spalte; false für exakte Suche.|Looks in the first column; false selects exact matching.
HLOOKUP/WVERWEIS|value; table; row; approximate=true|Sucht in der ersten Zeile; false für exakte Suche.|Looks in the first row; false selects exact matching.
XLOOKUP/XVERWEIS|value; lookup; result; missing?; matchMode=0; searchMode=1|Sucht in einem Bereich und liefert den zugehörigen Wert.|Searches one range and returns a corresponding value.
LOOKUP/VERWEIS|value; lookup; result?|Näherungssuche in einem Vektor.|Approximate lookup in a vector.
FILTER|array; include; ifEmpty=""|Filtert Zeilen anhand einer Wahrheitsmaske.|Filters rows using a boolean mask.
UNIQUE|array|Entfernt doppelte Zeilen.|Removes duplicate rows.
SORT|array; column=1; order=1|Sortiert Arrayzeilen, order −1 für absteigend.|Sorts array rows; order −1 is descending.
SEQUENCE|rows=1; columns=1; start=1; step=1|Erzeugt ein Zahlenarray.|Generates a numeric array.
TRANSPOSE|array|Vertauscht Zeilen und Spalten.|Swaps rows and columns.
ROWS/COLUMNS|array|Anzahl der Zeilen bzw. Spalten.|Number of rows or columns.
HSTACK/VSTACK|arrays…|Verbindet Arrays horizontal bzw. vertikal.|Joins arrays horizontally or vertically.
SUMPRODUCT|arrays…|Summe der elementweisen Produkte.|Sum of elementwise products.
LET|name; value; …; expression|Benannte Zwischenwerte innerhalb einer Formel.|Named intermediate values within a formula.
LAMBDA|parameter; …; expression|Definiert eine Funktion innerhalb einer Formel.|Defines a function inside a formula.
MAP|array; lambda|Ruft die Funktion für jede Zeile mit deren Werten auf.|Calls the function for each row's values.
REDUCE/SCAN|initial; array; lambda|Faltet Werte; SCAN liefert alle Zwischenergebnisse.|Folds values; SCAN returns intermediate results.
BYROW|array; lambda|Ruft eine Funktion mit jeder Zeile als Array auf.|Calls a function with each row as an array.
MAKEARRAY|rows; columns; lambda|Array aus einer Funktion mit Zeilen-/Spaltenindex ab 1.|Array from a function of one-based row/column indices.
TODAY/NOW||Heutiges Datum bzw. aktueller Zeitpunkt bei Neuberechnung.|Today's date or current timestamp on recalculation.
DATE|year; month; day|Datum aus Jahr, Monat ab 1 und Tag.|Date from year, one-based month, and day.
YEAR/MONTH/DAY/HOUR/MINUTE/SECOND|date|Liest den jeweiligen lokalen Datums-/Zeitbestandteil.|Reads the named local date/time component.
DATEVALUE|text|Wandelt Text mit JavaScript-Datumsregeln in ein Datum um.|Converts text using JavaScript date parsing rules.
DAYS|end; start|Gerundete Differenz in Tagen.|Rounded difference in days.
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
`;
const catalog=new Map();
for(const row of rows.trim().split('\n')){const [names,args,de,en]=row.split('|');for(const name of names.split('/'))catalog.set(name,{name,signature:`${name}(${args})`,de,en})}
export function functionHelp(name,language='en',custom={}){
  name=String(name).replace(/^=/,'').toUpperCase();const entry=custom[name]||catalog.get(name);
  const fallback=language.startsWith('de')?'Benutzerdefinierte Funktion; keine Beschreibung hinterlegt.':'Custom function; no description provided.';
  return {name,signature:entry?.signature||`${name}(…)`,description:entry?.description||entry?.[language.startsWith('de')?'de':'en']||entry?.en||entry?.de||fallback};
}
export const documentedFunctions=()=>[...catalog.keys()];
