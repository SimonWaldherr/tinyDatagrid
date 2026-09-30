import type { CellRange, GridPlugin } from './tinygrid.js';
export type PivotConfig = { rows?: string[]; columns?: string[]; values: Array<string | { field: string; aggregate?: 'sum'|'count'|'counta'|'avg'|'average'|'min'|'max'|'first'|'last'; as?: string }>; filters?: Record<string, string|number|boolean|Array<string|number|boolean>> };
export interface SheetPivotOptions {
  analysis?: import('./analysis.js').AnalysisOptions;
  /** A range whose first row holds the field names. Not needed when `table` is given. */
  source?: CellRange;
  /** Id of a table to use as source. The pivot follows the table when it grows, shrinks or moves. */
  table?: string;
  target: { row: number; col: number };
  config: PivotConfig;
}
export interface PivotDefinition {
  id: string;
  /** The rows and columns being analysed, including the header row. Kept in step with `table`. */
  source: CellRange;
  /** Set when the pivot is bound to a table. */
  table?: string;
  target: { row: number; col: number };
  config: PivotConfig;
  analysis?: import('./analysis.js').AnalysisOptions;
  /** The cells the result occupies right now. */
  output: CellRange;
  /** An error code such as `#REF!` or `#SPILL!` while the pivot cannot be shown. */
  error: string | null;
}
export interface PivotChanges {
  config?: PivotConfig;
  analysis?: import('./analysis.js').AnalysisOptions;
  target?: { row: number; col: number };
  /** Bind the pivot to a table, or `null` to keep the current range as a fixed source. */
  table?: string | null;
  /** A fixed source range; this detaches the pivot from its table. */
  source?: CellRange;
}
export interface SheetPivots {
  insert(options: SheetPivotOptions): string;
  /** Change settings of an existing pivot as one undo step. Settings that are left out stay as they are. */
  update(id: string, changes: PivotChanges): boolean;
  remove(id: string): boolean;
  refresh(): void;
  /** Recalculate one pivot, or all of them, even if nothing they read has changed. */
  recalculate(id?: string): boolean;
  /** The pivot whose result covers the cell, or null. */
  at(row: number, col: number): PivotDefinition | null;
  get(id: string): PivotDefinition | null;
  drill(id: string, row: number, col: number): {headers:string[];entries:import('./analysis.js').SourceEntry[]};
  list(): PivotDefinition[];
}
export function sheetPivots(): GridPlugin<SheetPivots>;
