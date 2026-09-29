import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ClaudeReasoningProvider, RECIPE_QUERY_MODEL, type ParseMessage } from "./ClaudeReasoningProvider";
import { MEAL_VISION_MODEL, OpenAiVisionProvider, type ParseCompletion } from "./OpenAiVisionProvider";
import { MEAL_VISION_PROMPT, RECIPE_QUERY_PROMPT } from "./prompts";

beforeEach(() => {
  jest.spyOn(console, "info").mockImplementation(() => {});
});

const context = { caloriesRemaining: 1150, macroFocus: "protein", cognitiveFlags: ["low_focus"], dietaryPreference: "pescatarian" };

function claudeWith(response: object) {
  const parse = jest.fn(async (_params: unknown) => ({ usage: { input_tokens: 120, output_tokens: 60 }, ...response }));
  return { parse, provider: new ClaudeReasoningProvider({ messages: { parse } as unknown as ParseMessage }) };
}

describe("ClaudeReasoningProvider", () => {
  it("sends the bio-state to claude-haiku-4-5 with a JSON schema and returns the parsed query", async () => {
    const output = { searchQuery: "pescatarian high protein omega-3 dinner", contextualReasoning: "Fish keeps you steady." };
    const { parse, provider } = claudeWith({ stop_reason: "end_turn", parsed_output: output });

    await expect(provider.generateRecipeSearchQuery(context)).resolves.toEqual(output);

    const params = parse.mock.calls[0]![0] as Record<string, any>;
    expect(params.model).toBe(RECIPE_QUERY_MODEL);
    expect(params.system).toBe(RECIPE_QUERY_PROMPT);
    expect(JSON.parse(params.messages[0].content)).toEqual(context);
    expect(params.output_config.format.type).toBe("json_schema");
    expect(params.output_config.format.schema.required).toEqual(["searchQuery", "contextualReasoning"]);
  });

  it.each([
    ["a refusal", { stop_reason: "refusal", parsed_output: null }],
    ["a truncated answer", { stop_reason: "max_tokens", parsed_output: null }],
    ["output outside the schema", { stop_reason: "end_turn", parsed_output: { searchQuery: "", contextualReasoning: "x" } }],
  ])("rejects %s", async (_, response) => {
    await expect(claudeWith(response).provider.generateRecipeSearchQuery(context)).rejects.toThrow();
  });
});

function openAiWith(choice: object) {
  const parse = jest.fn(async (_params: unknown) => ({ choices: [choice], usage: { prompt_tokens: 900, completion_tokens: 120 } }));
  return { parse, provider: new OpenAiVisionProvider({ completions: { parse } as unknown as ParseCompletion }) };
}

const photo = { bytes: new Uint8Array([0xff, 0xd8, 0xff]), mediaType: "image/jpeg" };

describe("OpenAiVisionProvider", () => {
  it("sends the photo to gpt-4o and maps items to the domain shape", async () => {
    const parsed = {
      items: [{ name: "Quinoa", portion: "¾ cup", calories: 166, proteinG: 6, carbsG: 29, fatG: 2.7, confidence: 0.8, glycemicLoad: "medium" }],
      problem: null,
    };
    const { parse, provider } = openAiWith({ finish_reason: "stop", message: { parsed, refusal: null } });

    const result = await provider.analyzeMealPhoto(photo);

    expect(result).toEqual({
      items: [{ name: "Quinoa", portion: "¾ cup", calories: 166, macros: { proteinG: 6, carbsG: 29, fatG: 2.7 }, confidence: 0.8, glycemicLoad: "medium" }],
    });
    const params = parse.mock.calls[0]![0] as Record<string, any>;
    expect(params.model).toBe(MEAL_VISION_MODEL);
    expect(params.messages[0]).toEqual({ role: "system", content: MEAL_VISION_PROMPT });
    expect(params.messages[1].content[0].image_url.url).toBe("data:image/jpeg;base64,/9j/");
    expect(params.response_format.type).toBe("json_schema");
    expect(params.response_format.json_schema.strict).toBe(true);
  });

  it("passes an unreadable photo through", async () => {
    const { provider } = openAiWith({ finish_reason: "stop", message: { parsed: { items: [], problem: "too_dark" }, refusal: null } });
    await expect(provider.analyzeMealPhoto(photo)).resolves.toEqual({ items: [], problem: "too_dark" });
  });

  it.each([
    ["a refusal", { finish_reason: "stop", message: { parsed: null, refusal: "I can't help with that." } }],
    ["a truncated answer", { finish_reason: "length", message: { parsed: null, refusal: null } }],
    ["negative calories", { finish_reason: "stop", message: { parsed: { items: [{ name: "x", portion: "1", calories: -5, proteinG: 0, carbsG: 0, fatG: 0, confidence: 1, glycemicLoad: "low" }], problem: null }, refusal: null } }],
  ])("rejects %s", async (_, choice) => {
    await expect(openAiWith(choice).provider.analyzeMealPhoto(photo)).rejects.toThrow();
  });
});
