/** Domain → wire format (packages/contracts). The only place both vocabularies meet. */
import type * as C from "@neurocal/contracts";
import type { MealPhotoAnalysis } from "../application/interfaces/IAiVisionProvider";
import type { RecipeRecommendations } from "../application/use-cases/RecommendRecipeUseCase";
import type { BioState, CheckIn, FoodItem, Meal, Profile } from "../domain/types";

export const toProfile = (p: Profile): C.Profile => ({
  id: p.userId,
  displayName: p.displayName,
  timeZone: p.timeZone,
  dietaryPreference: p.dietaryPreference,
  cognitiveGoals: p.cognitiveGoals,
  dailyCalorieTarget: p.dailyCalorieTarget,
  macroTargets: p.macroTargets,
});

const toFoodItem = (i: FoodItem): C.FoodItem => ({
  name: i.name,
  portion: i.portion,
  calories: i.calories,
  macros: i.macros,
  ...(i.confidence === undefined ? {} : { confidence: i.confidence }),
});

export const toMeal = (m: Meal): C.Meal => ({
  id: m.id,
  kind: m.kind,
  eatenAt: m.eatenAt.toISOString(),
  items: m.items.map(toFoodItem),
});

export const toCheckIn = (c: CheckIn): C.CheckIn => ({
  id: c.id,
  at: c.at.toISOString(),
  flags: c.flags,
  ...(c.note === undefined ? {} : { note: c.note }),
});

export const toBioState = (s: BioState): C.BioState => ({ ...s });

export const toAnalysis = (a: MealPhotoAnalysis): C.AnalyzeMealResponse => ({
  items: a.items.map(toFoodItem),
  ...(a.problem ? { problem: a.problem } : {}),
});

export const toRecommendations = (r: RecipeRecommendations): C.NextRecommendationsResponse => ({
  searchQuery: r.searchQuery,
  recipes: r.recipes.map(({ searchQuery: _, ...recipe }) => recipe),
});
