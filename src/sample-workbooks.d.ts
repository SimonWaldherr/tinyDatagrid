import type { Workbook, WorkbookSheet } from "./tinygrid.js";
export type DemoWorkbookName =
  | "blank"
  | "timetable"
  | "week"
  | "timesheet"
  | "comparison"
  | "learning"
  | "budget"
  | "project"
  | "inventory"
  | "text"
  | "json"
  | "arrays"
  | "geometry";
export function demoWorkbook(
  key: DemoWorkbookName,
  language?: string,
): Workbook & { sheets: WorkbookSheet[] };
