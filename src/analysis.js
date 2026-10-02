import { PivotEngine } from "./tinygrid.js";

export const analysisScopes = ["all", "visible", "selection"];
export function includesAnalysisRow(
  grid,
  row,
  { scope = "visible", selection } = {},
) {
  if (!analysisScopes.includes(scope))
    throw new TypeError("Invalid analysis scope");
  if (scope === "selection")
    return (
      !!selection &&
      row >= Math.min(selection.r1, selection.r2) &&
      row <= Math.max(selection.r1, selection.r2)
    );
  return (
    scope === "all" ||
    (grid.isAnalysisRowVisible
      ? grid.isAnalysisRowVisible(row)
      : !grid.hiddenRows.has(row) && !grid.filteredRows.has(row))
  );
}
/** Read a header-first rectangle, retaining source row numbers for drill-through. */
export function analysisRecords(grid, source, options = {}) {
  if (
    !source ||
    !["r1", "r2", "c1", "c2"].every(
      (k) => Number.isInteger(source[k]) && source[k] >= 0,
    ) ||
    source.r2 < source.r1 ||
    source.c2 < source.c1
  )
    throw new TypeError("Invalid source range");
  if ((source.r2 - source.r1 + 1) * (source.c2 - source.c1 + 1) > 500000)
    throw new RangeError("Analysis source exceeds 500,000 cells");
  const headers = Array.from({ length: source.c2 - source.c1 + 1 }, (_, i) =>
    String(grid.getComputedValue(source.r1, source.c1 + i)),
  );
  if (new Set(headers).size !== headers.length)
    throw new TypeError("Analysis headers must be unique");
  const entries = [];
  for (let row = source.r1 + 1; row <= source.r2; row++) {
    if (
      options.scope !== "all" &&
      options.scope !== "selection" &&
      grid.isTableRowVisible
        ? !grid.isTableRowVisible(row, source.c1)
        : !includesAnalysisRow(grid, row, options)
    )
      continue;
    const values = headers.map((_, i) =>
      grid.getComputedValue(row, source.c1 + i),
    );
    if (values.some((v) => v !== "" && v != null))
      entries.push({
        row,
        record: Object.fromEntries(headers.map((h, i) => [h, values[i]])),
      });
  }
  return { headers, entries };
}
export function pivotAnalysis(grid, source, config, options = {}) {
  const { headers, entries } = analysisRecords(grid, source, options);
  const eligible = entries.filter(({ record }) =>
    Object.entries(config.filters || {}).every(([k, v]) =>
      typeof v === "function"
        ? v(record[k], record)
        : Array.isArray(v)
          ? v.includes(record[k])
          : record[k] === v,
    ),
  );
  const result = PivotEngine.pivot(
    eligible.map((e) => e.record),
    { ...config, filters: {} },
  );
  return {
    result,
    headers,
    drill(row, col) {
      const rk = result.rowKeys[row - 1],
        offset = col - result.rowFields.length;
      if (!rk || offset < 0 || !result.values.length) return [];
      const ck = result.colKeys[Math.floor(offset / result.values.length)];
      if (!ck) return [];
      return eligible.filter(
        ({ record }) =>
          result.rowFields.every((f, i) => String(record[f] ?? "") === rk[i]) &&
          result.colFields.every((f, i) => String(record[f] ?? "") === ck[i]),
      );
    },
  };
}
/** Shared context for host charts, pivots and tables. Selection means selected rows. */
export function analysisContext({ scope = "visible" } = {}) {
  return {
    name: "analysis",
    setup(grid) {
      if (!analysisScopes.includes(scope))
        throw new TypeError("Invalid analysis scope");
      let state = {
        scope,
        ...(scope === "selection" ? { selection: { ...grid.selection } } : {}),
      };
      return {
        get state() {
          return structuredClone(state);
        },
        set(next) {
          if (!analysisScopes.includes(next.scope))
            throw new TypeError("Invalid analysis scope");
          state = {
            scope: next.scope,
            ...(next.scope === "selection"
              ? { selection: { ...(next.selection || grid.selection) } }
              : {}),
          };
          grid.emit("analysis", structuredClone(state));
          return this;
        },
        records(source) {
          return analysisRecords(grid, source, state);
        },
        pivot(source, config) {
          return pivotAnalysis(grid, source, config, state);
        },
        filter(column, values) {
          if (!grid.table) throw new Error("Linked filtering requires a table");
          grid.setColumnFilter(column, values);
          this.set({ scope: "visible" });
        },
      };
    },
  };
}
