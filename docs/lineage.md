# Precedents, dependents and analysis provenance

The dependency inspector follows formulas, worksheet pivot results and materialized
local SQL results in both directions, across worksheets. Its buttons navigate to
referenced cells/ranges. The demo follows multiple steps automatically, so an
output formula can lead through a SQL result and a pivot to the original data.

```js
// Direct references remain the default for existing callers.
grid.getPrecedents(row, col);
grid.getDependents(row, col);
// Follow every reachable intermediate step; duplicate ranges and cycles are handled.
grid.getPrecedents(row, col, { recursive: true });
grid.getDependents(row, col, { recursive: true });
```

References include `kind`: `formula`, `pivot`, `sql`, `spill`, or a host-defined
transformation name. Formula references include both the static formula references
(including all IF branches) and additional cell reads discovered during evaluation
of custom functions. Literal text resembling a formula does not create a reference.
Dynamic-array children refer to their originating formula cell.

Pivot and SQL provenance identifies **complete input ranges**, including headers,
filter fields and grouping/order inputs. It is a structural dependency, not an
exact attribution of each output value to only its contributing records. The
existing pivot/SQL drill-through APIs remain available for contributing rows.
Consequently, a filtered-out row can still be a predecessor: changing its filter
value may alter the query result.

SQL results expose a portable `lineage` object. Both `SELECT INTO` and
`sql.materialize(result)` / `sql.write(result, options)` attach that provenance to
the generated cells, including the header and an empty aggregate result. The SQL
text is retained. This tracks the origin of a snapshot; it does not automatically
refresh SQL results when source values change. Older saved SQL tables have no
provenance until they are regenerated. Source ranges record the query-time
coordinates; rerun queries after relocating/restructuring their sources.

Lineage survives worksheet switches, worksheet renaming, workbook JSON export/import
and undo/redo. Replacing a derived cell's raw value or value type removes its old
lineage. A deleted source sheet leaves a non-navigable reference rather than silently
linking another sheet by its name.

## Other transformations

BI summaries and `pivotAnalysis()` expose the same `lineage` object. Hosts can
attach it to output cells, or describe exact source ranges for their own analysis:

```js
const report = grid.feature("bi").summarize(source, config);
grid.transaction(() => {
  grid.setCell(12, 0, report.metrics[0].value);
  grid.setCellLineage(12, 0, report.lineage);
});

// For a custom result, supply worksheet IDs and zero-based rectangles.
grid.setCellLineage(12, 1, {
  kind: "regression",
  sources: [{ sheetId: sourceSheetId, r1: 1, r2: 100, c1: 0, c2: 2 }],
});
// Explicitly detach provenance without modifying the value.
grid.setCellLineage(12, 1, null);
```

For a grid without worksheets, use `sheetId: null`. Cell lineage is separate from
formula recalculation dependencies, so attaching provenance does not create live
formulas or change calculation/cycle semantics. Charts and non-cell KPI views can
use the analysis lineage supplied by their host; they do not become grid cells or
independent entries in the cell inspector automatically.
