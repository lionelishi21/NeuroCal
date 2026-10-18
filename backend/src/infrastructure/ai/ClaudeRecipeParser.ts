import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { IRecipeParser } from "../../application/interfaces/IRecipeParser";
import type { ParseMessage } from "./ClaudeReasoningProvider";
import { RECIPE_PARSE_PROMPT } from "./prompts";
import { logLlmCall } from "./logLlmCall";

export const RECIPE_PARSE_MODEL = "claude-haiku-4-5";

export const ParsedRecipeSchema = z.object({
  problem: z.enum(["not_a_recipe"]).nullable(),
  title: z.string().min(1).max(120),
  servings: z.number().int().min(1).max(24).nullable(),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        quantity: z.string().max(40),
        grams: z.number().min(0).max(5000),
        catalogId: z.string().max(60).nullable(),
        estimate: z.object({
          calories: z.number().min(0).max(20000),
          proteinG: z.number().min(0).max(1000),
          carbsG: z.number().min(0).max(2000),
          fatG: z.number().min(0).max(1000),
        }),
        processing: z.enum(["whole", "processed", "ultra_processed"]),
      }),
    )
    .max(40),
});

/** Recipe text → ingredients in grams matched to the food catalog, via Claude, checked again on the way out. */
export class ClaudeRecipeParser implements IRecipeParser {
  private readonly messages: ParseMessage;

  constructor(options: { apiKey: string } | { messages: ParseMessage }) {
    this.messages = "messages" in options ? options.messages : new Anthropic({ apiKey: options.apiKey, maxRetries: 1, timeout: 25_000 }).messages;
  }

  async parse(input: Parameters<IRecipeParser["parse"]>[0]) {
    const started = Date.now();
    const response = await this.messages.parse({
      model: RECIPE_PARSE_MODEL,
      max_tokens: 4096,
      system: RECIPE_PARSE_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(input) }],
      output_config: { format: zodOutputFormat(ParsedRecipeSchema) },
    });
    // Cost and latency only: never log prompts or output text (ARCHITECTURE §7).
    logLlmCall({
      model: RECIPE_PARSE_MODEL,
      ms: Date.now() - started,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      stopReason: response.stop_reason,
    });
    if (response.stop_reason !== "end_turn") throw new Error(`Recipe parsing stopped early: ${response.stop_reason}`);
    // Validate again in our own schema even though the SDK parsed it (CLAUDE.md: LLM safety).
    const out = ParsedRecipeSchema.parse(response.parsed_output);
    return { ...(out.problem ? { problem: out.problem } : {}), title: out.title, servings: out.servings, ingredients: out.ingredients };
  }
}
