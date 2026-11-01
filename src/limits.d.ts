export const gridLimits: Readonly<{
  rows: 10000000;
  columns: 32768;
  rangeCells: 1000000;
  exportCells: 5000000;
  exportBytes: number;
  sqlResultCells: 500000;
}>;
export type GridLimitCode =
  | "GRID_ROWS"
  | "GRID_COLUMNS"
  | "RANGE_CELLS"
  | "EXPORT_CELLS"
  | "EXPORT_BYTES"
  | "SQL_RESULT_CELLS";
export class GridLimitError extends RangeError {
  constructor(
    code: GridLimitCode,
    limit: number,
    actual: number,
    message: string,
  );
  readonly code: GridLimitCode;
  readonly limit: number;
  readonly actual: number;
}
