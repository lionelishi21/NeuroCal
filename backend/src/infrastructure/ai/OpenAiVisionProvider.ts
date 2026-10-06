import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from "zod";
import type {
  IAiVisionProvider,
  MealPhoto,
  MealPhotoAnalysis,
} from "../../application/interfaces/IAiVisionProvider";
import { MEAL_VISION_PROMPT } from "./prompts";

export const MEAL_VISION_MODEL = "gpt-4o";

export const MealVisionSchema = z.object({
  items: z.array(
    z.object({
      name: z.string().min(1),
      portion: z.string().min(1),
      calories: z.number().nonnegative(),
      proteinG: z.number().nonnegative(),
      carbsG: z.number().nonnegative(),
      fatG: z.number().nonnegative(),
      confidence: z.number().min(0).max(1),
      glycemicLoad: z.enum(["low", "medium", "high"]),
    }),
  ),
  problem: z.enum(["too_dark", "no_food_found", "blurry"]).nullable(),
});

/** The one SDK call this adapter makes; injectable for tests. */
export type ParseCompletion = Pick<OpenAI["chat"]["completions"], "parse">;

/** Meal photo → proposed items, via gpt-4o with a strict JSON schema (ARCHITECTURE §7.1). */
export class OpenAiVisionProvider implements IAiVisionProvider {
  private readonly completions: ParseCompletion;

  constructor(options: { apiKey: string } | { completions: ParseCompletion }) {
    this.completions =
      "completions" in options
        ? options.completions
        : new OpenAI({ apiKey: options.apiKey, maxRetries: 1, timeout: 20_000 }).chat.completions;
  }

  async analyzeMealPhoto(photo: MealPhoto): Promise<MealPhotoAnalysis> {
    const started = Date.now();
    const dataUrl = `data:${photo.mediaType};base64,${Buffer.from(photo.bytes).toString("base64")}`;
    const completion = await this.completions.parse({
      model: MEAL_VISION_MODEL,
      messages: [
        { role: "system", content: MEAL_VISION_PROMPT },
        {
          role: "user",
          content: [
            { type: "image_url", image_url: { url: dataUrl, detail: "high" } },
            { type: "text", text: "List what's on this plate." },
          ],
        },
      ],
      response_format: zodResponseFormat(MealVisionSchema, "meal_photo_analysis"),
    });

    const choice = completion.choices[0];
    // Cost and latency only: never log the photo or output text (ARCHITECTURE §7).
    console.info(
      JSON.stringify({
        event: "llm_call",
        model: MEAL_VISION_MODEL,
        ms: Date.now() - started,
        inputTokens: completion.usage?.prompt_tokens,
        outputTokens: completion.usage?.completion_tokens,
        finishReason: choice?.finish_reason,
      }),
    );

    if (!choice || choice.finish_reason !== "stop" || choice.message.refusal) {
      throw new Error(`Meal vision did not complete: ${choice?.finish_reason ?? "no choice"}`);
    }
    const result = MealVisionSchema.parse(choice.message.parsed);
    return {
      items: result.items.map((i) => ({
        name: i.name,
        portion: i.portion,
        calories: i.calories,
        macros: { proteinG: i.proteinG, carbsG: i.carbsG, fatG: i.fatG },
        confidence: i.confidence,
        glycemicLoad: i.glycemicLoad,
      })),
      ...(result.problem ? { problem: result.problem } : {}),
    };
  }
}
