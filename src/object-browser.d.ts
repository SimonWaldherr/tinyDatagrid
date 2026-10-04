import type { CellRange } from "./tinygrid.js";
import type { DisposableTool, ToolHost } from "./ui-tools.js";
export interface ObjectBrowser extends DisposableTool {
  render(): void;
}
export function installObjectBrowser(
  options: ToolHost & {
    openChart: (options: { range: CellRange; chartType?: string }) => void;
  },
): ObjectBrowser;
