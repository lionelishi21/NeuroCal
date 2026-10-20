import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { BetterChoiceContext, IBetterChoiceAdvisor } from "../../application/interfaces/IFoodLabels";
import type { SuggestedRecipe } from "../../application/interfaces/IPantry";
import type { ParseMessage } from "./ClaudeReasoningProvider";
import { RecipeSchema, roundMacros } from "./ClaudePantryRecipeAssistant";
import { BETTER_CHOICE_PROMPT } from "./prompts";
import { logLlmCall } from "./logLlmCall";

export const BETTER_CHOICE_MODEL = "claude-haiku-4-5";

export const BetterChoiceSchema = z.object({
  lookFor: z.string().min(1).max(400),
  homemade: RecipeSchema.nullable(),
});

/** A processed food → a cleaner version and a homemade one, via Claude with schema-constrained output, checked again on the way out. */
export class ClaudeBetterChoiceAdvisor implements IBetterChoiceAdvisor {
  private readonly messages: ParseMessage;

  constructor(options: { apiKey: string } | { messages: ParseMessage }) {
    this.messages =
      "messages" in options
        ? options.messages
        // One recipe, like the pantry's but shorter; still inside the API's 29 s.
        : new Anthropic({ apiKey: options.apiKey, maxRetries: 1, timeout: 25_000 }).messages;
  }

  async suggest(context: BetterChoiceContext): Promise<{ lookFor: string; homemade: SuggestedRecipe | null }> {
    const started = Date.now();
    const response = await this.messages.parse({
      model: BETTER_CHOICE_MODEL,
      max_tokens: 2048,
      system: BETTER_CHOICE_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(context) }],
      output_config: { format: zodOutputFormat(BetterChoiceSchema) },
    });
    // Cost and latency only: never log prompts or output text (ARCHITECTURE §7).
    logLlmCall({
      model: BETTER_CHOICE_MODEL,
      ms: Date.now() - started,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      stopReason: response.stop_reason,
    });
    if (response.stop_reason !== "end_turn") throw new Error(`Better choice stopped early: ${response.stop_reason}`);
    // Validate again in our own schema even though the SDK parsed it (CLAUDE.md: LLM safety).
    const { lookFor, homemade } = BetterChoiceSchema.parse(response.parsed_output);
    return { lookFor, homemade: homemade ? roundMacros(homemade) : null };
  }
}
