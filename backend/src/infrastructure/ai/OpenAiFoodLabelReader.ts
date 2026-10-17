import { zodResponseFormat } from "openai/helpers/zod";
import OpenAI from "openai";
import { z } from "zod";
import type { MealPhoto } from "../../application/interfaces/IAiVisionProvider";
import type { IFoodLabelReader } from "../../application/interfaces/IFoodLabels";
import type { FoodLabelReading } from "../../domain/foodLabel";
import type { ParseCompletion } from "./OpenAiVisionProvider";
import { FOOD_LABEL_PROMPT } from "./prompts";

export const FOOD_LABEL_MODEL = "gpt-4o";

export const FoodLabelSchema = z.object({
  problem: z.enum(["not_a_label", "blurry", "too_dark", "cut_off"]).nullable(),
  brand: z.string().nullable(),
  productName: z.string().nullable(),
  barcode: z.string().regex(/^\d{8,14}$/).nullable(),
  servingSize: z.string().nullable(),
  servingsPerContainer: z.number().positive().nullable(),
  nutrition: z
    .object({
      calories: z.number().nonnegative(),
      proteinG: z.number().nonnegative(),
      carbsG: z.number().nonnegative(),
      fatG: z.number().nonnegative(),
      fiberG: z.number().nonnegative().nullable(),
      sugarsG: z.number().nonnegative().nullable(),
      addedSugarsG: z.number().nonnegative().nullable(),
      sodiumMg: z.number().nonnegative().nullable(),
    })
    .nullable(),
  ingredients: z.array(z.string().min(1)),
  manufacturer: z.string().min(1).nullable(),
  producedOn: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/).nullable(),
  bestBefore: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/).nullable(),
  lotNumber: z.string().nullable(),
});

/** Photos of a food package → what is printed on it, via gpt-4o with a strict JSON schema. */
export class OpenAiFoodLabelReader implements IFoodLabelReader {
  private readonly completions: ParseCompletion;

  constructor(options: { apiKey: string } | { completions: ParseCompletion }) {
    this.completions =
      "completions" in options ? options.completions : new OpenAI({ apiKey: options.apiKey, maxRetries: 1, timeout: 25_000 }).chat.completions;
  }

  async readLabel(photos: MealPhoto[]): Promise<FoodLabelReading> {
    const started = Date.now();
    const completion = await this.completions.parse({
      model: FOOD_LABEL_MODEL,
      messages: [
        { role: "system", content: FOOD_LABEL_PROMPT },
        {
          role: "user",
          content: [
            ...photos.map((p) => ({
              type: "image_url" as const,
              image_url: { url: `data:${p.mediaType};base64,${Buffer.from(p.bytes).toString("base64")}`, detail: "high" as const },
            })),
            { type: "text", text: photos.length === 1 ? "Read this food label." : `These ${photos.length} photos show the same package. Read them as one label.` },
          ],
        },
      ],
      response_format: zodResponseFormat(FoodLabelSchema, "food_label"),
    });
    const choice = completion.choices[0];
    // Cost and latency only: never log the photo or output text (ARCHITECTURE §7).
    console.info(
      JSON.stringify({
        event: "llm_call",
        model: FOOD_LABEL_MODEL,
        ms: Date.now() - started,
        inputTokens: completion.usage?.prompt_tokens,
        outputTokens: completion.usage?.completion_tokens,
        finishReason: choice?.finish_reason,
      }),
    );
    if (!choice || choice.finish_reason !== "stop" || choice.message.refusal) {
      throw new Error(`Food label reading did not complete: ${choice?.finish_reason ?? "no choice"}`);
    }
    const r = FoodLabelSchema.parse(choice.message.parsed);
    if (r.problem) return { problem: r.problem, ingredients: [], source: "label" };
    const n = r.nutrition;
    return {
      ...(r.brand ? { brand: r.brand } : {}),
      ...(r.productName ? { productName: r.productName } : {}),
      ...(r.barcode ? { barcode: r.barcode } : {}),
      ...(r.servingSize ? { servingSize: r.servingSize } : {}),
      ...(r.servingsPerContainer ? { servingsPerContainer: r.servingsPerContainer } : {}),
      ...(n
        ? {
            nutrition: {
              calories: n.calories,
              proteinG: n.proteinG,
              carbsG: n.carbsG,
              fatG: n.fatG,
              ...(n.fiberG !== null ? { fiberG: n.fiberG } : {}),
              ...(n.sugarsG !== null ? { sugarsG: n.sugarsG } : {}),
              ...(n.addedSugarsG !== null ? { addedSugarsG: n.addedSugarsG } : {}),
              ...(n.sodiumMg !== null ? { sodiumMg: n.sodiumMg } : {}),
            },
          }
        : {}),
      ingredients: r.ingredients,
      ...(r.manufacturer ? { manufacturer: r.manufacturer } : {}),
      ...(r.producedOn ? { producedOn: r.producedOn } : {}),
      ...(r.bestBefore ? { bestBefore: r.bestBefore } : {}),
      ...(r.lotNumber ? { lotNumber: r.lotNumber } : {}),
      source: "label",
    };
  }
}
