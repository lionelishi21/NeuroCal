import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { ICoach } from "../../application/interfaces/ICoach";
import type { ChatTurn } from "../../domain/coach";
import { COACH_PROMPT } from "./prompts";
import { logLlmCall } from "./logLlmCall";

export const COACH_MODEL = "claude-opus-5-5";

export const CoachReplySchema = z.object({ reply: z.string().min(1).max(4000) });

export type BetaParseMessage = Pick<Anthropic["beta"]["messages"], "parse">;

/**
 * Ask NeuroCal on Claude. Reads the person's data summary as the start of the conversation, answers
 * with schema-checked JSON, and on a safety decline lets the API's default fallback model answer.
 */
export class ClaudeCoach implements ICoach {
  private readonly messages: BetaParseMessage;

  constructor(options: { apiKey: string } | { messages: BetaParseMessage }) {
    this.messages =
      "messages" in options ? options.messages : new Anthropic({ apiKey: options.apiKey, maxRetries: 1, timeout: 45_000 }).beta.messages;
  }

  async reply(input: { context: string; turns: ChatTurn[] }): Promise<string> {
    const started = Date.now();
    const [first, ...rest] = input.turns;
    const messages: Anthropic.Beta.BetaMessageParam[] = [
      { role: "user", content: `My data:\n\n${input.context}\n\n${first!.content}` },
      ...rest.map((t) => ({ role: t.role, content: t.content })),
    ];
    const response = await this.messages.parse({
      model: COACH_MODEL,
      max_tokens: 4000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: COACH_PROMPT,
      messages,
      output_config: { effort: "low", format: betaZodOutputFormat(CoachReplySchema) },
    });
    logLlmCall({
      model: response.model,
      feature: "coach",
      ms: Date.now() - started,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      stopReason: response.stop_reason,
    });
    if (response.stop_reason === "refusal") return "I can't help with that one. For anything about your health that worries you, talk to your doctor.";
    if (response.stop_reason !== "end_turn") throw new Error(`Coach reply stopped early: ${response.stop_reason}`);
    return CoachReplySchema.parse(response.parsed_output).reply;
  }
}
