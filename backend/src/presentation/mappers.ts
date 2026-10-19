/** Domain → wire format (packages/contracts). The only place both vocabularies meet. */
import type * as C from "@neurocal/contracts";
import type { MealPhotoAnalysis } from "../application/interfaces/IAiVisionProvider";
import type { SupplementLabelAnalysis } from "../application/use-cases/AnalyzeSupplementLabelUseCase";
import type { FastingStatus } from "../application/use-cases/GetFastingUseCase";
import type { ProtocolMatches } from "../application/use-cases/GetProtocolsUseCase";
import type { RecipeRecommendations } from "../application/use-cases/RecommendRecipeUseCase";
import type { BioState, CheckIn, FocusScore, FoodItem, Meal, Product, Profile } from "../domain/types";

export const toProfile = (p: Profile): C.Profile => ({
  id: p.userId,
  displayName: p.displayName,
  timeZone: p.timeZone,
  dietaryPreference: p.dietaryPreference,
  cognitiveGoals: p.cognitiveGoals,
  dailyCalorieTarget: p.dailyCalorieTarget,
  macroTargets: p.macroTargets,
  // Stored as given; the response schema checks the shape before it is sent.
  ...(p.bioProfile ? { bioProfile: p.bioProfile as C.BioProfile } : {}),
  // The use case only accepts the contract's paces.
  ...(p.weightGoal ? { weightGoal: p.weightGoal as C.WeightGoal } : {}),
  ...(p.healthConditions ? { healthConditions: p.healthConditions as C.HealthCondition[] } : {}),
});

export const toFasting = (f: FastingStatus): C.FastingStatus => ({
  protocol: f.protocol,
  ...(f.fastHours ? { fastHours: f.fastHours } : {}),
  state:
    f.state.kind === "fasting" || f.state.kind === "fasted"
      ? { kind: f.state.kind, since: f.state.since.toISOString(), goalAt: f.state.goalAt.toISOString() }
      : f.state.kind === "eating"
        ? { kind: "eating", openedAt: f.state.openedAt.toISOString(), closesAt: f.state.closesAt.toISOString() }
        : { kind: f.state.kind },
  streakDays: f.streakDays,
});

export const toFoodItem = (i: FoodItem): C.FoodItem => ({
  name: i.name,
  portion: i.portion,
  calories: i.calories,
  macros: i.macros,
  ...(i.confidence === undefined ? {} : { confidence: i.confidence }),
  ...(i.glycemicLoad === undefined ? {} : { glycemicLoad: i.glycemicLoad }),
  ...(i.processing === undefined ? {} : { processing: i.processing }),
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

export const toFocusScore = (f: FocusScore): C.FocusScore => ({
  date: f.date,
  score: f.score,
  components: f.components,
  explanation: f.explanation,
  ...(f.tuned ? { tuned: true } : {}),
  ...(f.glycemicFromSensor ? { glycemicFromSensor: true } : {}),
});

const match = (similarity: number) => Math.round(similarity * 100) / 100;

export const toProtocols = (m: ProtocolMatches): C.ProtocolsResponse => ({
  weakPoints: m.weakPoints,
  protocols: m.protocols.map(({ item, similarity }) => ({
    id: item.id,
    title: item.title,
    summary: item.summary,
    steps: item.steps,
    match: match(similarity),
    ...(item.source ? { source: item.source } : {}),
  })),
  products: m.products.map(toProductRecommendation),
});

export const toProductRecommendation = ({ item, similarity }: { item: Product; similarity: number }): C.ProductRecommendation => ({
  id: item.id,
  name: item.name,
  description: item.description,
  ...(item.url ? { url: item.url } : {}),
  affiliate: item.affiliate,
  ownBrand: item.ownBrand,
  supplement: item.supplement,
  match: match(similarity),
});

export const toSupplementLabel = ({ reading: { proprietaryBlend: _, ...reading }, summary, flags, alternative }: SupplementLabelAnalysis): C.SupplementLabelResponse => ({
  ...reading,
  summary,
  flags,
  ...(alternative ? { alternative: toProductRecommendation(alternative) } : {}),
});

export const toRecommendations = (r: RecipeRecommendations): C.NextRecommendationsResponse => ({
  searchQuery: r.searchQuery,
  recipes: r.recipes.map(({ searchQuery: _, ...recipe }) => recipe),
});
