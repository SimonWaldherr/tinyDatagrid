import type { GridPlugin, TinyDatagrid } from "./tinygrid.js";
/** The values a cell may hold when a list validation rule (`{ type: 'list', values }`) covers it, or null. */
export function listChoices(
  grid: TinyDatagrid,
  row: number,
  col: number,
): Array<string | number | boolean> | null;
export interface ListDropdown {
  open(row?: number, col?: number): boolean;
  close(focus?: boolean): void;
  destroy(): void;
}
/**
 * Choice menu for cells with a list validation rule. The active cell shows an arrow; a click on it,
 * or Alt+Down, opens the menu. Arrow keys, Home/End, type-ahead, Enter and Escape work in the menu.
 */
export function listDropdown(options?: {
  translate?: (key: string) => string;
}): GridPlugin<ListDropdown>;
