import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { IPantryRecipeAssistant, PantryRecipeContext, SuggestedRecipe } from "../../application/interfaces/IPantry";
import type { ParseMessage } from "./ClaudeReasoningProvider";
import { PANTRY_RECIPES_PROMPT } from "./prompts";

export const PANTRY_RECIPES_MODEL = "claude-haiku-4-5";

export const PantryRecipesSchema = z.object({
  recipes: z
    .array(
      z.object({
        title: z.string().min(3).max(120),
        minutes: z.number().int().min(1).max(240),
        servings: z.number().int().min(1).max(12),
        calories: z.number().int().min(0).max(3000),
        macros: z.object({
          proteinG: z.number().min(0).max(300),
          carbsG: z.number().min(0).max(500),
          fatG: z.number().min(0).max(300),
        }),
        ingredients: z.array(z.object({ name: z.string().min(1).max(80), quantity: z.string().max(40) })).min(1).max(20),
        steps: z.array(z.string().min(1).max(400)).min(1).max(12),
        whyItFits: z.string().min(1).max(300),
      }),
    )
    .max(3),
});

/** Pantry → recipes, via Claude with schema-constrained output, checked again on the way out. */
export class ClaudePantryRecipeAssistant implements IPantryRecipeAssistant {
  private readonly messages: ParseMessage;

  constructor(options: { apiKey: string } | { messages: ParseMessage }) {
    this.messages =
      "messages" in options
        ? options.messages
        // Three full recipes take longer than a search query; still inside the API's 29 s.
        : new Anthropic({ apiKey: options.apiKey, maxRetries: 1, timeout: 25_000 }).messages;
  }

  async suggest(context: PantryRecipeContext): Promise<SuggestedRecipe[]> {
    const started = Date.now();
    const response = await this.messages.parse({
      model: PANTRY_RECIPES_MODEL,
      max_tokens: 4096,
      system: PANTRY_RECIPES_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(context) }],
      output_config: { format: zodOutputFormat(PantryRecipesSchema) },
    });
    // Cost and latency only: never log prompts or output text (ARCHITECTURE §7).
    console.info(
      JSON.stringify({
        event: "llm_call",
        model: PANTRY_RECIPES_MODEL,
        ms: Date.now() - started,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        stopReason: response.stop_reason,
      }),
    );
    if (response.stop_reason !== "end_turn") throw new Error(`Pantry recipes stopped early: ${response.stop_reason}`);
    // Validate again in our own schema even though the SDK parsed it (CLAUDE.md: LLM safety).
    return PantryRecipesSchema.parse(response.parsed_output).recipes.map((r) => ({
      ...r,
      macros: { proteinG: Math.round(r.macros.proteinG), carbsG: Math.round(r.macros.carbsG), fatG: Math.round(r.macros.fatG) },
    }));
  }
}
