import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { IMealPlanner, MealPlanContext } from "../../application/interfaces/IMealPlans";
import type { PlannedMeal } from "../../domain/mealPlan";
import { MEAL_KINDS } from "../../domain/types";
import type { ParseMessage } from "./ClaudeReasoningProvider";
import { MEAL_PLAN_PROMPT } from "./prompts";

export const MEAL_PLAN_MODEL = "claude-haiku-4-5";

const Ingredient = z.object({
  name: z.string().min(1).max(80),
  quantity: z.string().max(40),
  grams: z.number().min(0).max(2000),
  catalogId: z.string().max(60).nullable(),
  estimate: z.object({
    calories: z.number().min(0).max(5000),
    proteinG: z.number().min(0).max(300),
    carbsG: z.number().min(0).max(500),
    fatG: z.number().min(0).max(300),
  }),
  processing: z.enum(["whole", "processed", "ultra_processed"]),
});

export const MealPlanSchema = z.object({
  days: z
    .array(
      z.object({
        meals: z
          .array(
            z.object({
              kind: z.enum(MEAL_KINDS),
              title: z.string().min(3).max(120),
              ingredients: z.array(Ingredient).min(1).max(10),
              steps: z.array(z.string().min(1).max(240)).max(4),
            }),
          )
          .min(1)
          .max(4),
      }),
    )
    .min(1)
    .max(3),
});

/** Plan context → meals per day, via Claude with schema-constrained output, checked again on the way out. */
export class ClaudeMealPlanner implements IMealPlanner {
  private readonly messages: ParseMessage;

  constructor(options: { apiKey: string } | { messages: ParseMessage }) {
    // A few days of meals take a while to write; still inside the API's 29 s.
    this.messages = "messages" in options ? options.messages : new Anthropic({ apiKey: options.apiKey, maxRetries: 0, timeout: 27_000 }).messages;
  }

  async plan(context: MealPlanContext): Promise<PlannedMeal[][]> {
    const started = Date.now();
    const response = await this.messages.parse({
      model: MEAL_PLAN_MODEL,
      max_tokens: 6000,
      system: MEAL_PLAN_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(context) }],
      output_config: { format: zodOutputFormat(MealPlanSchema) },
    });
    // Cost and latency only: never log prompts or output text (ARCHITECTURE §7).
    console.info(
      JSON.stringify({
        event: "llm_call",
        model: MEAL_PLAN_MODEL,
        ms: Date.now() - started,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        stopReason: response.stop_reason,
      }),
    );
    if (response.stop_reason !== "end_turn") throw new Error(`Meal plan stopped early: ${response.stop_reason}`);
    // Validate again in our own schema even though the SDK parsed it (CLAUDE.md: LLM safety).
    return MealPlanSchema.parse(response.parsed_output).days.map((d) => d.meals);
  }
}
