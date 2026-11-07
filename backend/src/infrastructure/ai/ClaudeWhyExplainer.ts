import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { IWhyExplainer } from "../../application/interfaces/IWhy";
import type { WhyReasons, WhyTopic } from "../../domain/why";
import type { ParseMessage } from "./ClaudeReasoningProvider";
import { WHY_PROMPT } from "./prompts";
import { logLlmCall } from "./logLlmCall";

export const WHY_MODEL = "claude-haiku-5-5";

export const WhySchema = z.object({ explanation: z.string().min(1).max(900) });

const QUESTION: Record<WhyTopic, string> = {
  weight: "Why did my weight change at my latest weigh-in?",
  calories: "Why are my calories where they are today, and what would help for the rest of the day?",
  focus: "Why is my Focus Score what it is today, and what would move it most?",
};

/** A tapped "Why?": three or four sentences from the data summary, on a small, fast model. */
export class ClaudeWhyExplainer implements IWhyExplainer {
  private readonly messages: ParseMessage;

  constructor(options: { apiKey: string } | { messages: ParseMessage }) {
    this.messages =
      "messages" in options ? options.messages : new Anthropic({ apiKey: options.apiKey, maxRetries: 1, timeout: 20_000 }).messages;
  }

  async explain(input: { topic: WhyTopic; context: string; reasons: WhyReasons | null }): Promise<string> {
    const started = Date.now();
    const rules = input.reasons ? `\n\nWhat the app already shows them:\n${input.reasons.headline}\n- ${input.reasons.reasons.join("\n- ")}` : "";
    const response = await this.messages.parse({
      model: WHY_MODEL,
      max_tokens: 2000,
      system: WHY_PROMPT,
      messages: [{ role: "user", content: `My data:\n\n${input.context}${rules}\n\n${QUESTION[input.topic]}` }],
      output_config: { effort: "low", format: zodOutputFormat(WhySchema) },
    });
    logLlmCall({
      model: WHY_MODEL,
      feature: `why_${input.topic}`,
      ms: Date.now() - started,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      stopReason: response.stop_reason,
    });
    if (response.stop_reason === "refusal") return "NeuroCal can't explain this one. If something about your health worries you, talk to your doctor.";
    if (response.stop_reason !== "end_turn") throw new Error(`Why explanation stopped early: ${response.stop_reason}`);
    return WhySchema.parse(response.parsed_output).explanation;
  }
}
