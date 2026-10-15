import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { IShoppingListReviewer, ShoppingReviewContext } from "../../application/interfaces/IShoppingListReviewer";
import type { ReviewedItem } from "../../domain/shopping";
import type { ParseMessage } from "./ClaudeReasoningProvider";
import { SHOPPING_REVIEW_PROMPT } from "./prompts";

export const SHOPPING_REVIEW_MODEL = "claude-haiku-4-5";

export const ShoppingReviewSchema = z.object({
  problem: z.enum(["not_a_list", "unreadable"]).nullable(),
  items: z
    .array(
      z.object({
        name: z.string().min(1).max(80),
        processing: z.enum(["whole", "processed", "ultra_processed"]),
        verdict: z.enum(["keep", "swap", "limit"]),
        reason: z.string().min(1).max(240),
        swapFor: z.string().min(1).max(120).nullable(),
      }),
    )
    .max(80),
});

const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

/** Shopping list → each item graded, via Claude (a photo goes in as an image), checked again on the way out. */
export class ClaudeShoppingListReviewer implements IShoppingListReviewer {
  private readonly messages: ParseMessage;

  constructor(options: { apiKey: string } | { messages: ParseMessage }) {
    this.messages =
      "messages" in options ? options.messages : new Anthropic({ apiKey: options.apiKey, maxRetries: 1, timeout: 25_000 }).messages;
  }

  async review(context: ShoppingReviewContext): Promise<{ problem?: "not_a_list" | "unreadable"; items: ReviewedItem[] }> {
    const { photo, ...rest } = context;
    const mediaType = IMAGE_TYPES.find((t) => t === photo?.mediaType);
    if (photo && !mediaType) return { problem: "unreadable", items: [] };
    const started = Date.now();
    const response = await this.messages.parse({
      model: SHOPPING_REVIEW_MODEL,
      max_tokens: 4096,
      system: SHOPPING_REVIEW_PROMPT,
      messages: [
        {
          role: "user",
          content: [
            ...(photo && mediaType
              ? [{ type: "image" as const, source: { type: "base64" as const, media_type: mediaType, data: Buffer.from(photo.bytes).toString("base64") } }]
              : []),
            { type: "text" as const, text: JSON.stringify(rest) },
          ],
        },
      ],
      output_config: { format: zodOutputFormat(ShoppingReviewSchema) },
    });
    // Cost and latency only: never log prompts or output text (ARCHITECTURE §7).
    console.info(
      JSON.stringify({
        event: "llm_call",
        model: SHOPPING_REVIEW_MODEL,
        ms: Date.now() - started,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        stopReason: response.stop_reason,
      }),
    );
    if (response.stop_reason !== "end_turn") throw new Error(`Shopping review stopped early: ${response.stop_reason}`);
    // Validate again in our own schema even though the SDK parsed it (CLAUDE.md: LLM safety).
    const out = ShoppingReviewSchema.parse(response.parsed_output);
    return {
      ...(out.problem ? { problem: out.problem } : {}),
      items: out.items.map(({ swapFor, ...i }) => ({ ...i, ...(swapFor && i.verdict === "swap" ? { swapFor } : {}) })),
    };
  }
}
