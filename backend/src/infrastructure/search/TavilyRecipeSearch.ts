import { z } from "zod";
import type { ISearchEngineAdapter, RecipeSearchHit } from "../../application/interfaces/ISearchEngineAdapter";
import { type PageFetch, hostOf, withRecipeData } from "./recipePages";

const ENDPOINT = "https://api.tavily.com/search";

/** Only the parts of the Tavily search response we read. Everything else is ignored. */
const SearchResponse = z.object({
  results: z
    .array(
      z.object({
        title: z.string(),
        url: z.string(),
        content: z.string().nullish(),
      }),
    )
    .optional(),
});

/**
 * Recipe search via the Tavily Search API (ARCHITECTURE §6.6). The allow-list
 * goes to Tavily as `include_domains`, so results come only from those sites.
 * Tavily returns links and a text extract, not nutrition, so each hit's page
 * is fetched and its schema.org Recipe data read.
 */
export class TavilyRecipeSearch implements ISearchEngineAdapter {
  constructor(
    private readonly options: { apiKey: string; fetch?: PageFetch; timeoutMs?: number; pageTimeoutMs?: number },
  ) {}

  async searchRecipes(query: string, opts: { allowedDomains: string[]; limit: number }): Promise<RecipeSearchHit[]> {
    const fetchImpl: PageFetch = this.options.fetch ?? fetch;
    const response = await fetchImpl(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.options.apiKey}` },
      body: JSON.stringify({
        query,
        search_depth: "basic",
        // Guides and collection pages come back alongside recipes and are dropped later, so ask for extra.
        max_results: Math.min(opts.limit * 2, 20),
        ...(opts.allowedDomains.length ? { include_domains: opts.allowedDomains } : {}),
      }),
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 8_000),
    });
    if (!response.ok) throw new Error(`Recipe search failed with ${response.status}`);
    const body = SearchResponse.parse(await response.json());

    const hits = (body.results ?? []).map(
      (result): RecipeSearchHit => ({
        title: result.title,
        url: result.url.split("#")[0]!,
        sourceName: hostOf(result.url)?.replace(/^www\./, "") ?? result.url,
        snippet: result.content ?? "",
      }),
    );
    return Promise.all(hits.map((hit) => withRecipeData(hit, opts.allowedDomains, fetchImpl, this.options.pageTimeoutMs)));
  }
}
