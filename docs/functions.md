# Formula reference: dates, times, colors, geo, geometry, hashing and randomness

The complete four-language inventory and design decisions are in [Formula overview](formula-overview.md).

Names accept German, English, French and Italian aliases, case-insensitively, independently of the UI language. Accents may be omitted. Arguments may use
commas or semicolons. Examples below use decimal points and semicolons. The core
functions are built in; no registration, network request, or API key is needed.
The app-only web-query adapter is described separately below.

Numeric arguments accept numbers or numeric strings, but reject empty cells,
booleans, arrays, and nonnumeric text. Invalid argument types/counts produce
`#VALUE!`; invalid numeric domains or nonfinite results produce `#NUM!`.
Existing formula errors propagate. Arrays can feed `INDEX`, `MAP`, and other
functions, or spill into neighboring cells when returned from a cell formula.
The `JSON.*` functions are documented in [JSON values and formulas](json.md); spilling
and element-wise calculation in [Dynamic arrays](arrays.md).

## Geographic coordinates

Coordinates are **latitude, longitude**, in decimal degrees, with latitude in
[-90,90] and longitude in [-180,180]. Distances use a spherical Earth with mean
radius 6,371,008.8 meters (an approximation, not an ellipsoidal survey). Bearings
are clockwise from north, in [0,360). Optional units are `"km"` (default), `"m"`,
`"mi"` (statute miles), or `"nmi"` (nautical miles).

| Function                                               | Result                                                                                    |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| `GEO.DISTANCE(lat1; lon1; lat2; lon2; [unit])`         | Shortest great-circle distance, using the haversine formula                               |
| `GEO.BEARING(lat1; lon1; lat2; lon2)`                  | Initial bearing; coincident/antipodal points yield `#NUM!` because direction is undefined |
| `GEO.DESTINATION(lat; lon; bearing; distance; [unit])` | One row containing `[latitude, longitude]`; distance must be nonnegative                  |

```text
=GEO.DISTANCE(48.137; 11.575; 52.520; 13.405; "km")
=GEO.BEARING(48.137; 11.575; 52.520; 13.405)
=INDEX(GEO.DESTINATION(48.137; 11.575; 90; 10); 1; 2)
```

The last formula returns the longitude reached after traveling 10 km east on a
great circle. Longitude is normalized to [-180,180). The spherical equations
are described in [Movable Type's geodesy reference](https://www.movable-type.co.uk/scripts/latlong.html).

## Cartesian geometry and trigonometry

Use consistent coordinate/length units; areas and volumes use their square/cube.
Sizes and radii must be nonnegative. Geographic coordinates should use `GEO`,
not Cartesian distances or polygon areas.

| Function                               | Result                                           |
| -------------------------------------- | ------------------------------------------------ |
| `GEOM.DISTANCE(x1; y1; x2; y2)`        | Euclidean distance                               |
| `GEOM.CIRCLE.AREA(radius)`             | Circle area                                      |
| `GEOM.CIRCLE.CIRCUMFERENCE(radius)`    | Circle circumference                             |
| `GEOM.RECTANGLE.AREA(width; height)`   | Rectangle area                                   |
| `GEOM.TRIANGLE.AREA(base; height)`     | Triangle area using perpendicular height         |
| `GEOM.SPHERE.AREA(radius)`             | Sphere surface area                              |
| `GEOM.SPHERE.VOLUME(radius)`           | Sphere volume                                    |
| `GEOM.POLYGON.AREA(points)`            | Absolute shoelace area                           |
| `GEOM.POLYGON.PERIMETER(points)`       | Closed polygon perimeter                         |
| `RADIANS(degrees)`, `DEGREES(radians)` | Angle conversion                                 |
| `SIN(x)`, `COS(x)`, `TAN(x)`           | Trigonometry with radians                        |
| `ASIN(x)`, `ACOS(x)`, `ATAN(x)`        | Inverse trigonometry, returning radians          |
| `ATAN2(y; x)`                          | Direction in radians, with **y first**, x second |
| `HYPOT(a; b; ...)`                     | Euclidean norm, 1–256 scalar components          |

Polygon input is a range with exactly two columns (x, y), at least three numeric
rows, no header, and vertices in boundary order. The closing edge is implicit;
a repeated first vertex is also accepted. Use simple polygons: holes and
self-intersection validation are not implemented; self-intersections yield the
absolute algebraic shoelace area.

```text
=GEOM.DISTANCE(0; 0; 3; 4)
=GEOM.CIRCLE.AREA(5)
=GEOM.POLYGON.AREA(A2:B6)
=SIN(RADIANS(30))
```

## Hashing

| Function             | Result                                                       |
| -------------------- | ------------------------------------------------------------ |
| `HASH.SHA256(value)` | 64 lowercase hexadecimal characters                          |
| `HASH.FNV1A(value)`  | 32-bit FNV-1a, 8 lowercase hexadecimal characters            |
| `HASH.CRC32(value)`  | CRC-32/ISO-HDLC checksum, 8 lowercase hexadecimal characters |

Input is scalar text, a number, or a boolean. Numbers and booleans are converted
with JavaScript `String`; strings are encoded as UTF-8 without trimming or
Unicode normalization. For ranges, compose the desired text explicitly using
`TEXTJOIN`. SHA-256 follows [FIPS 180-4](https://csrc.nist.gov/pubs/fips/180-4/upd1/final)
and runs synchronously to match the formula engine. FNV-1a and CRC-32 are
noncryptographic hashes/checksums.

```text
=HASH.SHA256("hello")
=HASH.CRC32("123456789")
=HASH.FNV1A(A2 & ":" & B2)
```

## Random generation

| Function                                     | Result                                            |
| -------------------------------------------- | ------------------------------------------------- |
| `RANDOM()`                                   | Uniform number in [0,1)                           |
| `RANDOM.INT(min; max)`                       | Uniform integer, both endpoints included          |
| `RANDOM.NORMAL([mean]; [standardDeviation])` | Normal sample; defaults 0 and 1, deviation ≥ 0    |
| `RANDOM.SEEDED(seed; [index])`               | Reproducible number in [0,1), index defaults to 0 |
| `RANDOM.UUID()`                              | Random UUID version 4                             |

Unseeded functions use `crypto.getRandomValues`, without a `Math.random` fallback;
if unavailable they return `#ERROR!`. Integer endpoints must be safe integers,
with at most 2^32 possible outcomes. Rejection sampling avoids modulo bias.
Normal samples use the Box–Muller transform.

Seeded generation is a pure, noncryptographic indexed generator. Equal seed text
and index always give the same result, including after reopening a shared
workbook; different indices do not guarantee distinct results. Index must be a
nonnegative safe integer. A number seed and its equivalent string are identical.
There is no mutable global seed or dependence on evaluation order.

```text
=RANDOM.INT(1; 6)
=RANDOM.NORMAL(100; 15)
=RANDOM.SEEDED("simulation-2026"; 0)
=MAP(SEQUENCE(10); LAMBDA(i; RANDOM.SEEDED("simulation-2026"; i)))
=RANDOM.UUID()
```

Cell results stay cached until their dependencies change or the full formula
cache is cleared, for example by undo/redo or explicit `grid.recalculate()`.
An unrelated cell edit no longer rerolls cached random values. The demo's **Recalculate**
button does the latter and refreshes filters and summaries. Scrolling alone does
not reroll cached values. Recalculation does not create a history step. Undo
restores random formulas, not their previous unseeded samples; reopening a share
link also generates new unseeded samples. Use seeded formulas for repeatable
workbooks, or paste a generated value as a constant when it must remain fixed.

## Text and regular expressions

The following built-ins are available in every grid, including imported/shared
workbooks. `UPPER`, `LOWER`, `PROPER`, `LEFT`, `RIGHT`, `MID`, `FIND`, `SEARCH`,
`TEXTJOIN`, `SUBSTITUTE`, and `REPLACE` remain available.

### Trimming, slicing, and literal operations

| Function                                | Behavior                                                                                          |
| --------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `LTRIM(text; [characters])`             | Remove matching characters from the left                                                          |
| `RTRIM(text; [characters])`             | Remove matching characters from the right                                                         |
| `TRIM(text; [characters])`              | Remove matching characters from both ends                                                         |
| `SQUEEZE(text)`                         | Trim whitespace and collapse internal whitespace runs to one space                                |
| `UPPER(text)`, `LOWER(text)`            | Unicode uppercase/lowercase, independent of the UI locale                                         |
| `SUBSTR(text; start; [length])`         | Substring; `SUBSTRING` is an identical alias                                                      |
| `REVERSE(text)`                         | Reverse Unicode code points                                                                       |
| `REPEAT(text; count)`                   | Repeat text a nonnegative integer number of times                                                 |
| `STARTSWITH(text; prefix)`              | Case-sensitive boolean prefix check                                                               |
| `ENDSWITH(text; suffix)`                | Case-sensitive boolean suffix check                                                               |
| `CONTAINS(text; search)`                | Case-sensitive boolean substring check                                                            |
| `SPLIT(text; delimiter)`                | A one-row array; delimiter is literal, trailing empty parts are preserved                         |
| `REPLACEALL(text; search; replacement)` | Replace all literal occurrences; replacement dollar signs remain literal; empty search is invalid |
| `PADSTART(text; length; [fill])`        | Pad left to the target length; default fill is a space                                            |
| `PADEND(text; length; [fill])`          | Pad right to the target length; default fill is a space                                           |

Trim functions default to JavaScript's Unicode whitespace set. With an explicit
`characters` argument, each Unicode code point in that string belongs to a
trim set; it is not a substring or regex. An empty trim set leaves text unchanged.
`TRIM` preserves internal spaces (a change from the earlier implementation).
`SQUEEZE` provides the earlier whitespace-collapsing behavior.

`SUBSTR` positions are **one-based**; negative positions count from the end
(-1 is the last code point). Position 0 is invalid. A start before the beginning
is clamped to the beginning; a start beyond the end returns an empty string.
Omitting length reads to the end; zero length returns an empty string. Length
must be a nonnegative integer.

Slicing, reversing, and padding count Unicode code points, so a surrogate pair
such as `🧬` stays intact. Combining characters and multi-code-point emoji are
not combined into grapheme clusters. Existing `LEN`, `FIND`, and `SEARCH` retain
their UTF-16 indexing semantics. Padding never truncates the original text;
fill repeats and is truncated to the required code-point length. Empty fill
leaves text unchanged. `SPLIT(text; "")` splits into Unicode code points.

```text
=LTRIM("  MARCH1  ")
=TRIM("--hello--"; "-")
=TRIM("  a   b  ")
=SQUEEZE("  a   b  ")
=UPPER("Straße")
=SUBSTR("abcdef"; 2; 3)
=SUBSTR("abcdef"; -2)
=PADSTART("42"; 5; "0")
=INDEX(SPLIT("red,green,blue"; ","); 1; 2)
```

These examples yield `MARCH1  `, `hello`, `a   b`, `a b`, `STRASSE`, `bcd`,
`ef`, `00042`, and `green` respectively.

### Regular expressions

| Function                                              | Behavior                                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `REGEXP(text; pattern; [flags])`                      | Boolean test; aliases `REGEXTEST` and `REGEXMATCH`                                   |
| `REGEXP_EXTRACT(text; pattern; [group]; [flags])`     | First match, with group 0 (default) meaning the complete match; alias `REGEXEXTRACT` |
| `REGEXP_REPLACE(text; pattern; replacement; [flags])` | Regex replacement; alias `REGEXREPLACE`                                              |
| `REGEXP_SPLIT(text; pattern; [flags])`                | One-row array using regex separators                                                 |

Regex functions use the browser's JavaScript RegExp syntax. Pass a pattern
string without `/.../` delimiters. Defaults are `"u"` (Unicode) and, for
replacement, `"gu"` (Unicode, all matches). Explicit flags **replace** the
defaults: `"iu"` ignores case; replacement with `"u"` replaces only the first
match. Other flags depend on browser support. Each call uses a fresh regex,
so `g`/`y` do not carry state between cells.

`REGEXP_EXTRACT` returns `#N/A` if no match exists, `#NUM!` for an invalid group
index, and an empty string for an unmatched optional group. Group numbers start
at 1. Use `IFNA` to supply a missing-match fallback. Extraction always returns
the first match, even with `g`.

Replacement follows JavaScript replacement-string semantics (`$1`, `$2`,
`$<name>`, `$&`, `$$`, etc.). Use `REPLACEALL` for literal replacements.
Regex split includes captured separators, as JavaScript split does; use
noncapturing groups `(?:...)` to omit them. Unmatched captures become empty
strings. Array results spill from a formula cell when space is available; use
`A1#` to refer to a spilled result or pass arrays to `INDEX`, `TEXTJOIN`, and
other array functions.

```text
=REGEXP("MARCH1"; "^[A-Z]+[0-9]+$")
=REGEXP("Hello"; "^hello$"; "iu")
=REGEXP_EXTRACT("item-123"; "([0-9]+)"; 1)
=IFNA(REGEXP_EXTRACT(A2; "[0-9]+"); "none")
=REGEXP_REPLACE("item-123"; "([a-z]+)-([0-9]+)"; "$2:$1")
=TEXTJOIN("|"; FALSE; REGEXP_SPLIT("a, b; c"; "[,;] *"))
```

Formula strings preserve backslashes, so `"\d+"` in a formula denotes a digit
pattern. When building that formula in JavaScript source, escape the JavaScript
string separately (for example `' =REGEXP(A2; "\\d+")'.trim()`).

Invalid patterns, flags, arity, or nonscalar text inputs produce `#VALUE!`.
Invalid counts/positions and oversized generated output produce `#NUM!`.
The new scalar text functions stringify numbers and booleans and treat empty
cells as empty text. Existing formula errors propagate. Repeat/padding lengths
are limited to 1,000,000; split output is limited to 100,000 parts. Regex runs
synchronously in the browser; these size limits do not impose a regex timeout.

## Calendar dates and times

These extensions follow the existing `DATE`, `YEAR` and `TODAY` local calendar.
Inputs are Date values, strict `YYYY-MM-DD` calendar strings, or ISO timestamps
with an explicit `Z`/offset. Calendar arithmetic discards the time of day and uses
civil days: crossing a daylight-saving transition still counts one calendar day.
It does not interpret Excel serial numbers as dates. `DATE.SEQUENCE` uses this same local calendar. Month/year shifts clamp to the destination month's last
day. Invalid types/counts yield `#VALUE!`, invalid numeric domains yield `#NUM!`.

| Function                                              | Result                                                                                                                  |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `EDATE(date; months)`, `EOMONTH(date; months)`        | Shift whole months; EOMONTH returns the last day                                                                        |
| `WEEKDAY(date; [type])`                               | Type 1: Sun=1, type 2: Mon=1, type 3: Mon=0; types 11–17 start at Mon–Sun                                               |
| `WEEKNUM(date; [type])`                               | Type 1/2: weeks start Sun/Mon and Jan 1 belongs to week 1; 21: ISO                                                      |
| `ISOWEEKNUM(date)`, `DATE.ISOWEEKYEAR(date)`          | ISO week and ISO week-year, which may differ from the calendar year                                                     |
| `DATEDIF(start; end; unit)`                           | Completed days `D`, months `M`, years `Y`, or remaining months `YM`; end must not precede start                         |
| `NETWORKDAYS(start; end; [holidays])`                 | Inclusive workdays excluding Sat/Sun; reversed intervals are negative                                                   |
| `NETWORKDAYS.INTL(start; end; [weekend]; [holidays])` | Custom weekends: seven-character Mon–Sun mask (`0000011`), codes 1–7 for paired weekends, 11–17 for Sun–Sat single days |
| `WORKDAY(start; days; [holidays])`                    | Shift by positive/negative whole workdays, excluding the start; zero returns the start; max 100,000                     |
| `WORKDAY.INTL(start; days; [weekend]; [holidays])`    | Same with custom weekends; all-weekend masks are invalid                                                                |
| `DATE.ADD(date; amount; [unit])`                      | Whole `day`, `week`, `month`, `year` shifts                                                                             |
| `DATE.DIFF(start; end; [unit])`                       | `day`: civil-day difference; `hour`, `minute`, `second`, `millisecond`: elapsed timestamp difference                    |
| `DATE.ISO(date)`                                      | Local calendar date as `YYYY-MM-DD`                                                                                     |
| `DATE.FORMAT(date; [pattern]; [zone])`                | Tokens `YYYY MM DD HH mm ss`; bracketed literals; `local` or `UTC`; default `YYYY-MM-DD`                                |
| `DATE.TIMESTAMP(date)`, `DATE.FROMTIMESTAMP(seconds)` | Unix seconds and inverse, including fractions                                                                           |
| `DATE.ISLEAP(year)`                                   | Gregorian leap-year test                                                                                                |
| `TIME(hours; minutes; seconds)`                       | Nonnegative valid components; returns a typed clock time; hours must be below 24                                        |
| `TIMEVALUE(time)`                                     | Strict `HH:mm[:ss]`, clock time or Date/ISO timestamp; numeric day fractions are rejected                               |
| `HOUR(time)`, `MINUTE(time)`, `SECOND(time)`          | Accept typed clock times and clock strings; seconds are whole seconds                                                   |
| `TIME.FORMAT(time)`                                   | Clock text `HH:mm:ss`, rounded to nearest second                                                                        |
| `TIME.ADD(time; amount; [unit])`                      | Add `hour` (default), `minute`, or `second`, wrapping at midnight                                                       |
| `DURATION.FORMAT(seconds)`                            | Signed `HH:mm:ss`, hours can exceed 24                                                                                  |

Holiday ranges ignore blank cells, duplicate days and holidays already on weekends;
up to 10,000 nonblank holiday entries. Scalar extensions work element-wise over
ranges, except the workday functions whose range argument is the holiday list.
`DATEVALUE` follows the same strict ISO parsing. `DATE` rejects invalid calendar
components rather than silently rolling them into another month. `DAYS(end; start)`
keeps its legacy order but now counts civil days; prefer `DATE.DIFF(start; end)`.
Calendar/time units accept translated singular and plural names, for example
`"day"`, `"Tag"`, `"jour"`, `"giorno"`.

```text
=DATE.ISO(EOMONTH("2024-02-10"; 0))
=NETWORKDAYS("2026-10-01"; "2026-10-31"; F2:F10)
=DATE.ISO(WORKDAY("2026-10-02"; 3))
=TIME.FORMAT(TIME.ADD("23:30"; 2; "hour"))
=DURATION.FORMAT(90061)
```

## Color calculations

Colors are opaque sRGB `#RGB` or `#RRGGBB` strings. Results are normalized lowercase
`#rrggbb`. CSS names, alpha/transparency, and CSS expressions are not accepted.
RGB inputs range from 0 to 255 (rounded); HSL uses hue degrees (wrapped), saturation
and lightness 0–100. Mixtures interpolate encoded sRGB channels, rather than linear
light or a perceptually uniform space. These functions calculate values; they do
not mutate cell formatting. In the iOS prototype, select a hex-color cell and use
**Werkzeuge → Farbe übernehmen** to apply that color to the selection.

| Function                                         | Result                                                   |
| ------------------------------------------------ | -------------------------------------------------------- |
| `COLOR.RGB(r; g; b)`, `COLOR.HSL(h; s; l)`       | Construct hex color                                      |
| `COLOR.HEX(color)`                               | Normalize short/long hex                                 |
| `COLOR.RED/GREEN/BLUE(color)`                    | Channel from 0 to 255                                    |
| `COLOR.HUE/SATURATION/LIGHTNESS(color)`          | HSL components                                           |
| `COLOR.MIX(first; second; [weight])`             | Weight 0–1, default 0.5, determines second color's share |
| `COLOR.LIGHTEN/DARKEN(color; amount)`            | Mix with white/black, amount 0–1                         |
| `COLOR.INVERT(color)`, `COLOR.COMPLEMENT(color)` | Invert RGB; rotate hue 180°                              |
| `COLOR.LUMINANCE(color)`                         | Relative sRGB luminance                                  |
| `COLOR.CONTRAST(first; second)`                  | Contrast ratio, 1–21                                     |
| `COLOR.TEXT(background)`                         | Black/white, choosing whichever has greater contrast     |
| `COLOR.PALETTE(first; second; count)`            | Spill a gradient of 2–256 colors as a column             |

Luminance/contrast use the [W3C sRGB definitions](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum).
A contrast number by itself does not establish accessibility of a complete design.

```text
=COLOR.HSL(160; 60; 35)
=COLOR.MIX("#19745c"; "#ffffff"; 0.25)
=COLOR.CONTRAST("#19745c"; "#ffffff")
=COLOR.PALETTE("#19745c"; "#eef7f1"; 8)
```

## Web queries — iOS app only

For query parameters, `ENCODEURL(text)` percent-encodes a component and `DECODEURL(text)` reverses it. For example `"https://example.com/search?q=" & ENCODEURL(A1)`. Malformed percent escapes return `#VALUE!`.

The core/browser demo has no web-query functions or network adapter. Only the iOS
prototype registers `WEB.GET(url)`, `WEB.JSON(url; [path])` and `WEB.STATUS(url)`. `WEBSERVICE(url)` is an alias of `WEB.GET(url)`.
The native adapter is maintained in a separate local prototype and is not included
in this repository or the npm package.
`WEB.JSON` returns a JSON value or a path result that can feed `JSON.TABLE`, formulas
and spill ranges. The native transport uses [Apple URLSession](https://developer.apple.com/documentation/foundation/urlsession)
and has no dependency on browser CORS. No web response is executed as JavaScript.

```text
=WEB.GET("https://example.com/data.csv")
=WEB.JSON("https://example.com/data.json"; "items[0].amount")
=JSON.TABLE(WEB.JSON("https://example.com/data.json"; "items"))
```

These example addresses illustrate syntax; they are not promised live APIs.

Precision, strict lookup defaults, typed errors and migration are documented in [spreadsheet safety rules](excel-safety.md). Use `DECIMAL.*` for explicit decimal precision and `DURATION.CREATE`/`DURATION.SECONDS` for typed durations.
