import type { CellRange, ConditionalRule, TinyDatagrid, ValidationRule } from './tinygrid.js';
export type RuleCondition = { id: ConditionalRule['operator']; key: string; inputs: 0 | 1 | 2 };
export type RulePreset = { id: string; key: string; style: ConditionalRule['style'] };
/** The conditions offered for highlighting, with the number of values each one needs. */
export const CONDITIONS: RuleCondition[];
/** Ready-made looks; every preset that sets a fill also sets a matching text color. */
export const PRESETS: RulePreset[];
/** "B2", "B2:D9", or whole columns such as "B:B". Returns null for anything else. */
export function parseRangeText(text: string, options?: { columns?: number }): CellRange | null;
/** The address of a range: "B2", "B2:D9", or "B:B" when it covers whole columns. */
export function describeRange(range: CellRange): string;
/** The parts of `range` outside `hole`: zero to four rectangles. */
export function subtractRange(range: CellRange, hole: CellRange): CellRange[];
/** Text typed for a rule, read like cell input: a number, a boolean, or the text itself. */
export function parseRuleValue(text: string, options?: { locale?: string }): number | boolean | string;
/** Allowed values from text: one per line, or separated by commas or semicolons. Duplicates are dropped. */
export function parseListValues(text: string): string[];
/** A short description such as "is greater than 100". */
export function conditionText(rule: ConditionalRule | { type: 'colorScale'; min: number; max: number }, t: (key: string) => string): string;
/** A short description such as "Whole number from 1 to 10". */
export function validationText(rule: ValidationRule, t: (key: string) => string): string;
/** Add a conditional formatting rule as one undo step. */
export function addConditionalFormat(grid: TinyDatagrid, rule: ConditionalRule | Record<string, unknown>): unknown;
/** Remove the rule at `index`, or all rules when `index` is null. One undo step. */
export function removeConditionalFormat(grid: TinyDatagrid, index: number | null): unknown;
/** Set a validation rule. It replaces earlier rules in the cells of its range and leaves them elsewhere. */
export function setValidation(grid: TinyDatagrid, rule: ValidationRule): unknown;
/** Remove the validation rule at `index`, or all rules when `index` is null. One undo step. */
export function removeValidation(grid: TinyDatagrid, index: number | null): unknown;
export interface RuleTools { sync(): void; refresh(): void; }
export function installRuleTools(options: { grid: TinyDatagrid; $: (selector: string) => any; t: (key: string) => string; notify: (message: string) => void; selection: () => CellRange; showDialog: (selector: string) => void }): RuleTools;
