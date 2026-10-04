export const languages: Array<[string, string]>;
export const locales: Readonly<
  Record<"fr" | "es" | "it" | "nl", Readonly<Record<string, string>>>
>;
export function detectLanguage(candidates?: readonly string[]): string;
/** Complete demo labels; language tags are normalized and unknown tags use English. */
export function translator(language?: string): (key: string) => string;
