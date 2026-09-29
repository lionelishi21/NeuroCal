import type { IAiReasoningProvider } from "../application/interfaces/IAiReasoningProvider";
import type { IAiVisionProvider } from "../application/interfaces/IAiVisionProvider";
import type { IClock } from "../application/interfaces/IClock";
import type {
  ICheckInRepository,
  IMealRepository,
  IProfileRepository,
  IRecommendationRepository,
} from "../application/interfaces/IRepositories";
import type { ISearchEngineAdapter } from "../application/interfaces/ISearchEngineAdapter";
import { AnalyzeMealPhotoUseCase } from "../application/use-cases/AnalyzeMealPhotoUseCase";
import { DeleteMealUseCase } from "../application/use-cases/DeleteMealUseCase";
import { GetBioStateUseCase } from "../application/use-cases/GetBioStateUseCase";
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
  vision: IAiVisionProvider;
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
  };
}

export const systemClock: IClock = { now: () => new Date() };
