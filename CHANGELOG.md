# Changelog

## Unreleased

- Add cooperative workbook snapshots and row-wise file export with cancellation,
  progress and independent cell/byte budgets; use them in the demo's Save/export actions.
- Coalesce autosaves, reuse captured workbooks for IndexedDB and bounded recovery,
  distinguish recovery-only saves, and retain the newer stored revision on restore.
- Share coordinate limits across the core, SQL destinations, growth and rule tools;
  expose structured limit errors and tighten TypeScript constructor/public API checks.

- Preserve numeric formula tokens and precise decimal cell inference; exact integer
  powers and 34-significant-digit recurring division, averages and square roots.
- Stream SUM/AVERAGE/MIN/MAX/COUNT/COUNTA/COUNTBLANK over sparse ranges, with
  incremental invalidation for new cells, worksheet references and spill results.
- Journal changed cell records for edit/undo/redo and roll back failed outer
  transactions even when retained undo history is disabled.
- Compact large-sheet geometry and workbook dimensions; up to 10 million rows
  and 32,768 columns, compressed two-axis scrolling and configurable dense-range budgets.
- Add headless core regressions and an optional real-browser scalability test.

## 0.1.0 — prepared for the first npm release

- Dependency-free ESM spreadsheet and data grid with editing, formatting,
  filtering, sorting, virtualized rendering, history and workbook import/export.
- Formula catalog with dynamic arrays, JSON, exact decimals, typed errors,
  calendar/time values and shared German, English, French and Italian aliases.
- Optional worksheets, in-sheet pivots, charts, heatmaps, forms, BI summaries,
  provenance tracing, validation and IndexedDB persistence.
- Local SQL with grouping, aggregates, DISTINCT, source-row drill-through and
  editable result snapshots through SELECT INTO and materialization APIs.
- Reused aggregate calculations, indexed constant IN lists, limited projection
  and large DISTINCT drill buckets; bound LIMIT/OFFSET and NULLS FIRST/LAST.
- Public typed modules for all reusable demo tools: SQL/analysis dialogs,
  simulations, object browser, autosave, sheet growth, translations, sample
  workbooks and import type inference. The demo shares these implementations.
- Generated tool labels, configurable saving/growth and disposable UI helpers.
  Grid destruction now delivers its cleanup event.
- npm export-map and tarball checks, offline installation tests, TypeScript
  consumer tests, a reproducible development lockfile and a CI release check.
