import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type {
  BioStateContext,
  IAiReasoningProvider,
  RecipeQueryOutput,
} from "../../application/interfaces/IAiReasoningProvider";
import { RECIPE_QUERY_PROMPT } from "./prompts";

export const RECIPE_QUERY_MODEL = "claude-haiku-4-5";

export const RecipeQuerySchema = z.object({
  searchQuery: z.string().min(3).max(200),
  contextualReasoning: z.string().min(1).max(400),
});

/** The one SDK call this adapter makes; injectable for tests. */
export type ParseMessage = Pick<Anthropic["messages"], "parse">;

/** Bio-state → recipe search query, via Claude with schema-constrained output (ARCHITECTURE §7.2). */
export class ClaudeReasoningProvider implements IAiReasoningProvider {
  private readonly messages: ParseMessage;

  constructor(options: { apiKey: string } | { messages: ParseMessage }) {
    this.messages =
      "messages" in options
        ? options.messages
        : new Anthropic({ apiKey: options.apiKey, maxRetries: 1, timeout: 10_000 }).messages;
  }

  async generateRecipeSearchQuery(context: BioStateContext): Promise<RecipeQueryOutput> {
    const started = Date.now();
    const response = await this.messages.parse({
      model: RECIPE_QUERY_MODEL,
      max_tokens: 1024,
      system: RECIPE_QUERY_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(context) }],
      output_config: { format: zodOutputFormat(RecipeQuerySchema) },
    });

    // Cost and latency only: never log prompts or output text (ARCHITECTURE §7).
    console.info(
      JSON.stringify({
        event: "llm_call",
        model: RECIPE_QUERY_MODEL,
        ms: Date.now() - started,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        stopReason: response.stop_reason,
      }),
    );

    if (response.stop_reason !== "end_turn") {
      throw new Error(`Recipe query stopped early: ${response.stop_reason}`);
    }
    // Validate again in our own schema even though the SDK parsed it (CLAUDE.md: LLM safety).
    return RecipeQuerySchema.parse(response.parsed_output);
  }
}
