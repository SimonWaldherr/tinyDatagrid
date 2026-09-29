import type { GridPlugin } from './tinygrid.js';
export interface Worksheets {
  readonly activeId: string;
  list(): Array<{id: string; name: string}>;
  add(name?: string): string;
  importSheet(sheet: {name?: string; cells: any[]; [key: string]: unknown}): unknown;
  select(id: string): boolean;
  rename(id: string, name: string): void;
  remove(id: string): boolean;
}
export function worksheets(): GridPlugin<Worksheets>;
