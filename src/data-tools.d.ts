import type { CellRange, TinyDatagrid } from "./tinygrid.js";
export type DuplicateOptions = {
  columns?: number[];
  hasHeader?: boolean;
  matchCase?: boolean;
};
/** Rows (zero-based) that repeat an earlier row of the range, and the rows that stay. */
export function findDuplicateRows(
  grid: TinyDatagrid,
  range: CellRange,
  options?: DuplicateOptions,
): { keep: number[]; drop: number[]; first: number; compared: number[] };
/** Remove repeated rows inside a range, moving the rows below up; one undo step. */
export function removeDuplicateRows(
  grid: TinyDatagrid,
  range: CellRange,
  options?: DuplicateOptions,
): {
  removed: number;
  kept: number;
  refused?: "locked" | "spill" | "validation";
};
export function cleanSpaces(text: string): string;
/** Tidy entered text in a range; formulas, numbers and JSON stay unchanged. */
export function trimSpaces(
  grid: TinyDatagrid,
  range: CellRange,
): { changed: number; refused?: "validation" };
export function splitText(
  text: string,
  options?: { delimiter?: string; collapse?: boolean; quotes?: boolean },
): string[];
/** Split the text of the range's first column over that column and the ones to its right. */
export function splitTextToColumns(
  grid: TinyDatagrid,
  range: CellRange,
  options?: { delimiter?: string; collapse?: boolean; quotes?: boolean },
): {
  rows: number;
  columns: number;
  blocked?: boolean;
  refused?: "locked" | "validation";
};
export interface DataTools {
  sync(): void;
  scope(): CellRange;
}
export function installDataTools(options: {
  grid: TinyDatagrid;
  $: (selector: string) => any;
  t: (key: string) => string;
  notify: (message: string) => void;
  selection: () => CellRange;
  showDialog: (selector: string) => void;
}): DataTools;
