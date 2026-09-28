import type { GridPlugin } from './tinygrid.js';
export interface Worksheets {
  readonly activeId: string;
  list(): Array<{id: string; name: string}>;
  add(name?: string): string;
  select(id: string): boolean;
  rename(id: string, name: string): void;
  remove(id: string): boolean;
}
export function worksheets(): GridPlugin<Worksheets>;
