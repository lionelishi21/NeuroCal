import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import type { IDishRecipeWriter } from "../../application/interfaces/IDishRecipeWriter";
import { COOK_THIS_PROMPT } from "./prompts";
import { logLlmCall } from "./logLlmCall";
import type { ParseCompletion } from "./OpenAiVisionProvider";

/** The vision model "Cook this" uses; a newer OpenAI model can be passed in instead (COOK_THIS_MODEL). */
export const COOK_THIS_MODEL = "gpt-4o";

const amount = (max: number) => z.number().min(0).max(max);

export const DishRecipeSchema = z.object({
  problem: z.enum(["too_dark", "no_food_found", "blurry"]).nullable(),
  dish: z.string().max(120),
  title: z.string().max(120),
  minutes: z.number().int().min(0).max(600),
  servings: z.number().int().min(1).max(6),
  ingredients: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        quantity: z.string().max(40),
        grams: amount(5000),
        catalogId: z.string().max(60).nullable(),
        estimate: z.object({ calories: amount(20000), proteinG: amount(1000), carbsG: amount(2000), fatG: amount(1000) }),
        processing: z.enum(["whole", "processed", "ultra_processed"]),
      }),
    )
    .max(30),
  steps: z.array(z.string().min(1).max(400)).max(10),
  swaps: z.array(z.string().min(1).max(200)).max(3),
  glycemicLoad: z.enum(["low", "medium", "high"]),
});

/** Dish photo → a recipe that suits the person, via an OpenAI vision model with a strict JSON schema. */
export class OpenAiDishRecipeWriter implements IDishRecipeWriter {
  private readonly completions: ParseCompletion;
  private readonly model: string;

  constructor(options: ({ apiKey: string } | { completions: ParseCompletion }) & { model?: string }) {
    this.completions =
      "completions" in options ? options.completions : new OpenAI({ apiKey: options.apiKey, maxRetries: 1, timeout: 45_000 }).chat.completions;
    this.model = options.model || COOK_THIS_MODEL;
  }

  async write(input: Parameters<IDishRecipeWriter["write"]>[0]) {
    const started = Date.now();
    const dataUrl = `data:${input.photo.mediaType};base64,${Buffer.from(input.photo.bytes).toString("base64")}`;
    const completion = await this.completions.parse({
      model: this.model,
      messages: [
        { role: "system", content: COOK_THIS_PROMPT },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
            { type: "text", text: JSON.stringify({ person: input.context, catalog: input.catalog }) },
          ],
        },
      ],
      response_format: zodResponseFormat(DishRecipeSchema, "dish_recipe"),
    });
    const choice = completion.choices[0];
    // Cost and latency only: never log the photo or output text (ARCHITECTURE §7).
    logLlmCall({
      model: this.model,
      ms: Date.now() - started,
      inputTokens: completion.usage?.prompt_tokens,
      outputTokens: completion.usage?.completion_tokens,
      finishReason: choice?.finish_reason,
    });
    if (!choice || choice.finish_reason !== "stop" || choice.message.refusal) {
      throw new Error(`Dish recipe did not complete: ${choice?.finish_reason ?? "no choice"}`);
    }
    // Validate again in our own schema even though the SDK parsed it (CLAUDE.md: LLM safety).
    const { problem, ...recipe } = DishRecipeSchema.parse(choice.message.parsed);
    if (problem) return { problem };
    return { ...recipe, dish: recipe.dish || recipe.title, title: recipe.title || recipe.dish };
  }
}
