import type { CellRange, GridPlugin } from './tinygrid.js';
export interface SheetPivotOptions {
  source: CellRange;
  target: { row: number; col: number };
  config: { rows?: string[]; columns?: string[]; values: Array<string | { field: string; aggregate?: 'sum'|'count'|'counta'|'avg'|'average'|'min'|'max'|'first'|'last'; as?: string }>; filters?: Record<string, string|number|boolean|Array<string|number|boolean>> };
}
export interface SheetPivots {
  insert(options: SheetPivotOptions): string;
  remove(id: string): boolean;
  refresh(): void;
  list(): Array<SheetPivotOptions & { id: string; output: CellRange; error: string | null }>;
}
export function sheetPivots(): GridPlugin<SheetPivots>;
