import type { GridPlugin } from './tinygrid.js';
export interface Worksheets {
  readonly activeId: string;
  /** Tabs in display order; hidden sheets are included with hidden: true. */
  list(): Array<{id: string; name: string; color: string | null; hidden: boolean}>;
  listObjects(): Array<{id:string;type:'table'|'pivot'|'chart'|'heatmap';name:string;range:import('./tinygrid.js').CellRange;chartType?:string;ruleIndex?:number;sheetId:string;sheetName:string}>;
  add(name?: string): string;
  importSheet(sheet: {name?: string; cells: any[]; [key: string]: unknown}): unknown;
  select(id: string): boolean;
  rename(id: string, name: string): void;
  remove(id: string): boolean;
  /** Copy a sheet next to its source; returns the new id. The copy is named "Name (2)" unless a name is given. */
  duplicate(id: string, name?: string): string | null;
  /** Move a sheet to a zero-based position among all sheets. */
  move(id: string, index: number): boolean;
  /** Set the tab color as #rrggbb, or null to clear it. */
  setColor(id: string, color: string | null): boolean;
  /** Hide or show a tab. At least one sheet stays visible. */
  setHidden(id: string, hidden?: boolean): boolean;
}
export function worksheets(): GridPlugin<Worksheets>;
