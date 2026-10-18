/**
 * List prices in US dollars per million tokens, for the cost of each AI call in the logs. Anthropic's
 * from its model table (2026-10-06); OpenAI's from its pricing page, to check when it changes.
 */
const PRICES: Record<string, { input: number; output: number }> = {
  "claude-haiku-4-5": { input: 1.0, output: 5.0 },
  "gpt-4o": { input: 2.5, output: 10.0 },
  "text-embedding-3-small": { input: 0.02, output: 0 },
};

/** Dollars for one call, to six places; null for a model without a listed price. */
export function costUsd(model: string, inputTokens = 0, outputTokens = 0): number | null {
  const p = PRICES[model];
  if (!p) return null;
  return Math.round(((inputTokens * p.input + outputTokens * p.output) / 1_000_000) * 1e6) / 1e6;
}
