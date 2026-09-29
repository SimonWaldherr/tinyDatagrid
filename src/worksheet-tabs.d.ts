import type { GridPlugin } from './tinygrid.js';
export interface WorksheetTabs { render(): void; manage(id: string): void; destroy(): void; }
export function worksheetTabs(options: { container: string | HTMLElement; translate?: (key: string) => string }): GridPlugin<WorksheetTabs>;
