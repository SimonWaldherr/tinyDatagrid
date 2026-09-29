# JSON values and formulas

[← Overview](../README.md) · [Integration guide](guide.md) · [Function reference](functions.md) · [Dynamic arrays](arrays.md)

A cell can hold a **JSON object or array** as a value of its own. It is not
just text: formulas read into it, it compares by content, and it survives
import, export, copy and share links unchanged. Scalars inside JSON (numbers,
text, booleans) are ordinary cell values; `null` becomes an empty cell.

```text
A1   {"name":"Ann","tags":["a","b"],"address":{"city":"Bonn"}}
B1   =JSON.GET(A1; "address.city")            → Bonn
C1   =TEXTJOIN(", "; TRUE; JSON.GET(A1; "tags"))   → a, b
D1   =JSON.TABLE(A1)                          → fills cells with key/value rows
```

## What is JSON in a cell

Text that starts with `{` or `[` and parses as JSON becomes a JSON value. Other
text stays text, so `[TODO] later` is not touched. To keep valid JSON as plain
text, give the cell or column the type `text`
(`setCell(row, col, value, { valueType: 'text' })` or `columnTypes`).

- **Numbers keep the loss-aware rules.** JSON containing integers outside the
  safe range or decimals that would lose digits is *not* accepted as JSON;
  `JSON.PARSE` returns `#NUM!` for it. Write such numbers as strings.
- **Nested data from imports.** Importing a JSON file (or NDJSON) keeps nested
  objects and arrays in their cells as JSON values.
- **Column types.** `jsonb`, `json`, `object` and `array` column types (for
  example from a SQL result) coerce text into JSON values.
- **Comparison and text.** `=A1=B1` compares two JSON values by content, ignoring
  spacing and key order in the source text. `A1&""` gives the compact JSON text.
- **List context.** Where a function expects a range, a JSON *array* acts like a
  column of its elements: `SUM(JSON.GET(A1;"items[*].price"))`,
  `TEXTJOIN(", ";TRUE;tags)`, `COUNTA`, `SORT`, `UNIQUE`, `FILTER`, `MAP`, `MATCH`
  and `XLOOKUP` all accept it. JSON objects count as one item.
- **Display.** JSON cells show compact JSON in monospace. The grid adds the
  classes `tg-json`, `tg-json-object` and `tg-json-array`; the cell tooltip shows
  the beginning of the text.
- **Validation.** `{ type: 'json', kind: 'object' | 'array' }` in the
  validation plugin accepts only JSON of that kind.

## Paths

`JSON.GET`, `JSON.HAS`, `JSON.SET` and the other path functions share one syntax.
A leading `$` is optional.

| Path | Meaning |
| --- | --- |
| `name`, `address.city`, `$.address.city` | Object members |
| `items[0]`, `items[-1]`, `items.0` | Array element; negative counts from the end |
| `["odd key"]`, `['a.b']` | Member name that needs quoting |
| `items[*].sku`, `items.*` | Every element / member |
| `items[1:3]`, `items[-2:]`, `items[::2]` | Slices (start, end, step) |
| `items[0,2]`, `["a","b"]` | Several indexes or names |
| `$..price` | Any depth ("recursive descent") |
| `items[?(@.qty > 1)]` | Filter: `@` is the element; operators `== != < <= > >=`, `&&`, `\|\|`, `!` |
| `items[?(@.tags)]` | Filter by existence |
| `items.length`, `name.length` | Length of an array or text (unless a member has that name) |
| `/items/0/sku` | JSON Pointer (RFC 6901) |

A path that names one location (no wildcard, slice, filter or `..`) returns that
value, or `#N/A` when it is missing. Any other path returns a JSON array with
all matches (empty when nothing matches). A third argument of `JSON.GET` is the
fallback for a missing value, and may be an empty string.

```text
=JSON.GET(A1; "items[?(@.price>10)].name")   → ["Nut"]
=JSON.GET(A1; "owner.email"; "unknown")      → unknown
=JSON.GET(A1:A100; "customer")               → one result per row, filled down
```

## Functions

Arguments accept a JSON value, JSON text, or a cell holding either.
Results that are objects or arrays are JSON values; tables are ranges that fill
neighboring cells (see [dynamic arrays](arrays.md)).

| Function | Result |
| --- | --- |
| `JSON.PARSE(text)` | JSON value or scalar; invalid text gives `#VALUE!` |
| `JSON.STRINGIFY(value; [indent])` | JSON text; a range becomes an array of arrays; indent is 0–10 or a string |
| `JSON.VALID(text)` | `TRUE` when the text parses |
| `JSON.TYPE(value; [path])` | `object`, `array`, `string`, `number`, `boolean` or `null` |
| `JSON.GET(json; path; [default])` | Value at a path (see above) |
| `JSON.HAS(json; path)` | Whether the path exists |
| `JSON.KEYS(json; [path])` | Object keys (or array indexes, zero-based) as a column |
| `JSON.VALUES(json; [path])` | Values as a column |
| `JSON.ENTRIES(json; [path])` | Key/value pairs as two columns |
| `JSON.LENGTH(json; [path])` | Number of elements, keys or characters |
| `JSON.SET(json; path; value; …)` | Copy with values set; missing objects and arrays are created |
| `JSON.REMOVE(json; path; …)` | Copy without the given members or elements |
| `JSON.MERGE(json; json; …)` | Deep merge of objects; later arrays and scalars replace earlier ones |
| `JSON.OBJECT(key; value; …)` | Object from pairs, from a two-column range, or from a key range and a value range |
| `JSON.ARRAY(values…)` | Array; ranges are flattened, nested JSON stays nested |
| `JSON.CONCAT(array; more…)` | Joins arrays; other values are appended |
| `JSON.LOOKUP(value; array; key_path; [result_path]; [not_found])` | First element whose key equals the value, or a value inside it |
| `JSON.SORT(array; [path]; [order])` | Stable sort; order `-1` is descending; missing keys sort last |
| `JSON.UNIQUE(array; [path])` | Removes duplicates by content or by the value at a path |
| `JSON.TABLE(json; [columns]; [header]; [flatten])` | Array of objects (or arrays, or an object) as a table |
| `JSON.FROMTABLE(range; [header])` | Range to an array of objects; the first row supplies the keys |
| `JSON.FLATTEN(json; [max_depth])` | Every leaf as a `path` / `value` row |

`JSON.GET`, `JSON.HAS`, `JSON.TYPE`, `JSON.VALID`, `JSON.LENGTH` and
`JSON.PARSE` also work on ranges and return one result per cell.

### Tables

`JSON.TABLE(A1)` turns an array of objects into rows. Columns are the keys in
order of first appearance; nested objects stay JSON values unless
`flatten` is `TRUE`, which creates `address.city` style columns. Pass a column
list (`"id,name,address.city"`, a range, or a JSON array) to choose columns.
`JSON.FROMTABLE` is the reverse: `=JSON.FROMTABLE(A1:D20)` gives an array of
objects with the header cells as keys and blank cells as `null`.

### Building JSON from cells

- Blank cells become `null`; an empty string built by a formula does too.
- Dates become `YYYY-MM-DD` (or an ISO instant when they carry a time),
  `BigInt` values become strings, and functions or non-finite numbers are errors.
- Text stays text, even if it looks like JSON or a number. Use `JSON.PARSE` to
  turn JSON text into structure.
- Keys must be non-empty; object results never inherit prototype members, so a key
  such as `__proto__` is just a key.

```text
=JSON.OBJECT("id"; A2; "name"; B2; "tags"; JSON.ARRAY(C2:E2))
=JSON.STRINGIFY(JSON.FROMTABLE(A1:C10); 2)
=JSON.SET(A1; "address.city"; "Köln"; "tags[0]"; "new")
=JSON.MERGE(defaults; overrides)
```

## The JSON tools in the demo

- **JSON editor** (Data tab, or the JSON chip in the status bar): edit the text,
  format or minify it, see a collapsible tree, and click a node to copy its path
  or insert a `=JSON.GET(…)` formula next to the cell. Formula cells open in a
  read-only view; "Keep as value" replaces the formula by its JSON.
- **Expand as table** inserts `=JSON.TABLE(…)` in a free place.
- **Split column** creates one derived column per key of the selected JSON
  objects, each with a single `=JSON.GET(range; "key"; "")` formula.

The tools are reusable modules; see [demo tools](demo-features.md).

## For host applications

```js
import { JSONValue, queryJSON, setJSON, mergeJSON } from 'tiny-datagrid/json';

grid.setCell(0, 0, { name: 'Ann', tags: ['a'] });   // objects and arrays are accepted
const value = grid.getComputedValue(0, 0);          // JSONValue
value.value;                                        // { name: 'Ann', tags: ['a'] }
queryJSON(value.value, 'tags[0]');                  // { definite: true, found: true, value: 'a' }
```

`getComputedValue` returns a `JSONValue` for JSON cells; use `.value` for the plain
data and `String(value)` for compact text. Wrappers are never stored in cells:
`setCell` unwraps them, and `getRawValue` returns text or the plain object.
Custom formula functions that return a plain object produce a JSON value; a
returned array stays a range.
