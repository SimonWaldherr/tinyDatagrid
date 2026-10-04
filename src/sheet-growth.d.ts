import type { TinyDatagrid } from "./tinygrid.js";
import type { DisposableTool } from "./ui-tools.js";
export const sheetLimits: { rows: number; columns: number };
export interface SheetGrowthOptions {
  /** Default 10,000; at most 2,000,000. */
  maxRows?: number;
  /** Default 256; at most 16,384. */
  maxColumns?: number;
  rowStep?: number;
  columnStep?: number;
}
/** Grow near the scrolling edge without changing selection or undo history. */
export function installSheetGrowth(
  grid: TinyDatagrid,
  options?: SheetGrowthOptions,
): DisposableTool;
