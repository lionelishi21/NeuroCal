import { costUsd } from "../../domain/aiCost";

/**
 * One line per AI call: model, latency, tokens and what it cost. Never prompts, photos or output text
 * (ARCHITECTURE §7). Sum `costUsd` in CloudWatch Logs Insights for spend per day or per feature.
 */
export function logLlmCall(call: { model: string; ms: number; inputTokens?: number | null; outputTokens?: number | null; [k: string]: unknown }) {
  console.info(
    JSON.stringify({
      event: "llm_call",
      ...call,
      costUsd: costUsd(call.model, call.inputTokens ?? 0, call.outputTokens ?? 0),
    }),
  );
}
