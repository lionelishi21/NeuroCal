import type { IAiReasoningProvider } from "../application/interfaces/IAiReasoningProvider";
import type { IAiVisionProvider } from "../application/interfaces/IAiVisionProvider";
import type { IClock } from "../application/interfaces/IClock";
import type { IFocusExplainer } from "../application/interfaces/IFocusExplainer";
import type {
  ICheckInRepository,
  IFocusScoreRepository,
  IMealRepository,
  IProfileRepository,
  IRecommendationRepository,
  ITelemetryRepository,
} from "../application/interfaces/IRepositories";
import type { ISearchEngineAdapter } from "../application/interfaces/ISearchEngineAdapter";
import { AnalyzeMealPhotoUseCase } from "../application/use-cases/AnalyzeMealPhotoUseCase";
import { DeleteMealUseCase } from "../application/use-cases/DeleteMealUseCase";
import { GetBioStateUseCase } from "../application/use-cases/GetBioStateUseCase";
import { GetFocusScoreUseCase } from "../application/use-cases/GetFocusScoreUseCase";
import { IngestTelemetryUseCase } from "../application/use-cases/IngestTelemetryUseCase";
import { ListMealsUseCase } from "../application/use-cases/ListMealsUseCase";
import { LogMealUseCase } from "../application/use-cases/LogMealUseCase";
import { GetProfileUseCase, UpdateProfileUseCase } from "../application/use-cases/ProfileUseCases";
import { RecommendRecipeUseCase } from "../application/use-cases/RecommendRecipeUseCase";
import { RecordCheckInUseCase } from "../application/use-cases/RecordCheckInUseCase";
import type { UseCases } from "./routes";

export interface Ports {
  profiles: IProfileRepository;
  meals: IMealRepository;
  checkIns: ICheckInRepository;
  recommendations: IRecommendationRepository;
  telemetry: ITelemetryRepository;
  focusScores: IFocusScoreRepository;
  vision: IAiVisionProvider;
  explainer: IFocusExplainer;
  reasoning: IAiReasoningProvider;
  search: ISearchEngineAdapter;
  clock: IClock;
  recipeDomains: string[];
}

/** Wires use cases to whatever adapters the caller provides (ARCHITECTURE §2: composition root). */
export function buildUseCases(p: Ports): UseCases {
  const getBioState = new GetBioStateUseCase(p.profiles, p.meals, p.checkIns, p.clock);
  return {
    getProfile: new GetProfileUseCase(p.profiles),
    updateProfile: new UpdateProfileUseCase(p.profiles),
    getBioState,
    recordCheckIn: new RecordCheckInUseCase(p.checkIns),
    analyzeMealPhoto: new AnalyzeMealPhotoUseCase(p.vision),
    logMeal: new LogMealUseCase(p.meals, p.clock),
    listMeals: new ListMealsUseCase(p.profiles, p.meals, p.clock),
    deleteMeal: new DeleteMealUseCase(p.meals),
    recommendRecipe: new RecommendRecipeUseCase(p.profiles, getBioState, p.reasoning, p.search, p.recommendations, {
      allowedDomains: p.recipeDomains,
    }),
    ingestTelemetry: new IngestTelemetryUseCase(p.telemetry, p.clock),
    getFocusScore: new GetFocusScoreUseCase(p.profiles, p.meals, p.checkIns, p.telemetry, p.focusScores, p.explainer, p.clock),
  };
}

export const systemClock: IClock = { now: () => new Date() };
