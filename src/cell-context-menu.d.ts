import type { GridPlugin, TinyDatagrid } from './tinygrid.js';
export interface CellMenuItem { id: string; label?: string; enabled?: (grid: TinyDatagrid) => boolean; action(grid: TinyDatagrid): unknown | Promise<unknown>; }
export interface CellContextMenu { open(clientX: number, clientY: number): void; close(focus?: boolean): void; destroy(): void; }
export function cellContextMenu(options?: { translate?: (key: string) => string; items?: CellMenuItem[] }): GridPlugin<CellContextMenu>;
