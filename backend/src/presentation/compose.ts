import type { IAiReasoningProvider } from "../application/interfaces/IAiReasoningProvider";
import type { IAiVisionProvider } from "../application/interfaces/IAiVisionProvider";
import type { ICatalogRepository } from "../application/interfaces/ICatalogRepository";
import type { IClock } from "../application/interfaces/IClock";
import type { IEmbeddingProvider } from "../application/interfaces/IEmbeddingProvider";
import type { IFocusExplainer } from "../application/interfaces/IFocusExplainer";
import type { IObjectStorage } from "../application/interfaces/IObjectStorage";
import type {
  ICheckInRepository,
  IFocusScoreRepository,
  IMealRepository,
  IProfileRepository,
  IRecommendationRepository,
  ITelemetryRepository,
} from "../application/interfaces/IRepositories";
import type { ISearchEngineAdapter } from "../application/interfaces/ISearchEngineAdapter";
import { AdminProductUseCases } from "../application/use-cases/AdminProductUseCases";
import { AnalyzeMealPhotoUseCase } from "../application/use-cases/AnalyzeMealPhotoUseCase";
import { CreatePhotoUploadUseCase } from "../application/use-cases/CreatePhotoUploadUseCase";
import { DeleteMealUseCase } from "../application/use-cases/DeleteMealUseCase";
import { GetBioStateUseCase } from "../application/use-cases/GetBioStateUseCase";
import { GetFocusScoreUseCase } from "../application/use-cases/GetFocusScoreUseCase";
import { GetHistoryUseCase } from "../application/use-cases/GetHistoryUseCase";
import { GetProtocolsUseCase } from "../application/use-cases/GetProtocolsUseCase";
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
  catalog: ICatalogRepository;
  embedder: IEmbeddingProvider;
  vision: IAiVisionProvider;
  storage: IObjectStorage;
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
    createPhotoUpload: new CreatePhotoUploadUseCase(p.storage),
    analyzeMealPhoto: new AnalyzeMealPhotoUseCase(p.vision, p.storage),
    logMeal: new LogMealUseCase(p.meals, p.clock),
    listMeals: new ListMealsUseCase(p.profiles, p.meals, p.clock),
    deleteMeal: new DeleteMealUseCase(p.meals),
    recommendRecipe: new RecommendRecipeUseCase(p.profiles, getBioState, p.reasoning, p.search, p.recommendations, {
      allowedDomains: p.recipeDomains,
    }),
    ingestTelemetry: new IngestTelemetryUseCase(p.telemetry, p.clock),
    getFocusScore: new GetFocusScoreUseCase(p.profiles, p.meals, p.checkIns, p.telemetry, p.focusScores, p.explainer, p.clock),
    getHistory: new GetHistoryUseCase(p.profiles, p.meals, p.checkIns, p.telemetry, p.clock),
    adminProducts: new AdminProductUseCases(p.catalog, p.embedder),
    getProtocols: new GetProtocolsUseCase(p.profiles, p.meals, p.checkIns, p.telemetry, p.catalog, p.embedder, p.clock),
  };
}

export const systemClock: IClock = { now: () => new Date() };
