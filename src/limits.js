/** Coordinate limits are independent of budgets for materialized work. */
export const gridLimits = Object.freeze({
  rows: 10_000_000,
  columns: 32_768,
  rangeCells: 1_000_000,
  exportCells: 5_000_000,
  exportBytes: 64 * 1024 * 1024,
  sqlResultCells: 500_000,
});

export class GridLimitError extends RangeError {
  constructor(code, limit, actual, message) {
    super(message);
    this.name = "GridLimitError";
    this.code = code;
    this.limit = limit;
    this.actual = actual;
  }
}

export function positiveInteger(value, name) {
  if (!Number.isSafeInteger(value) || value < 1)
    throw new TypeError(`${name} must be a positive safe integer`);
  return value;
}

export function checkDimensions(rows, columns) {
  for (const [value, limit, code, label] of [
    [rows, gridLimits.rows, "GRID_ROWS", "rows"],
    [columns, gridLimits.columns, "GRID_COLUMNS", "columns"],
  ]) {
    positiveInteger(value, label);
    if (value > limit)
      throw new GridLimitError(
        code,
        limit,
        value,
        `Grid supports at most ${limit} ${label}`,
      );
  }
}
