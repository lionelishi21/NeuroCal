import { zodResponseFormat } from "openai/helpers/zod";
import OpenAI from "openai";
import { z } from "zod";
import type { MealPhoto } from "../../application/interfaces/IAiVisionProvider";
import type { ISupplementLabelReader } from "../../application/interfaces/ISupplementLabelReader";
import type { SupplementLabelReading } from "../../domain/supplement";
import type { ParseCompletion } from "./OpenAiVisionProvider";
import { SUPPLEMENT_LABEL_PROMPT } from "./prompts";
import { logLlmCall } from "./logLlmCall";

export const SUPPLEMENT_LABEL_MODEL = "gpt-4o";

export const SupplementLabelSchema = z.object({
  problem: z.enum(["not_a_label", "blurry", "too_dark", "cut_off"]).nullable(),
  brand: z.string().nullable(),
  productName: z.string().nullable(),
  servingSize: z.string().nullable(),
  servingsPerContainer: z.number().int().positive().nullable(),
  ingredients: z.array(
    z.object({
      name: z.string().min(1),
      amount: z.number().nonnegative().nullable(),
      unit: z.string().nullable(),
      inBlend: z.boolean(),
    }),
  ),
  proprietaryBlend: z.boolean(),
  testing: z.array(z.enum(["nsf_certified", "nsf_sport", "usp_verified", "informed_sport", "informed_choice", "bscg", "clean_label_project", "other"])),
  lotNumber: z.string().nullable(),
  expiresOn: z.string().regex(/^\d{4}-\d{2}(-\d{2})?$/).nullable(),
});

const present = <K extends string, V>(key: K, value: V | null): { [P in K]?: V } => (value === null || value === "" ? {} : ({ [key]: value } as { [P in K]?: V }));

/** Photos of a supplement label → what is printed on it, via gpt-4o with a strict JSON schema. */
export class OpenAiSupplementLabelReader implements ISupplementLabelReader {
  private readonly completions: ParseCompletion;

  constructor(options: { apiKey: string } | { completions: ParseCompletion }) {
    this.completions =
      "completions" in options ? options.completions : new OpenAI({ apiKey: options.apiKey, maxRetries: 1, timeout: 25_000 }).chat.completions;
  }

  async readLabel(photos: MealPhoto[]): Promise<SupplementLabelReading> {
    const started = Date.now();
    const images = photos.map((photo) => ({
      type: "image_url" as const,
      image_url: { url: `data:${photo.mediaType};base64,${Buffer.from(photo.bytes).toString("base64")}`, detail: "high" as const },
    }));
    const completion = await this.completions.parse({
      model: SUPPLEMENT_LABEL_MODEL,
      messages: [
        { role: "system", content: SUPPLEMENT_LABEL_PROMPT },
        {
          role: "user",
          content: [
            ...images,
            {
              type: "text",
              text: photos.length === 1 ? "Read this supplement label." : `These ${photos.length} photos show the same bottle from different sides. Read them as one label.`,
            },
          ],
        },
      ],
      response_format: zodResponseFormat(SupplementLabelSchema, "supplement_label"),
    });

    const choice = completion.choices[0];
    // Cost and latency only: never log the photo or output text (ARCHITECTURE §7).
    logLlmCall({
      model: SUPPLEMENT_LABEL_MODEL,
      ms: Date.now() - started,
      inputTokens: completion.usage?.prompt_tokens,
      outputTokens: completion.usage?.completion_tokens,
      finishReason: choice?.finish_reason,
    });

    if (!choice || choice.finish_reason !== "stop" || choice.message.refusal) {
      throw new Error(`Supplement label reading did not complete: ${choice?.finish_reason ?? "no choice"}`);
    }
    const r = SupplementLabelSchema.parse(choice.message.parsed);
    if (r.problem) return { problem: r.problem, ingredients: [], proprietaryBlend: false, testing: [] };
    return {
      ...present("brand", r.brand),
      ...present("productName", r.productName),
      ...present("servingSize", r.servingSize),
      ...present("servingsPerContainer", r.servingsPerContainer),
      ingredients: r.ingredients.map((i) => ({ name: i.name, ...present("amount", i.amount), ...present("unit", i.unit), inBlend: i.inBlend })),
      proprietaryBlend: r.proprietaryBlend,
      testing: [...new Set(r.testing)],
      ...present("lotNumber", r.lotNumber),
      ...present("expiresOn", r.expiresOn),
    };
  }
}
