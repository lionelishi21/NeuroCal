import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { ClaudeFocusExplainer } from "./ClaudeFocusExplainer";
import { OpenAiEmbeddingProvider, type CreateEmbeddings } from "./OpenAiEmbeddingProvider";
import { ClaudeReasoningProvider, RECIPE_QUERY_MODEL, type ParseMessage } from "./ClaudeReasoningProvider";
import { ClaudePantryRecipeAssistant, PANTRY_RECIPES_MODEL } from "./ClaudePantryRecipeAssistant";
import { MEAL_VISION_MODEL, OpenAiVisionProvider, type ParseCompletion } from "./OpenAiVisionProvider";
import { FOOD_LABEL_MODEL, OpenAiFoodLabelReader } from "./OpenAiFoodLabelReader";
import { OpenAiSupplementLabelReader, SUPPLEMENT_LABEL_MODEL } from "./OpenAiSupplementLabelReader";
import { FOOD_LABEL_PROMPT, MEAL_VISION_PROMPT, PANTRY_RECIPES_PROMPT, RECIPE_QUERY_PROMPT, SUPPLEMENT_LABEL_PROMPT } from "./prompts";

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
      items: [{ name: "Quinoa", portion: "¾ cup", calories: 166, proteinG: 6, carbsG: 29, fatG: 2.7, confidence: 0.8, glycemicLoad: "medium", processing: "whole" }],
      problem: null,
    };
    const { parse, provider } = openAiWith({ finish_reason: "stop", message: { parsed, refusal: null } });

    const result = await provider.analyzeMealPhoto(photo);

    expect(result).toEqual({
      items: [{ name: "Quinoa", portion: "¾ cup", calories: 166, macros: { proteinG: 6, carbsG: 29, fatG: 2.7 }, confidence: 0.8, glycemicLoad: "medium", processing: "whole" }],
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

describe("ClaudeFocusExplainer", () => {
  const input = { score: 65, components: { sleep: 0.75, timing: 1, glycemic: 0, stress: null , movement: null} };

  it("sends only the score and components and returns the explanation", async () => {
    const parse = jest.fn(async (_params: unknown) => ({
      usage: { input_tokens: 90, output_tokens: 40 },
      stop_reason: "end_turn",
      parsed_output: { explanation: "Good sleep helps; yesterday's sugary food holds you back." },
    }));
    const explainer = new ClaudeFocusExplainer({ messages: { parse } as unknown as ParseMessage });
    await expect(explainer.explain(input)).resolves.toBe("Good sleep helps; yesterday's sugary food holds you back.");
    const params = parse.mock.calls[0]![0] as Record<string, any>;
    expect(params.model).toBe("claude-haiku-4-5");
    expect(JSON.parse(params.messages[0].content)).toEqual(input);
  });

  it("rejects an explanation over 300 characters", async () => {
    const parse = jest.fn(async () => ({ usage: { input_tokens: 1, output_tokens: 1 }, stop_reason: "end_turn", parsed_output: { explanation: "x".repeat(301) } }));
    await expect(new ClaudeFocusExplainer({ messages: { parse } as unknown as ParseMessage }).explain(input)).rejects.toThrow();
  });
});

describe("OpenAiEmbeddingProvider", () => {
  it("embeds in order and length-checks every vector", async () => {
    const create = jest.fn(async (params: { input: string[]; model?: string }) => ({
      data: params.input.map((_, index) => ({ index, embedding: new Array(1536).fill(index) })).reverse(),
      usage: { total_tokens: 12 },
    }));
    const provider = new OpenAiEmbeddingProvider({ embeddings: { create } as unknown as CreateEmbeddings });
    const vectors = await provider.embed(["a", "b"]);
    expect(vectors.map((v) => v[0])).toEqual([0, 1]);
    expect(create.mock.calls[0]![0].model).toBe("text-embedding-3-small");
  });

  it("rejects vectors of the wrong size", async () => {
    const create = jest.fn(async () => ({ data: [{ index: 0, embedding: [1, 2, 3] }] }));
    await expect(new OpenAiEmbeddingProvider({ embeddings: { create } as unknown as CreateEmbeddings }).embed(["a"])).rejects.toThrow();
  });
});

describe("OpenAiSupplementLabelReader", () => {
  const readerWith = (choice: object) => {
    const parse = jest.fn(async (_params: unknown) => ({ choices: [choice], usage: { prompt_tokens: 900, completion_tokens: 200 } }));
    return { parse, reader: new OpenAiSupplementLabelReader({ completions: { parse } as unknown as ParseCompletion }) };
  };
  const parsed = {
    problem: null,
    brand: "Calm Labs",
    productName: "Magnesium Glycinate",
    servingSize: "2 capsules",
    servingsPerContainer: 60,
    ingredients: [
      { name: "Magnesium", amount: 200, unit: "mg", inBlend: false },
      { name: "Chamomile", amount: null, unit: null, inBlend: true },
    ],
    proprietaryBlend: true,
    testing: ["nsf_certified", "nsf_certified"],
    lotNumber: null,
    expiresOn: "2027-03",
  };

  it("sends the photo to gpt-4o with the label schema and drops empty fields", async () => {
    const { parse, reader } = readerWith({ finish_reason: "stop", message: { parsed, refusal: null } });
    await expect(reader.readLabel([photo])).resolves.toEqual({
      brand: "Calm Labs",
      productName: "Magnesium Glycinate",
      servingSize: "2 capsules",
      servingsPerContainer: 60,
      ingredients: [
        { name: "Magnesium", amount: 200, unit: "mg", inBlend: false },
        { name: "Chamomile", inBlend: true },
      ],
      proprietaryBlend: true,
      testing: ["nsf_certified"],
      expiresOn: "2027-03",
    });
    const params = parse.mock.calls[0]![0] as Record<string, any>;
    expect(params.model).toBe(SUPPLEMENT_LABEL_MODEL);
    expect(params.messages[0].content).toBe(SUPPLEMENT_LABEL_PROMPT);
    expect(params.response_format.type).toBe("json_schema");
  });

  it("sends every side of the bottle in one message and says they are one label", async () => {
    const { parse, reader } = readerWith({ finish_reason: "stop", message: { parsed, refusal: null } });
    await reader.readLabel([photo, photo, photo]);
    const content = (parse.mock.calls[0]![0] as Record<string, any>).messages[1].content;
    expect(content.filter((part: { type: string }) => part.type === "image_url")).toHaveLength(3);
    expect(content.at(-1).text).toBe("These 3 photos show the same bottle from different sides. Read them as one label.");
  });

  it("returns only the problem for an unreadable photo, and throws on a refusal or bad output", async () => {
    const blurry = { ...parsed, problem: "blurry" };
    await expect(readerWith({ finish_reason: "stop", message: { parsed: blurry, refusal: null } }).reader.readLabel([photo])).resolves.toEqual({
      problem: "blurry",
      ingredients: [],
      proprietaryBlend: false,
      testing: [],
    });
    await expect(readerWith({ finish_reason: "stop", message: { parsed: null, refusal: "no" } }).reader.readLabel([photo])).rejects.toThrow();
    await expect(readerWith({ finish_reason: "stop", message: { parsed: { ...parsed, expiresOn: "soon" }, refusal: null } }).reader.readLabel([photo])).rejects.toThrow();
  });
});

describe("OpenAiFoodLabelReader", () => {
  const readerWith = (choice: object) => {
    const parse = jest.fn(async (_params: unknown) => ({ choices: [choice], usage: { prompt_tokens: 900, completion_tokens: 200 } }));
    return { parse, reader: new OpenAiFoodLabelReader({ completions: { parse } as unknown as ParseCompletion }) };
  };
  const parsed = {
    problem: null,
    brand: "Crunchy Co",
    productName: "Granola",
    barcode: null,
    servingSize: "55 g",
    servingsPerContainer: 8,
    nutrition: { calories: 260, proteinG: 5, carbsG: 38, fatG: 10, fiberG: 3, sugarsG: null, addedSugarsG: 12, sodiumMg: null },
    ingredients: ["Oats", "sugar"],
    bestBefore: "2027-02",
    lotNumber: null,
  };

  it("sends every photo with the food label prompt and drops empty fields", async () => {
    const { parse, reader } = readerWith({ finish_reason: "stop", message: { parsed, refusal: null } });
    await expect(reader.readLabel([photo, photo])).resolves.toEqual({
      brand: "Crunchy Co",
      productName: "Granola",
      servingSize: "55 g",
      servingsPerContainer: 8,
      nutrition: { calories: 260, proteinG: 5, carbsG: 38, fatG: 10, fiberG: 3, addedSugarsG: 12 },
      ingredients: ["Oats", "sugar"],
      bestBefore: "2027-02",
      source: "label",
    });
    const params = parse.mock.calls[0]![0] as Record<string, any>;
    expect(params.model).toBe(FOOD_LABEL_MODEL);
    expect(params.messages[0].content).toBe(FOOD_LABEL_PROMPT);
    expect(params.messages[1].content.filter((p: { type: string }) => p.type === "image_url")).toHaveLength(2);
  });

  it("returns only the problem for an unreadable photo, and throws on a refusal", async () => {
    await expect(readerWith({ finish_reason: "stop", message: { parsed: { ...parsed, problem: "blurry" }, refusal: null } }).reader.readLabel([photo])).resolves.toEqual({
      problem: "blurry",
      ingredients: [],
      source: "label",
    });
    await expect(readerWith({ finish_reason: "stop", message: { parsed: null, refusal: "no" } }).reader.readLabel([photo])).rejects.toThrow();
  });
});

describe("ClaudePantryRecipeAssistant", () => {
  const pantryContext = {
    pantry: ["eggs", "spinach", "oats"],
    caloriesLeft: 700,
    macrosLeft: { proteinG: 60, carbsG: 80, fatG: 25 },
    dietaryPreference: "vegetarian" as const,
    cognitiveGoals: ["focus"],
  };
  const recipe = {
    title: "Spinach omelette",
    minutes: 10,
    servings: 1,
    calories: 320,
    macros: { proteinG: 21.4, carbsG: 4, fatG: 22 },
    ingredients: [{ name: "eggs", quantity: "3" }],
    steps: ["Whisk the eggs.", "Cook with the spinach."],
    whyItFits: "Protein for the afternoon.",
  };
  const assistantWith = (response: object) => {
    const parse = jest.fn(async (_params: unknown) => ({ usage: { input_tokens: 200, output_tokens: 400 }, ...response }));
    return { parse, assistant: new ClaudePantryRecipeAssistant({ messages: { parse } as unknown as ParseMessage }) };
  };

  it("sends the pantry and what's left today with a JSON schema, and rounds the macros", async () => {
    const { parse, assistant } = assistantWith({ stop_reason: "end_turn", parsed_output: { recipes: [recipe] } });
    const [out] = await assistant.suggest(pantryContext);
    expect(out!.macros.proteinG).toBe(21);
    const params = parse.mock.calls[0]![0] as Record<string, any>;
    expect(params.model).toBe(PANTRY_RECIPES_MODEL);
    expect(params.system).toBe(PANTRY_RECIPES_PROMPT);
    expect(JSON.parse(params.messages[0].content)).toEqual(pantryContext);
    expect(params.output_config.format.type).toBe("json_schema");
  });

  it.each([
    ["a refusal", { stop_reason: "refusal", parsed_output: null }],
    ["a truncated answer", { stop_reason: "max_tokens", parsed_output: null }],
    ["output outside the schema", { stop_reason: "end_turn", parsed_output: { recipes: [{ ...recipe, steps: [] }] } }],
  ])("rejects %s", async (_, response) => {
    await expect(assistantWith(response).assistant.suggest(pantryContext)).rejects.toThrow();
  });
});

