import { DomainError, NotFoundError, UpstreamError } from "../../domain/errors";
import type { NewRecipeRecommendation, RecipeRecommendation } from "../../domain/types";
import type { IAiReasoningProvider } from "../interfaces/IAiReasoningProvider";
import type { IProfileRepository, IRecommendationRepository } from "../interfaces/IRepositories";
import type { ISearchEngineAdapter, RecipeSearchHit } from "../interfaces/ISearchEngineAdapter";
import type { GetBioStateUseCase } from "./GetBioStateUseCase";

export interface RecommendRecipeConfig {
  /** Trusted recipe sites (ARCHITECTURE §11). Subdomains are allowed. */
  allowedDomains: string[];
  searchLimit?: number;
  maxRecipes?: number;
}

export interface RecipeRecommendations {
  searchQuery: string;
  recipes: RecipeRecommendation[];
}

/** Bio-state → Claude search query → recipe search → rank → save (ARCHITECTURE §6.6). */
export class RecommendRecipeUseCase {
  constructor(
    private readonly profiles: IProfileRepository,
    private readonly bioState: GetBioStateUseCase,
    private readonly reasoning: IAiReasoningProvider,
    private readonly search: ISearchEngineAdapter,
    private readonly recommendations: IRecommendationRepository,
    private readonly config: RecommendRecipeConfig,
  ) {}

  async execute(input: { userId: string }): Promise<RecipeRecommendations> {
    const profile = await this.profiles.get(input.userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");

    const state = await this.bioState.forProfile(profile);
    const caloriesRemaining = state.calorieTarget - state.caloriesEaten;

    const query = await this.upstream(() =>
      this.reasoning.generateRecipeSearchQuery({
        caloriesRemaining,
        macroFocus: state.macroFocus,
        cognitiveFlags: state.cognitiveFlags,
        dietaryPreference: state.dietaryPreference,
      }),
    );
    const hits = await this.upstream(() =>
      this.search.searchRecipes(query.searchQuery, {
        allowedDomains: this.config.allowedDomains,
        limit: this.config.searchLimit ?? 10,
      }),
    );

    const picked = this.rank(hits, caloriesRemaining).map(
      (hit): NewRecipeRecommendation => ({
        title: hit.title,
        sourceName: hit.sourceName,
        sourceUrl: hit.url,
        ...(hit.imageUrl ? { imageUrl: hit.imageUrl } : {}),
        minutes: hit.minutes,
        calories: hit.calories,
        macros: hit.macros,
        reasoning: query.contextualReasoning,
        searchQuery: query.searchQuery,
      }),
    );

    const recipes = picked.length ? await this.recommendations.saveRecipes(input.userId, picked) : [];
    return { searchQuery: query.searchQuery, recipes };
  }

  /**
   * Keep hits from allowed domains that carry full nutrition (the contract requires it),
   * that fit the calories left (when any are left), best protein-per-calorie first.
   */
  private rank(hits: RecipeSearchHit[], caloriesRemaining: number) {
    const seen = new Set<string>();
    return hits
      .filter((hit): hit is RecipeSearchHit & Required<Pick<RecipeSearchHit, "minutes" | "calories" | "macros">> => {
        if (seen.has(hit.url) || !this.isAllowed(hit.url)) return false;
        seen.add(hit.url);
        return hit.minutes !== undefined && hit.calories !== undefined && hit.macros !== undefined;
      })
      .filter((hit) => caloriesRemaining <= 0 || hit.calories <= caloriesRemaining)
      .sort((a, b) => b.macros.proteinG / Math.max(b.calories, 1) - a.macros.proteinG / Math.max(a.calories, 1))
      .slice(0, this.config.maxRecipes ?? 3);
  }

  private isAllowed(url: string): boolean {
    let host: string;
    try {
      host = new URL(url).hostname;
    } catch {
      return false;
    }
    return this.config.allowedDomains.some((domain) => host === domain || host.endsWith(`.${domain}`));
  }

  private async upstream<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call();
    } catch (error) {
      if (error instanceof DomainError) throw error;
      throw new UpstreamError("Suggestions aren't available right now. Try again in a moment.");
    }
  }
}
