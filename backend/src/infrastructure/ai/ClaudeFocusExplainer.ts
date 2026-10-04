import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { IFocusExplainer } from "../../application/interfaces/IFocusExplainer";
import type { FocusComponents } from "../../domain/types";
import type { ParseMessage } from "./ClaudeReasoningProvider";
import { FOCUS_EXPLANATION_PROMPT } from "./prompts";

export const FOCUS_EXPLANATION_MODEL = "claude-haiku-4-5";

export const FocusExplanationSchema = z.object({ explanation: z.string().min(1).max(300) });

/** Focus Score → one or two plain sentences (ARCHITECTURE §7.4). Sees the components only, never raw data. */
export class ClaudeFocusExplainer implements IFocusExplainer {
  private readonly messages: ParseMessage;

  constructor(options: { apiKey: string } | { messages: ParseMessage }) {
    this.messages =
      "messages" in options
        ? options.messages
        : new Anthropic({ apiKey: options.apiKey, maxRetries: 1, timeout: 10_000 }).messages;
  }

  async explain(input: { score: number; components: FocusComponents }): Promise<string> {
    const started = Date.now();
    const response = await this.messages.parse({
      model: FOCUS_EXPLANATION_MODEL,
      max_tokens: 512,
      system: FOCUS_EXPLANATION_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(input) }],
      output_config: { format: zodOutputFormat(FocusExplanationSchema) },
    });
    console.info(
      JSON.stringify({
        event: "llm_call",
        model: FOCUS_EXPLANATION_MODEL,
        ms: Date.now() - started,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        stopReason: response.stop_reason,
      }),
    );
    if (response.stop_reason !== "end_turn") throw new Error(`Focus explanation stopped early: ${response.stop_reason}`);
    return FocusExplanationSchema.parse(response.parsed_output).explanation;
  }
}
