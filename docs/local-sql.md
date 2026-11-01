# Local SQL queries

`tiny-datagrid/local-sql` is an optional, dependency-free SQL subset
for querying tables in the active worksheet. SELECT evaluates computed cell values
and returns a separate snapshot. SELECT INTO and the explicit materialization APIs
write snapshots as editable tables; ordinary SELECT does not change cells.
Local SQL does not connect to a database.

```js
import { localSQL, queryTables } from "tiny-datagrid/local-sql";
grid.use(localSQL());
const sql = grid.feature("sql");
console.log(sql.tables()); // [{ id, name, columns }]

const result = sql.query(
  `
  SELECT Region, SUM(Sales) AS Revenue, COUNT(*) AS Orders
  FROM table1
  WHERE Sales >= ?
  GROUP BY Region
  HAVING SUM(Sales) > 100
  ORDER BY Revenue DESC
  LIMIT 10
`,
  [20],
);
console.log(result.columns, result.rows);
console.log(result.toTable()); // header-first array
console.log(result.drill(0)); // source row indices and records for the first result

// Standalone API, without installing the plugin:
const rows = queryTables(grid, "SELECT * FROM table1 LIMIT 100");
```

Use table IDs or names in `FROM`. IDs take precedence over names. Double-quote
identifiers containing spaces or reserved words: `FROM "Sales data"` and
`SELECT "Order value"`. Double an embedded double quote. Unquoted identifiers
are case-insensitive; quoted identifiers match exactly. Unknown or ambiguous
fields/tables produce an error, including when the table has no data.

The supported subset includes:

- `SELECT *`, column projections, literals, `AS` aliases and `SELECT DISTINCT`.
- `WHERE` comparisons: `=`, `!=`, `<>`, `<`, `<=`, `>`, `>=`; `AND`, `OR`, `NOT`
  and parentheses; `IS NULL`, `IS NOT NULL`, `IN`, `BETWEEN`, `LIKE` and their
  `NOT` forms. `LIKE` is case-sensitive, `%` matches any sequence and `_` one
  Unicode code point. `AND` takes precedence over `OR`.
- `GROUP BY` one or more source fields; `HAVING` with grouped fields,
  aggregate expressions or result aliases.
- `COUNT(*)`, `COUNT(field)`, `SUM`, `AVG`, `MIN`, `MAX`, including
  `COUNT(DISTINCT field)` and distinct arguments for the other aggregates.
- `ORDER BY` one or more fields, result aliases, aggregate expressions or
  one-based result column positions, with `ASC`/`DESC` and optional
  `NULLS FIRST`/`NULLS LAST`. Nulls sort last by default in either direction.
  Ungrouped queries can order by unselected source fields;
  `SELECT DISTINCT` requires those fields in the result.
- `LIMIT n OFFSET m`, including `LIMIT ? OFFSET ?` with bound nonnegative safe
  integers. OFFSET requires LIMIT. One optional trailing semicolon, `--` and
  `/* */` comments are accepted.
- Positional `?` parameters for values. Pass the exact number of parameters.
  Parameters cannot supply table names or field names.

```js
const page = sql.query(
  "SELECT Region, Sales FROM table1 ORDER BY Sales DESC NULLS LAST LIMIT ? OFFSET ?",
  [50, 100],
);
```

Only one `SELECT` statement is accepted, optionally with the INTO extension below. Joins, subqueries, arithmetic expressions,
window functions, DDL and INSERT/UPDATE/DELETE statements are outside this initial subset.
There is no `eval` or dynamic JavaScript compilation.

## Values and scopes

SQL defaults to **all** data rows, independently of the table's current filters.
Use `{ scope: 'visible' }` as the third argument of `sql.query` to apply the table
filters and hidden-row state. For selected rows, use
`{ scope: 'selection', selection: grid.selection }`. The standalone function
accepts those options as its fourth argument. The demo exposes this choice in
its SQL dialog, opened by the **SQL** toolbar button.

Blank cells become `NULL`; wholly empty rows are skipped. `COUNT(*)` counts
records, and `COUNT(field)` counts every non-null value, including text.
Null comparisons follow SQL's three-valued logic: `x = NULL` does not match;
use `x IS NULL`. `SUM` and `AVG` require numeric non-null values and reject
numeric strings rather than silently converting them. BigInts and DecimalValues
retain exact arithmetic. Numeric SQL literals also preserve precision.
`SUM`, `AVG`, `MIN` and `MAX` of no values return `NULL`; `COUNT` returns zero.
An aggregate query without GROUP BY returns one row even for empty input.

Text comparisons are case-sensitive. Numeric values compare across number,
BigInt and DecimalValue types; other ordered comparisons require matching scalar
types. Grouping and DISTINCT keep numeric and text values separate. Unsupported
objects in grouping/comparison and evaluated typed cell calculation errors produce errors.
The existing grid's temporal scalar values can be supplied as bound parameters.

Every non-aggregate field in a grouped result, HAVING or ORDER BY must be in
GROUP BY. Result column names must be unique; use aliases for repeated fields.
`drill(index)` follows the final sorting and LIMIT/OFFSET, and a DISTINCT result
retains all contributing records. Results are snapshots; rerun after edits or
filter changes. Drill-through row indices refer to the source layout at execution.

## Limits and integration

The source range is limited to 500,000 cells. SQL text is capped at 32,768
characters, 4,096 tokens and 64 levels of predicate nesting. Results are capped
at 10,000 rows; add LIMIT for larger tables. Query evaluation also has a work
budget of 5,000,000 operations, including LIKE matching. Exceeding a limit gives
an explicit error; the query does not return an incomplete result. LIMIT caps
output but does not cap work needed for filtering, grouping or sorting.
For queries without grouping, DISTINCT or ordering, only the requested output
window is projected; source reading and WHERE still evaluate the full input.
Aggregate results and their column inputs are reused within each query across
SELECT, HAVING and ORDER BY. Constant scalar IN lists use an index for longer
lists, preserving NULL logic and exact numeric equality. Caches are discarded
after execution, so rerunning a query reads current values and parameters.

Run `npm run benchmark:sql` for headless SQL measurements over 10,000 and 50,000
source rows, including limited projections, IN lists and repeated aggregates.
The benchmark includes source reading and verifies its results; it excludes
browser rendering and formula recalculation.

The demo paginates result previews in groups of 50 rows and provides source-record
buttons. Ctrl/Cmd+Enter executes the SQL in the editor. The schema picker lists
available table IDs, names and columns; “Use example” inserts a SELECT for the
chosen table.

The result's `columns`, `rows` and `rowCount` are compatible with `SQLResultSet`.
Hosts can pass it to a **separate** grid's `loadResultSet` for a richer result
viewer. The existing `tiny-datagrid/sql-client` adapter continues to support
external database clients, including pagination and commits; local SQL is an
independent optional module.

## Result tables and SELECT INTO

The demo's **Table in new sheet** action saves the complete result as a regular,
editable table. The new worksheet receives a unique name. It can feed subsequent
SQL queries, pivots, charts and exports.

```js
const result = sql.query(
  "SELECT Region, SUM(Sales) AS Revenue FROM table1 GROUP BY Region",
);
const output = sql.materialize(result, { sheetName: "Regional sales" });
// The output sheet is selected; source data is retained.
const next = sql.query("SELECT * FROM table1 WHERE Revenue > 100");
```

You can also specify a destination in SQL:

```sql
SELECT * INTO Sheet2:A5 FROM Table1;

SELECT Region, SUM(Sales) AS Revenue
INTO "Regional overview":B5
FROM table1
GROUP BY Region
ORDER BY Revenue DESC;
```

This is a tinyDatagrid extension: `INTO SheetName:Cell` appears between the
projection list and FROM. Double-quote sheet names containing spaces. Existing
worksheet IDs or names resolve like SQL table identifiers; a missing worksheet is
created. The destination cell contains the first header; data begins one row below.
The whole output rectangle must be free of occupied cells and existing tables.
Conflicts fail without overwriting them. Failed imports restore the target and
remove a newly created sheet. Writing into hidden sheets preserves their hidden
state when the output sheet is not activated.

SELECT INTO leaves the source worksheet and active source table selected. The
returned `result.destination` contains `{ sheetId, tableId, name, range }`.
The demo displays that destination and offers **Open result table**.
Drill-through still refers to the source records. To place an existing result
programmatically, use:

```js
sql.write(result, { sheetName: "Sheet2", cell: "A5", activate: false });
// Standalone equivalents: materializeSQLResult(grid, result, options)
// and writeSQLResult(grid, result, options), exported from tiny-datagrid/local-sql.
```

Materialized results are **snapshots**, not live queries. Source formulas become
computed values. Formula-like text remains literal text. Exact numeric types and
calendar dates are preserved, and mutable values are copied. Tables created by
these APIs retain wholly NULL result records through subsequent SQL queries and
workbook saves. Empty results still create a header-only table.

Writes require the worksheets plugin and an editable workbook. They are disabled
during an external SQL session or a running grid transaction. An insertion into
an existing sheet is one undo step. Creating a worksheet uses the worksheet
collection's normal lifecycle; undo operates within each worksheet.
Output tables are capped at 500,000 cells including headers; destinations are
limited to the core's 10,000,000 rows and 32,768 columns. The output-cell budget
is independent of destination coordinates; exceeding either produces a structured
`GridLimitError`. See [limits and budgets](persistence-and-export.md#coordinates-work-budgets-and-types).

SQL results and their output tables retain source-range provenance for the
[Vorgänger/Nachfolger inspector](lineage.md), including multi-step paths through
pivots and formulas. SQL provenance describes the complete input range.
