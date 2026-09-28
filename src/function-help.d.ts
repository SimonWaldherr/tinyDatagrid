export type FunctionDescription = { signature?: string; description?: string; de?: string; en?: string };
export function functionHelp(name: string, language?: string, custom?: Record<string, FunctionDescription>): { name: string; signature: string; description: string };
export function documentedFunctions(): string[];
