import type {
  TinyDatagrid,
  CellRange,
  CellLineage,
  GridPlugin,
  SQLResultSet,
} from "./tinygrid.js";
import type { SourceEntry } from "./analysis.js";
export interface LocalSQLOptions {
  /** SQL defaults to all rows, independently of the current table filters. */
  scope?: "all" | "visible" | "selection";
  selection?: CellRange;
}
export interface LocalSQLResult extends SQLResultSet<unknown[]> {
  columns: string[];
  rows: unknown[][];
  rowCount: number;
  tableId: string;
  lineage: CellLineage;
  /** Present when SELECT INTO created an output table. */
  destination?: SQLMaterializedTable;
  toTable(): unknown[][];
  /** Source entries for a zero-based result row, after ORDER BY and LIMIT. */
  drill(index: number): SourceEntry[];
}
export interface LocalSQL {
  query(
    sql: string,
    params?: unknown[],
    options?: LocalSQLOptions,
  ): LocalSQLResult;
  materialize(
    result: Pick<LocalSQLResult, "columns" | "rows"> & {
      lineage?: CellLineage;
    },
    options?: SQLMaterializeOptions,
  ): SQLMaterializedTable;
  write(
    result: Pick<LocalSQLResult, "columns" | "rows"> & {
      lineage?: CellLineage;
    },
    options: SQLWriteOptions,
  ): SQLMaterializedTable;
  tables(): Array<{ id: string; name: string; columns: string[] }>;
}
export interface SQLMaterializeOptions {
  /** Used as the base name; duplicates receive a numeric suffix. */
  sheetName?: string;
  tableName?: string;
}
export interface SQLMaterializedTable {
  sheetId: string;
  tableId: string;
  name: string;
  range: CellRange;
}
export function materializeSQLResult(
  grid: TinyDatagrid,
  result: Pick<LocalSQLResult, "columns" | "rows"> & { lineage?: CellLineage },
  options?: SQLMaterializeOptions,
): SQLMaterializedTable;
export interface SQLWriteOptions {
  sheetName: string;
  cell?: string;
  tableName?: string;
  /** Defaults to true. SELECT INTO preserves the source worksheet instead. */
  activate?: boolean;
}
export function writeSQLResult(
  grid: TinyDatagrid,
  result: Pick<LocalSQLResult, "columns" | "rows"> & { lineage?: CellLineage },
  options: SQLWriteOptions,
): SQLMaterializedTable;
export function queryTables(
  grid: TinyDatagrid,
  sql: string,
  params?: unknown[],
  options?: LocalSQLOptions,
): LocalSQLResult;
export function localSQL(): GridPlugin<LocalSQL>;
