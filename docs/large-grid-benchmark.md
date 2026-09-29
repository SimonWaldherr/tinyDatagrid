# Large grid benchmark

Run `npm run benchmark:large` (Node heap capped at 2 GiB).

The model has **2,000,000 rows × 100 columns**, with 200,001 stored cells.
A separate loop scans all 200,000,000 deterministic source values, accumulating
row sums into BigInt to avoid a rounded checksum. This streaming source scan is
not a grid calculation/render benchmark. No 200-million-entry cell Map is allocated.

Measured on Apple M2 Max / Node 26.10.0, September 29, 2026:

| Operation | Before | After |
|---|---:|---:|
| Initial layout | 38.7 ms | 22.0 ms |
| Repeated layout (mean of 5) | 39.4 ms | 18.5 ms |
| Edit with history enabled | 2152.4 ms | 152.5 ms |
| Edit without history | 5.9 ms | 5.9 ms |
| Heap snapshot after workload | 759.1 MiB | 201.1 MiB |

Timing is a local before/after sample, not a cross-device guarantee. Heap snapshots
include unreclaimed garbage; typed-array buffers are outside the JS heap. The
final run additionally records RSS and array buffers in the JSON report.

## Changes

- New typed input leaves the caret after the initial character; opening existing
  content still selects it. A regression test reproduces subsequent replacement.
- Large grids automatically enable virtualization above 100,000 logical cells.
- Prefix offsets use Float64Array; unfiltered dimensions reuse existing arrays.
- Array history diffs compare indexed values directly without constructing
  millions of temporary Object.entries / Set items.
- Virtual canvas height is capped at 8,000,000 CSS pixels. Logical scroll mapping
  reaches the last row without requiring a 56-million-pixel browser element.
- Sidebar summaries no longer materialize the entire grid as records. Closed
  sidebars skip calculation, updates are debounced, previews show at most 200
  results, and expensive previews require an explicit refresh. Preview source
  ranges above 500,000 cells are refused with a visible explanation.

## Coverage and limitations

`npm test` includes editor caret behavior, indexed history diffs, automatic
virtualization, navigation/hit testing at row 2,000,000 and frozen-pane coordinates.
The benchmark checks a formula at the final cell and undo correctness.
These are Node model/regression tests, **not browser layout or paint timings**.
Browser validation was blocked by the browser tool's URL security policy.
A fully populated 200-million-cell workbook, full-sheet sorting/pivots/export,
and interactive rendering at that density are not validated or guaranteed.
