export type FormulaLanguage = "de" | "en" | "fr" | "it";
export interface FormulaDefinition {
  readonly id: string;
  readonly names: Readonly<Record<FormulaLanguage, string>>;
  readonly args: string;
  readonly descriptions: Readonly<{ de: string; en: string }>;
  readonly category: string;
  readonly availability: "core" | "app" | "optional";
  readonly evaluation: "special" | "eager";
  readonly arity: Readonly<{ min: number; max: number }>;
  readonly volatile: boolean;
  readonly aliases: readonly string[];
}
export const formulaLanguages: readonly FormulaLanguage[];
export const formulaCatalog: readonly FormulaDefinition[];
export function formulaLanguage(language?: string): FormulaLanguage;
export function normalizeFormulaName(name: string): string;
export function resolveFormulaName(name: string): string;
export function formulaDefinition(name: string): FormulaDefinition | undefined;
export function localizedFormulaName(name: string, language?: string): string;
