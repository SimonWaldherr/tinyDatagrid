import { sourceLineage } from "./lineage.js";
import { analysisRecords } from "./analysis.js";
import { DecimalValue, compareDecimals } from "./decimal-values.js";
import { FormulaError, isFormulaError } from "./formula-errors.js";
import {
  arithmetic,
  divideNumbers,
  sumNumbers,
  meanNumbers,
  numericExtreme,
} from "./numeric-operations.js";

const aggregates = new Set([
  "count",
  "counta",
  "distinct",
  "sum",
  "average",
  "min",
  "max",
]);
const present = (v) => v !== "" && v != null;
const numeric = (v) =>
  typeof v === "bigint" ||
  v instanceof DecimalValue ||
  (typeof v === "number" && Number.isFinite(v));

function aggregate(entries, metric) {
  if (metric.aggregate === "count" && metric.field == null)
    return entries.length;
  const values = entries.map(({ record }) => record[metric.field]);
  const error = values.find(isFormulaError);
  if (error) return error;
  if (metric.aggregate === "count") return values.filter(numeric).length;
  if (metric.aggregate === "counta") return values.filter(present).length;
  // Same display-value grouping as pivots; blanks do not count as distinct values.
  if (metric.aggregate === "distinct")
    return new Set(values.filter(present).map(String)).size;
  const numbers = values.filter(numeric);
  try {
    if (metric.aggregate === "sum") return sumNumbers(numbers);
    if (!numbers.length) return null;
    if (metric.aggregate === "average") return meanNumbers(numbers);
    return numericExtreme(numbers, metric.aggregate === "max");
  } catch (e) {
    return new FormulaError(e instanceof RangeError ? "#NUM!" : "#VALUE!");
  }
}

function measure(entries, metric) {
  const value = aggregate(entries, metric);
  const result = { id: metric.id, value };
  if (metric.target != null) {
    result.target = metric.target;
    result.delta = null;
    result.attainment = null;
    if (numeric(value)) {
      try {
        result.delta = arithmetic("-", value, metric.target);
        if (compareDecimals(metric.target, 0) !== 0)
          result.attainment = divideNumbers(value, metric.target);
      } catch (e) {
        const error = new FormulaError(
          e instanceof RangeError ? "#NUM!" : "#VALUE!",
        );
        result.delta = error;
        result.attainment = error;
      }
    }
  }
  return result;
}

/** A snapshot of scoped KPIs and grouped measures. Call again after data/filter changes. */
export function summarizeBI(grid, source, config, options = {}) {
  if (!Array.isArray(config?.metrics) || !config.metrics.length)
    throw new TypeError("BI requires metrics");
  const dimensions = config.dimensions ?? [];
  if (
    !Array.isArray(dimensions) ||
    new Set(dimensions).size !== dimensions.length
  )
    throw new TypeError("Invalid BI dimensions");
  const ids = new Set();
  for (const metric of config.metrics) {
    if (
      !metric ||
      typeof metric.id !== "string" ||
      !metric.id ||
      ids.has(metric.id) ||
      !aggregates.has(metric.aggregate) ||
      (metric.target != null && !numeric(metric.target))
    )
      throw new TypeError("Invalid BI metric");
    ids.add(metric.id);
  }
  if (
    config.limit != null &&
    (!Number.isSafeInteger(config.limit) || config.limit < 1)
  )
    throw new TypeError("BI limit must be a positive integer");
  if (
    config.sort &&
    (!ids.has(config.sort.metric) ||
      !["asc", "desc"].includes(config.sort.direction ?? "desc"))
  )
    throw new TypeError("Invalid BI sort");
  // Preserve typed calculation errors while using the shared visibility and range rules.
  const reader = {
    hiddenRows: grid.hiddenRows,
    filteredRows: grid.filteredRows,
    isAnalysisRowVisible: grid.isAnalysisRowVisible?.bind(grid),
    isTableRowVisible: grid.isTableRowVisible?.bind(grid),
    getComputedValue: (grid.getCalculationValue ?? grid.getComputedValue).bind(
      grid,
    ),
  };
  const { headers, entries } = analysisRecords(reader, source, options);
  const fields = [
    ...dimensions,
    ...config.metrics
      .filter((m) => m.field != null || m.aggregate !== "count")
      .map((m) => m.field),
    ...Object.keys(config.filters ?? {}),
  ];
  if (fields.some((field) => !headers.includes(field)))
    throw new TypeError("Unknown BI field");
  const eligible = entries.filter(({ record }) =>
    Object.entries(config.filters ?? {}).every(([field, expected]) =>
      Array.isArray(expected)
        ? expected.includes(record[field])
        : Object.is(record[field], expected),
    ),
  );
  const buckets = new Map();
  if (dimensions.length)
    for (const entry of eligible) {
      const labels = dimensions.map((field) =>
        String(entry.record[field] ?? ""),
      );
      const key = JSON.stringify(labels);
      if (!buckets.has(key)) buckets.set(key, { labels, entries: [] });
      buckets.get(key).entries.push(entry);
    }
  let groups = [...buckets.values()].map((bucket) => ({
    dimensions: Object.fromEntries(
      dimensions.map((field, i) => [field, bucket.labels[i]]),
    ),
    rowCount: bucket.entries.length,
    metrics: config.metrics.map((metric) => measure(bucket.entries, metric)),
    entries: bucket.entries,
  }));
  if (config.sort) {
    const index = config.metrics.findIndex((m) => m.id === config.sort.metric);
    groups.sort((a, b) => {
      const av = a.metrics[index].value,
        bv = b.metrics[index].value;
      if (!numeric(av)) return numeric(bv) ? 1 : 0;
      if (!numeric(bv)) return -1;
      return (
        compareDecimals(av, bv) * (config.sort.direction === "asc" ? 1 : -1)
      );
    });
  }
  const groupCount = groups.length;
  if (config.limit != null) groups = groups.slice(0, config.limit);
  return {
    headers,
    lineage: sourceLineage(grid, source, "bi"),
    rowCount: eligible.length,
    metrics: config.metrics.map((metric) => measure(eligible, metric)),
    groupCount,
    groups: groups.map(({ entries, ...group }) => group),
    drill(index) {
      if (index == null) return eligible.slice();
      return Number.isInteger(index) && index >= 0
        ? (groups[index]?.entries.slice() ?? [])
        : [];
    },
  };
}

/** Uses the current analysis context unless a scope is explicitly supplied. */
export function businessIntelligence() {
  return {
    name: "bi",
    setup(grid) {
      return {
        summarize(source, config, options) {
          return summarizeBI(
            grid,
            source,
            config,
            options ?? grid.feature("analysis")?.state ?? { scope: "visible" },
          );
        },
      };
    },
  };
}
