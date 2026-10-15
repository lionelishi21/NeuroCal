import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { ITechniqueExtractor, NewTechnique } from "../../application/interfaces/IKnowledge";
import { PILLARS } from "../../domain/knowledge";
import type { ParseMessage } from "./ClaudeReasoningProvider";
import { TECHNIQUE_EXTRACTION_PROMPT } from "./prompts";

export const TECHNIQUE_MODEL = "claude-haiku-4-5";

export const TechniquesSchema = z.object({
  techniques: z
    .array(
      z.object({
        title: z.string().min(3).max(120),
        pillar: z.enum(PILLARS),
        summary: z.string().min(1).max(500),
        steps: z.array(z.string().min(1).max(300)).min(1).max(6),
        evidence: z.string().min(1).max(400),
        cautions: z.string().max(400),
        quote: z.string().min(1).max(300),
        timestampSeconds: z.number().int().min(0).max(36_000).nullable(),
      }),
    )
    .max(12),
});

/** Transcript → techniques for review, via Claude with schema-constrained output, checked again on the way out. */
export class ClaudeTechniqueExtractor implements ITechniqueExtractor {
  private readonly messages: ParseMessage;

  constructor(options: { apiKey: string } | { messages: ParseMessage }) {
    this.messages =
      // Long transcripts take a while; this runs from the admin screen, inside the API's 29 s.
      "messages" in options ? options.messages : new Anthropic({ apiKey: options.apiKey, maxRetries: 0, timeout: 27_000 }).messages;
  }

  async extract(input: { title: string; transcript: string }): Promise<NewTechnique[]> {
    const started = Date.now();
    const response = await this.messages.parse({
      model: TECHNIQUE_MODEL,
      max_tokens: 6000,
      system: TECHNIQUE_EXTRACTION_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(input) }],
      output_config: { format: zodOutputFormat(TechniquesSchema) },
    });
    // Cost and latency only: never log prompts or output text (ARCHITECTURE §7).
    console.info(
      JSON.stringify({
        event: "llm_call",
        model: TECHNIQUE_MODEL,
        ms: Date.now() - started,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        stopReason: response.stop_reason,
      }),
    );
    if (response.stop_reason !== "end_turn") throw new Error(`Technique extraction stopped early: ${response.stop_reason}`);
    // Validate again in our own schema even though the SDK parsed it (CLAUDE.md: LLM safety).
    return TechniquesSchema.parse(response.parsed_output).techniques.map(({ timestampSeconds, ...t }) => ({
      ...t,
      ...(timestampSeconds === null ? {} : { timestampSeconds }),
    }));
  }
}
