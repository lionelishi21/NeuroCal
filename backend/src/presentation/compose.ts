import { randomUUID } from "node:crypto";
import type { Food } from "../domain/foods";
import type { IAiReasoningProvider } from "../application/interfaces/IAiReasoningProvider";
import type { IAiVisionProvider } from "../application/interfaces/IAiVisionProvider";
import type { ICatalogRepository } from "../application/interfaces/ICatalogRepository";
import type { IClock } from "../application/interfaces/IClock";
import type { IEmailSender } from "../application/interfaces/IEmailSender";
import type { IEmbeddingProvider } from "../application/interfaces/IEmbeddingProvider";
import type { IFocusExplainer } from "../application/interfaces/IFocusExplainer";
import type { IIdentityProvider } from "../application/interfaces/IIdentityProvider";
import type { IObjectStorage } from "../application/interfaces/IObjectStorage";
import type {
  ICheckInRepository,
  IFocusScoreRepository,
  IMealRepository,
  IProfileRepository,
  IRecommendationRepository,
  ITelemetryRepository,
  IUserRepository,
  IWaitlistRepository,
  IWeightRepository,
} from "../application/interfaces/IRepositories";
import type { ISearchEngineAdapter } from "../application/interfaces/ISearchEngineAdapter";
import type { IFoodLabelReader, IProductDatabase } from "../application/interfaces/IFoodLabels";
import type { IStackRepository } from "../application/interfaces/IStackRepository";
import type { IBrainCheckRepository } from "../application/interfaces/IBrainCheckRepository";
import type { IExerciseRepository } from "../application/interfaces/IExerciseRepository";
import type { IPantryRecipeAssistant, IPantryRepository } from "../application/interfaces/IPantry";
import type { IShoppingListReviewer } from "../application/interfaces/IShoppingListReviewer";
import type { IRecipeParser } from "../application/interfaces/IRecipeParser";
import type { IMealPlanRepository, IMealPlanner } from "../application/interfaces/IMealPlans";
import type { IAirQuality, IEnvironmentRepository, IGeocoder } from "../application/interfaces/IEnvironment";
import type { IKnowledgeRepository, ITechniqueExtractor, IVideoFeed } from "../application/interfaces/IKnowledge";
import type { IDeviceCandidateRepository, IDeviceExtractor, IWebSearch } from "../application/interfaces/IDevices";
import { DeviceScoutUseCases } from "../application/use-cases/DeviceScoutUseCases";
import { AiAllowanceUseCase } from "../application/use-cases/AiAllowanceUseCase";
import type { IAiUsage } from "../application/interfaces/IAiUsage";
import type { ISubscriptionLookup, ISubscriptionRepository } from "../application/interfaces/ISubscriptions";
import type { ISupplementLabelReader } from "../application/interfaces/ISupplementLabelReader";
import { AdminProductUseCases } from "../application/use-cases/AdminProductUseCases";
import { AnalyzeMealPhotoUseCase } from "../application/use-cases/AnalyzeMealPhotoUseCase";
import { AnalyzeSupplementLabelUseCase } from "../application/use-cases/AnalyzeSupplementLabelUseCase";
import { CreatePhotoUploadUseCase } from "../application/use-cases/CreatePhotoUploadUseCase";
import { DeleteAccountUseCase } from "../application/use-cases/DeleteAccountUseCase";
import { DeleteMealUseCase } from "../application/use-cases/DeleteMealUseCase";
import { GetBioStateUseCase } from "../application/use-cases/GetBioStateUseCase";
import { GetFocusScoreUseCase } from "../application/use-cases/GetFocusScoreUseCase";
import { GetHistoryUseCase } from "../application/use-cases/GetHistoryUseCase";
import { GetProtocolsUseCase } from "../application/use-cases/GetProtocolsUseCase";
import { IngestTelemetryUseCase } from "../application/use-cases/IngestTelemetryUseCase";
import { ListMealsUseCase } from "../application/use-cases/ListMealsUseCase";
import { DeleteWeightUseCase, GetWeightHistoryUseCase, LogWeightUseCase } from "../application/use-cases/WeightUseCases";
import { GetFastingUseCase } from "../application/use-cases/GetFastingUseCase";
import { GetSubscriptionUseCase, HandleStoreEventUseCase, SubscriptionGate } from "../application/use-cases/SubscriptionUseCases";
import { StackUseCases } from "../application/use-cases/StackUseCases";
import { ScanFoodUseCase } from "../application/use-cases/ScanFoodUseCase";
import { BrainCheckUseCases } from "../application/use-cases/BrainCheckUseCases";
import { ExerciseUseCases } from "../application/use-cases/ExerciseUseCases";
import { GetLevelUseCase } from "../application/use-cases/GetLevelUseCase";
import { PantryUseCases } from "../application/use-cases/PantryUseCases";
import { ReviewShoppingListUseCase } from "../application/use-cases/ReviewShoppingListUseCase";
import { KnowledgeUseCases } from "../application/use-cases/KnowledgeUseCases";
import { AnalyzeRecipeUseCase } from "../application/use-cases/AnalyzeRecipeUseCase";
import { EnvironmentUseCases } from "../application/use-cases/EnvironmentUseCases";
import { MealPlanUseCases } from "../application/use-cases/MealPlanUseCases";
import { ListFoodsUseCase } from "../application/use-cases/ListFoodsUseCase";
import { LogMealUseCase } from "../application/use-cases/LogMealUseCase";
import { GetProfileUseCase, UpdateProfileUseCase } from "../application/use-cases/ProfileUseCases";
import { RecommendRecipeUseCase } from "../application/use-cases/RecommendRecipeUseCase";
import { RecordCheckInUseCase } from "../application/use-cases/RecordCheckInUseCase";
import { AdminWaitlistUseCase, JoinWaitlistUseCase, LeaveWaitlistUseCase } from "../application/use-cases/WaitlistUseCases";
import type { UseCases } from "./routes";

export interface Ports {
  users: IUserRepository;
  identity: IIdentityProvider;
  profiles: IProfileRepository;
  meals: IMealRepository;
  checkIns: ICheckInRepository;
  recommendations: IRecommendationRepository;
  telemetry: ITelemetryRepository;
  focusScores: IFocusScoreRepository;
  catalog: ICatalogRepository;
  embedder: IEmbeddingProvider;
  vision: IAiVisionProvider;
  /** The food catalog (infrastructure/catalog/foods.ts). */
  foods: readonly Food[];
  labels: ISupplementLabelReader;
  foodLabels: IFoodLabelReader;
  products: IProductDatabase;
  storage: IObjectStorage;
  explainer: IFocusExplainer;
  reasoning: IAiReasoningProvider;
  search: ISearchEngineAdapter;
  clock: IClock;
  recipeDomains: string[];
  waitlist: IWaitlistRepository;
  weights: IWeightRepository;
  subscriptions: ISubscriptionRepository;
  stack: IStackRepository;
  brainChecks: IBrainCheckRepository;
  exercises: IExerciseRepository;
  pantry: IPantryRepository;
  pantryRecipes: IPantryRecipeAssistant;
  shoppingReviewer: IShoppingListReviewer;
  recipeParser: IRecipeParser;
  mealPlanner: IMealPlanner;
  mealPlans: IMealPlanRepository;
  environment: IEnvironmentRepository;
  airQuality: IAirQuality;
  geocoder: IGeocoder;
  knowledge: IKnowledgeRepository;
  techniqueExtractor: ITechniqueExtractor;
  /** Null without a YouTube API key: videos are then only added by hand. */
  videoFeed: IVideoFeed | null;
  knowledgeChannels: string[];
  deviceCandidates: IDeviceCandidateRepository;
  aiUsage: IAiUsage;
  deviceExtractor: IDeviceExtractor;
  /** Null without TAVILY_API_KEY: the device scout can't run. */
  webSearch: IWebSearch | null;
  /** RevenueCat's REST API, when its key is set. */
  subscriptionLookup: ISubscriptionLookup | null;
  /** The Authorization header RevenueCat's webhook sends. */
  storeWebhookAuth?: string;
  /** PAYWALL=on. */
  paywall: boolean;
  email: IEmailSender;
  /** The website; unsubscribe links point at it. */
  webUrl: string;
}

/** Wires use cases to whatever adapters the caller provides (ARCHITECTURE §2: composition root). */
export function buildUseCases(p: Ports): UseCases {
  const environment = new EnvironmentUseCases(p.environment, p.airQuality, p.geocoder, p.profiles, p.clock);
  const getSubscription = new GetSubscriptionUseCase(p.subscriptions, p.subscriptionLookup, p.clock);
  const getBioState = new GetBioStateUseCase(p.profiles, p.meals, p.checkIns, p.clock);
  const adminProducts = new AdminProductUseCases(p.catalog, p.embedder);
  return {
    getProfile: new GetProfileUseCase(p.profiles),
    updateProfile: new UpdateProfileUseCase(p.profiles),
    deleteAccount: new DeleteAccountUseCase(p.users, p.storage, p.identity),
    getBioState,
    recordCheckIn: new RecordCheckInUseCase(p.checkIns),
    createPhotoUpload: new CreatePhotoUploadUseCase(p.storage),
    analyzeMealPhoto: new AnalyzeMealPhotoUseCase(p.vision, p.storage),
    listFoods: new ListFoodsUseCase(p.foods),
    scanFood: new ScanFoodUseCase(p.foodLabels, p.products, p.storage, p.clock),
    logWeight: new LogWeightUseCase(p.profiles, p.weights, p.clock),
    getWeightHistory: new GetWeightHistoryUseCase(p.profiles, p.weights, p.clock),
    deleteWeight: new DeleteWeightUseCase(p.weights),
    getFasting: new GetFastingUseCase(p.profiles, p.meals, p.clock),
    getSubscription,
    stack: new StackUseCases(p.profiles, p.stack, p.clock),
    brainChecks: new BrainCheckUseCases(p.brainChecks, p.clock),
    exercise: new ExerciseUseCases(p.exercises, p.weights, p.profiles, p.clock),
    getLevel: new GetLevelUseCase(p.profiles, p.meals, p.checkIns, p.telemetry, p.exercises, p.brainChecks, p.clock, environment),
    pantry: new PantryUseCases(p.pantry, p.profiles, getBioState, p.pantryRecipes),
    reviewShoppingList: new ReviewShoppingListUseCase(p.profiles, p.shoppingReviewer, p.catalog),
    analyzeRecipe: new AnalyzeRecipeUseCase(p.recipeParser, p.foods),
    environment,
    mealPlans: new MealPlanUseCases(p.profiles, p.pantry, p.mealPlanner, p.mealPlans, p.foods, p.clock),
    knowledge: new KnowledgeUseCases(p.knowledge, p.techniqueExtractor, p.catalog, p.embedder, p.videoFeed, p.knowledgeChannels),
    handleStoreEvent: new HandleStoreEventUseCase(p.subscriptions, p.storeWebhookAuth),
    gate: new SubscriptionGate(getSubscription, p.paywall),
    analyzeSupplementLabel: new AnalyzeSupplementLabelUseCase(p.labels, p.storage, p.catalog, p.embedder, p.clock),
    logMeal: new LogMealUseCase(p.meals, p.clock),
    listMeals: new ListMealsUseCase(p.profiles, p.meals, p.clock),
    deleteMeal: new DeleteMealUseCase(p.meals),
    recommendRecipe: new RecommendRecipeUseCase(p.profiles, getBioState, p.reasoning, p.search, p.recommendations, {
      allowedDomains: p.recipeDomains,
    }),
    ingestTelemetry: new IngestTelemetryUseCase(p.telemetry, p.clock),
    getFocusScore: new GetFocusScoreUseCase(p.profiles, p.meals, p.checkIns, p.telemetry, p.focusScores, p.explainer, p.clock, p.exercises, p.brainChecks, environment),
    getHistory: new GetHistoryUseCase(p.profiles, p.meals, p.checkIns, p.telemetry, p.clock, p.exercises, environment),
    adminProducts,
    aiAllowance: new AiAllowanceUseCase(p.aiUsage, p.clock),
    devices: new DeviceScoutUseCases(p.deviceCandidates, p.webSearch, p.deviceExtractor, adminProducts),
    getProtocols: new GetProtocolsUseCase(p.profiles, p.meals, p.checkIns, p.telemetry, p.catalog, p.embedder, p.clock, undefined, p.exercises, environment),
    joinWaitlist: new JoinWaitlistUseCase(p.waitlist, p.email, p.clock, { webUrl: p.webUrl, newToken: () => randomUUID().replaceAll("-", "") }),
    leaveWaitlist: new LeaveWaitlistUseCase(p.waitlist),
    adminWaitlist: new AdminWaitlistUseCase(p.waitlist, p.clock),
  };
}

export const systemClock: IClock = { now: () => new Date() };
