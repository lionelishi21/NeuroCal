import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import type { FoundDevice, IDeviceExtractor, WebResult } from "../../application/interfaces/IDevices";
import type { ParseMessage } from "./ClaudeReasoningProvider";
import { DEVICE_EXTRACTION_PROMPT } from "./prompts";

export const DEVICE_MODEL = "claude-haiku-4-5";

export const DevicesSchema = z.object({
  devices: z
    .array(
      z.object({
        name: z.string().min(2).max(120),
        maker: z.string().min(1).max(80),
        url: z.string().min(8).max(500),
        description: z.string().min(20).max(600),
      }),
    )
    .max(5),
});

/** Search results → specific devices, via Claude with schema-constrained output, checked again on the way out. */
export class ClaudeDeviceExtractor implements IDeviceExtractor {
  private readonly messages: ParseMessage;

  constructor(options: { apiKey: string } | { messages: ParseMessage }) {
    this.messages = "messages" in options ? options.messages : new Anthropic({ apiKey: options.apiKey, maxRetries: 1, timeout: 25_000 }).messages;
  }

  async extract(input: { category: string; results: WebResult[] }): Promise<FoundDevice[]> {
    const started = Date.now();
    const response = await this.messages.parse({
      model: DEVICE_MODEL,
      max_tokens: 2000,
      system: DEVICE_EXTRACTION_PROMPT,
      messages: [{ role: "user", content: JSON.stringify(input) }],
      output_config: { format: zodOutputFormat(DevicesSchema) },
    });
    // Cost and latency only: never log prompts or output text (ARCHITECTURE §7).
    console.info(
      JSON.stringify({
        event: "llm_call",
        model: DEVICE_MODEL,
        ms: Date.now() - started,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        stopReason: response.stop_reason,
      }),
    );
    if (response.stop_reason !== "end_turn") throw new Error(`Device extraction stopped early: ${response.stop_reason}`);
    // Validate again in our own schema even though the SDK parsed it (CLAUDE.md: LLM safety).
    return DevicesSchema.parse(response.parsed_output).devices;
  }
}
