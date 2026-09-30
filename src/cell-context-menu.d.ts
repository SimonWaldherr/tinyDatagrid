import type { GridPlugin, TinyDatagrid } from './tinygrid.js';
/** `visible` hides the entry for some cells; `label` may be a function so hosts can translate when the menu opens. */
export interface CellMenuItem { id: string; label?: string | ((grid: TinyDatagrid) => string); visible?: (grid: TinyDatagrid) => boolean; enabled?: (grid: TinyDatagrid) => boolean; action(grid: TinyDatagrid): unknown | Promise<unknown>; }
export interface CellContextMenu { open(clientX: number, clientY: number): void; close(focus?: boolean): void; destroy(): void; }
export function cellContextMenu(options?: { translate?: (key: string) => string; items?: CellMenuItem[] }): GridPlugin<CellContextMenu>;
