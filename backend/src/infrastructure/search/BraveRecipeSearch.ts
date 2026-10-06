import { z } from "zod";
import type { ISearchEngineAdapter, RecipeSearchHit } from "../../application/interfaces/ISearchEngineAdapter";
import { type PageFetch, hostOf, withRecipeData } from "./recipePages";

const ENDPOINT = "https://api.search.brave.com/res/v1/web/search";

/** Only the parts of the Brave Web Search response we read. Everything else is ignored. */
const SearchResponse = z.object({
  web: z
    .object({
      results: z.array(
        z.object({
          title: z.string(),
          url: z.string(),
          description: z.string().optional(),
          profile: z.object({ name: z.string().optional() }).optional(),
          thumbnail: z.object({ src: z.string().optional() }).optional(),
        }),
      ),
    })
    .optional(),
});

type Fetch = PageFetch;

/**
 * Recipe search via the Brave Search API, restricted to the allow-list
 * (ARCHITECTURE §6.6). Brave returns links, not nutrition, so each allowed
 * hit's page is fetched and its schema.org Recipe data read. A page that
 * can't be read leaves its hit without nutrition, and the use case drops it.
 */
export class BraveRecipeSearch implements ISearchEngineAdapter {
  constructor(
    private readonly options: { apiKey: string; fetch?: Fetch; timeoutMs?: number; pageTimeoutMs?: number },
  ) {}

  async searchRecipes(query: string, opts: { allowedDomains: string[]; limit: number }): Promise<RecipeSearchHit[]> {
    const sites = opts.allowedDomains.map((d) => `site:${d}`).join(" OR ");
    const params = new URLSearchParams({
      q: sites ? `${query} (${sites})` : query,
      count: String(Math.min(opts.limit, 20)),
      result_filter: "web",
    });
    const fetchImpl: Fetch = this.options.fetch ?? fetch;
    const response = await fetchImpl(`${ENDPOINT}?${params}`, {
      headers: { accept: "application/json", "x-subscription-token": this.options.apiKey },
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 8_000),
    });
    if (!response.ok) throw new Error(`Recipe search failed with ${response.status}`);
    const body = SearchResponse.parse(await response.json());

    const hits = (body.web?.results ?? []).map((result): RecipeSearchHit => {
      const image = result.thumbnail?.src;
      return {
        title: result.title,
        url: result.url,
        sourceName: result.profile?.name?.trim() || hostOf(result.url)?.replace(/^www\./, "") || result.url,
        // Brave marks the matched words with <strong>; the snippet is plain text for us.
        snippet: (result.description ?? "").replace(/<[^>]+>/g, ""),
        ...(image?.startsWith("https://") ? { imageUrl: image } : {}),
      };
    });
    return Promise.all(hits.map((hit) => withRecipeData(hit, opts.allowedDomains, fetchImpl, this.options.pageTimeoutMs)));
  }
}
