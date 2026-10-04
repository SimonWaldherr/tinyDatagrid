import type { DisposableTool, ToolHost } from "./ui-tools.js";
export interface SimulationTools extends DisposableTool {
  open(kind: "life" | "mandelbrot"): void;
  refreshLabels(): void;
}
/** Insertions require worksheets and conditionalFormatting; installs MANDELBROT. */
export function installSimulations(options: ToolHost): SimulationTools;
