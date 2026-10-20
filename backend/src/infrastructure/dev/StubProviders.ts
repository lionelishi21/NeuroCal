import type { IDeviceExtractor } from "../../application/interfaces/IDevices";
/**
 * Canned AI and search responses so the dev server runs without API keys.
 * Never used in the Lambda build.
 */
import type { IMealPlanner } from "../../application/interfaces/IMealPlans";
import type { IRecipeParser } from "../../application/interfaces/IRecipeParser";
import type { ITechniqueExtractor } from "../../application/interfaces/IKnowledge";
import type { IShoppingListReviewer } from "../../application/interfaces/IShoppingListReviewer";
import type { IPantryRecipeAssistant } from "../../application/interfaces/IPantry";
import type { IAiReasoningProvider } from "../../application/interfaces/IAiReasoningProvider";
import type { IAiVisionProvider } from "../../application/interfaces/IAiVisionProvider";
import type { ISearchEngineAdapter } from "../../application/interfaces/ISearchEngineAdapter";
import type { IFocusExplainer } from "../../application/interfaces/IFocusExplainer";
import type { ISupplementLabelReader } from "../../application/interfaces/ISupplementLabelReader";
import type { IBetterChoiceAdvisor, IFoodLabelReader } from "../../application/interfaces/IFoodLabels";

export const stubVision: IAiVisionProvider = {
  async analyzeMealPhoto() {
    return {
      items: [
        { name: "Grilled chicken breast", portion: "150 g", calories: 248, macros: { proteinG: 46, carbsG: 0, fatG: 5.4 }, confidence: 0.92, glycemicLoad: "low", processing: "whole" },
        { name: "Quinoa", portion: "¾ cup", calories: 166, macros: { proteinG: 6, carbsG: 29, fatG: 2.7 }, confidence: 0.81, glycemicLoad: "medium", processing: "whole" },
        { name: "Roasted broccoli", portion: "1 cup", calories: 55, macros: { proteinG: 3.7, carbsG: 11, fatG: 0.6 }, confidence: 0.88, glycemicLoad: "low", processing: "whole" },
      ],
    };
  },
};

/** A typical magnesium label, with one blend and no testing mark, so every flag path shows. */
export const stubLabels: ISupplementLabelReader = {
  async readLabel() {
    return {
      brand: "Calm Labs",
      productName: "Magnesium Glycinate",
      servingSize: "2 capsules",
      servingsPerContainer: 60,
      ingredients: [
        { name: "Magnesium (as magnesium glycinate)", amount: 200, unit: "mg", inBlend: false },
        { name: "Calm blend (L-theanine, chamomile)", amount: 150, unit: "mg", inBlend: true },
      ],
      proprietaryBlend: true,
      testing: [],
      lotNumber: "MG2405",
      expiresOn: "2027-03",
    };
  },
};

/** A typical supermarket granola: industrial ingredients and added sugar, so the flags show. */
export const stubFoodLabels: IFoodLabelReader = {
  async readLabel() {
    return {
      brand: "Crunchy Co",
      productName: "Honey Almond Granola",
      servingSize: "2/3 cup (55 g)",
      servingsPerContainer: 8,
      nutrition: { calories: 260, proteinG: 5, carbsG: 38, fatG: 10, fiberG: 3, sugarsG: 14, addedSugarsG: 12, sodiumMg: 140 },
      ingredients: ["Whole grain rolled oats", "sugar", "canola oil", "almonds", "honey", "soy lecithin", "natural flavor"],
      manufacturer: "Crunchy Foods Inc.",
      producedOn: "2026-08-14",
      bestBefore: "2027-02",
      source: "label",
    };
  },
};

export const stubReasoning: IAiReasoningProvider = {
  async generateRecipeSearchQuery(context) {
    const feeling = context.cognitiveFlags.length ? context.cognitiveFlags.join(" and ").replaceAll("_", " ") : "no check-in yet";
    return {
      searchQuery: `${context.dietaryPreference} ${context.macroFocus.replace("_", " ")} dinner under ${Math.max(0, Math.round(context.caloriesRemaining))} calories`,
      contextualReasoning: `You checked in with ${feeling}. A protein-forward plate with slow carbs keeps your energy steady through the evening.`,
    };
  },
};

export const stubSearch: ISearchEngineAdapter = {
  async searchRecipes() {
    return [
      {
        title: "Miso-glazed cod with edamame and brown rice",
        url: "https://www.seriouseats.com/miso-glazed-cod",
        sourceName: "Serious Eats",
        snippet: "",
        minutes: 30,
        calories: 640,
        macros: { proteinG: 46, carbsG: 62, fatG: 18 },
      },
      {
        title: "Lentil, spinach and feta skillet with a soft egg",
        url: "https://www.bbcgoodfood.com/recipes/lentil-spinach-feta",
        sourceName: "BBC Good Food",
        snippet: "",
        minutes: 25,
        calories: 520,
        macros: { proteinG: 32, carbsG: 48, fatG: 20 },
      },
    ];
  },
};

export const stubExplainer: IFocusExplainer = {
  async explain({ components }) {
    const weakest = (Object.entries(components) as [string, number | null][])
      .filter(([, v]) => v !== null)
      .sort((a, b) => a[1]! - b[1]!)[0]?.[0];
    return `Stub explanation: ${weakest ?? "nothing"} is the input holding your focus back most today.`;
  },
};

/** Recipes from the pantry without Claude: one dish from the first items. */
export const stubPantryRecipes: IPantryRecipeAssistant = {
  async suggest(context) {
    const [a = "eggs", b = "greens"] = context.pantry;
    return [
      {
        title: `Quick ${a} and ${b} skillet`,
        minutes: 15,
        servings: 1,
        calories: Math.min(520, context.caloriesLeft),
        macros: { proteinG: 32, carbsG: 30, fatG: 18 },
        ingredients: [
          { name: a, quantity: "1 cup" },
          { name: b, quantity: "1 cup" },
          { name: "lemon", quantity: "1/2" },
        ],
        steps: [`Warm a pan with a little oil.`, `Cook the ${a} for 5 minutes.`, `Add the ${b} and lemon, season and serve.`],
        whyItFits: "Stub recipe: set ANTHROPIC_API_KEY for real suggestions.",
      },
    ];
  },
};

/** A better choice without Claude: oven granola from the pantry, whatever was scanned. */
export const stubBetterChoice: IBetterChoiceAdvisor = {
  async suggest(context) {
    return {
      lookFor: "Stub advice: set ANTHROPIC_API_KEY for a real one. Look for a short list of foods you'd have in a kitchen.",
      homemade: {
        title: "Oven granola",
        minutes: 25,
        servings: 8,
        calories: 220,
        macros: { proteinG: 6, carbsG: 26, fatG: 10 },
        ingredients: [
          { name: context.pantry[0] ?? "rolled oats", quantity: "2 cups" },
          { name: "honey", quantity: "3 tbsp" },
          { name: "coconut oil", quantity: "2 tbsp" },
        ],
        steps: ["Heat the oven to 160°C.", "Toss everything together on a tray.", "Bake for 20 minutes, stirring halfway, and cool."],
        whyItFits: "Stub recipe: nothing industrial in it.",
      },
    };
  },
};

/** Shopping list review without Claude: everything kept, as whole food. */
export const stubShoppingReviewer: IShoppingListReviewer = {
  async review(context) {
    const items = context.items.length ? context.items : ["Eggs", "Frozen fries"];
    return { items: items.map((name) => ({ name, processing: "whole" as const, verdict: "keep" as const, reason: "Stub review: set ANTHROPIC_API_KEY for a real one." })) };
  },
};

/** Techniques without Claude: one sample, so the admin Knowledge screen can be tried locally. */
export const stubTechniqueExtractor: ITechniqueExtractor = {
  async extract() {
    return [
      {
        title: "Get morning light within an hour of waking",
        pillar: "rhythm" as const,
        summary: "Stub technique: set ANTHROPIC_API_KEY to read real transcripts.",
        steps: ["Go outside for 10 minutes after waking.", "Skip the sunglasses."],
        evidence: "None given",
        cautions: "",
        quote: "stub",
      },
    ];
  },
};

/** Recipe reading without Claude: every line is one 100 g ingredient at an estimated 100 kcal. */
export const stubRecipeParser: IRecipeParser = {
  async parse(input) {
    const lines = input.text.split("\n").map((l) => l.trim()).filter(Boolean);
    return {
      title: "Stub recipe (set ANTHROPIC_API_KEY to read it)",
      servings: null,
      ingredients: lines.map((name) => ({ name, quantity: "", grams: 100, catalogId: null, estimate: { calories: 100, proteinG: 5, carbsG: 10, fatG: 4 }, processing: "whole" as const })),
    };
  },
};

/** Meal plans without Claude: one sample meal per slot. */
export const stubMealPlanner: IMealPlanner = {
  async plan(context) {
    return Array.from({ length: context.days }, () =>
      context.meals.map((kind) => ({
        kind,
        title: "Stub meal (set ANTHROPIC_API_KEY for a real plan)",
        ingredients: [{ name: "Eggs", quantity: "2", grams: 100, catalogId: "eggs", estimate: { calories: 155, proteinG: 13, carbsG: 1, fatG: 11 }, processing: "whole" as const }],
        steps: ["Cook the eggs."],
      })),
    );
  },
};

export const stubDeviceExtractor: IDeviceExtractor = {
  async extract({ category, results }) {
    const first = results[0];
    return first ? [{ name: `${first.title} (stub)`, maker: "Stub", url: first.url, description: `Stub ${category.toLowerCase()}: set ANTHROPIC_API_KEY to read real search results.` }] : [];
  },
};
