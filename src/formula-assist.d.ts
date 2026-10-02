import type { TinyDatagrid } from "./tinygrid.js";

export type FormulaAssistOptions = {
  language?: string | (() => string);
  maxItems?: number;
};
export type FormulaContext = {
  word: string;
  start: number;
  call: string | null;
  argument: number;
} | null;
export function formulaNames(grid: TinyDatagrid, language?: string): string[];
export function searchFormulaNames(
  grid: TinyDatagrid,
  query: string,
  language?: string,
): string[];
export function parseSignature(signature: string): {
  name: string;
  params: string[];
};
export function analyzeFormula(text: string, caret: number): FormulaContext;
/** Add accessible formula completion and inline function argument hints to an input. */
export function attachFormulaAssist(
  input: HTMLInputElement | HTMLTextAreaElement,
  grid: TinyDatagrid,
  options?: FormulaAssistOptions,
): {
  update(): void;
  close(): void;
  destroy(): void;
};
export type FormulaToolsOptions = {
  grid: TinyDatagrid;
  /** Resolve the controls listed in the formula tools integration guide. */
  $: (selector: string) => HTMLElement;
  t: (key: string) => string;
  language?: () => string;
  formatValue?: (value: unknown) => string;
};
/** Connect searchable function help and a precedents/dependents inspector. */
export function installFormulaTools(options: FormulaToolsOptions): {
  refreshFunctionHelp(): void;
  refreshReferences(): void;
};
