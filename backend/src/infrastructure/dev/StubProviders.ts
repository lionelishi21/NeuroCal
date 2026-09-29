/**
 * Canned AI and search responses so the dev server runs without API keys.
 * Never used in the Lambda build.
 */
import type { IAiReasoningProvider } from "../../application/interfaces/IAiReasoningProvider";
import type { IAiVisionProvider } from "../../application/interfaces/IAiVisionProvider";
import type { ISearchEngineAdapter } from "../../application/interfaces/ISearchEngineAdapter";

export const stubVision: IAiVisionProvider = {
  async analyzeMealPhoto() {
    return {
      items: [
        { name: "Grilled chicken breast", portion: "150 g", calories: 248, macros: { proteinG: 46, carbsG: 0, fatG: 5.4 }, confidence: 0.92, glycemicLoad: "low" },
        { name: "Quinoa", portion: "¾ cup", calories: 166, macros: { proteinG: 6, carbsG: 29, fatG: 2.7 }, confidence: 0.81, glycemicLoad: "medium" },
        { name: "Roasted broccoli", portion: "1 cup", calories: 55, macros: { proteinG: 3.7, carbsG: 11, fatG: 0.6 }, confidence: 0.88, glycemicLoad: "low" },
      ],
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
