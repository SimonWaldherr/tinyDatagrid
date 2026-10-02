import type { GridPlugin } from "./tinygrid.js";
export interface WorksheetTabs {
  render(): void;
  /** Open the sheet context menu at viewport coordinates. */
  openMenu(id: string, point: { x: number; y: number }): void;
  closeMenu(returnFocus?: boolean): void;
  /** Rename the tab in place. */
  rename(id: string): void;
  /** Open the context menu at the tab (earlier API name). */
  manage(id: string): void;
  destroy(): void;
}
export function worksheetTabs(options: {
  container: string | HTMLElement;
  translate?: (key: string) => string;
}): GridPlugin<WorksheetTabs>;
