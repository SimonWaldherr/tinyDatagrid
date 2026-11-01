# Basic business intelligence

The optional `tiny-datagrid/bi` module adds KPI summaries, target comparisons,
ranked groups and drill-through to the existing pivots, charts and table filters.
It has no additional dependencies and does not write cells.

```js
import { analysisContext } from "tiny-datagrid/analysis";
import { businessIntelligence, summarizeBI } from "tiny-datagrid/bi";

grid.use(analysisContext());
grid.use(businessIntelligence());

// Header-first rectangle: Region | Sales
const source = { r1: 0, c1: 0, r2: 100, c2: 1 };
const config = {
  metrics: [
    { id: "revenue", field: "Sales", aggregate: "sum", target: 10000 },
    { id: "averageSale", field: "Sales", aggregate: "average" },
    { id: "records", aggregate: "count" },
    { id: "regions", field: "Region", aggregate: "distinct" },
  ],
  dimensions: ["Region"],
  sort: { metric: "revenue", direction: "desc" },
  limit: 10,
};
const report = grid.feature("bi").summarize(source, config);
console.log(report.metrics, report.groups);
console.log(report.drill(0)); // source row numbers and computed records of the top group

// Or without plugins:
const allRows = summarizeBI(grid, source, config, { scope: "all" });
```

The plugin uses the current analysis context, defaulting to visible rows.
Explicit options override it. `all` includes hidden and filtered rows;
`selection` uses the selected row interval, including when its endpoints are
reversed. With `scope: 'selection'`, supply `selection` as a cell range in the
options. The first source row contains unique field names; wholly empty rows
are skipped. Source ranges are limited to 500,000 cells.

Aggregates are `sum`, `average`, `min`, `max`, `count`, `counta` and `distinct`.
Numeric aggregates accept finite numbers, BigInts and DecimalValues, preserving
the grid's exact arithmetic. Text (including numeric strings), booleans and blanks
are ignored. `count` without a field counts records; with a field it counts numeric
values. `counta` counts nonblank values. `distinct` excludes blanks and compares
string representations, matching pivot grouping. Typed formula errors in a metric
field propagate to its result. Empty sums/counts are zero; empty averages/extrema
are `null`.

A metric's optional `target` yields `delta = value - target` and
`attainment = value / target` (1 means 100%). Attainment is `null` for a zero target;
comparisons are `null` for unavailable or erroneous values. These are arithmetic
comparisons; whether a higher value is desirable depends on the metric.

`filters` matches field values or lists of accepted values, in addition to the
analysis scope. `dimensions` supports multiple fields. Groups retain first-seen
order unless sorted by a metric; errors and empty values sort last. `limit` retains
the first N groups. `groupCount` reports the full group count and global metrics
always cover every eligible record, even when groups are limited. `drill(index)`
uses the displayed group's zero-based index; `drill()` returns all eligible records.

Reports are snapshots: call `summarize` again after edits, table filters or scope
changes. Hosts can use the existing grid change/analysis events to refresh.
The demo's analysis results display record count, sum, average and distinct group
values as KPI cards, using the selected value/dimension fields and analysis scope.

Each report exposes portable `lineage` for attaching its origin to output cells
with `grid.setCellLineage()`. See [analysis provenance](lineage.md).
