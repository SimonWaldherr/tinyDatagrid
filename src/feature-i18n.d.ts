export type FeatureText = Readonly<Record<string, readonly string[]>>;
export const featureText: FeatureText;
/** Translate optional demo-feature labels; unknown languages fall back to English. */
export function featureTranslator(language?: string): (key: string) => string;
declare const _default: FeatureText;
export default _default;
