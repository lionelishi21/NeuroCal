import { z } from "zod";
import type { IWebSearch, WebResult } from "../../application/interfaces/IDevices";

const ENDPOINT = "https://api.tavily.com/search";

/** Only the parts of the Tavily search response we read. */
const SearchResponse = z.object({
  results: z.array(z.object({ title: z.string(), url: z.string(), content: z.string().nullish() })).optional(),
});

/** A general web search via Tavily (the device scout). Recipes use TavilyRecipeSearch. */
export class TavilyWebSearch implements IWebSearch {
  constructor(private readonly options: { apiKey: string; fetch?: typeof fetch; timeoutMs?: number }) {}

  async search(query: string, opts: { limit: number }): Promise<WebResult[]> {
    const response = await (this.options.fetch ?? fetch)(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${this.options.apiKey}` },
      body: JSON.stringify({ query, search_depth: "basic", topic: "general", max_results: Math.min(opts.limit, 20) }),
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 10_000),
    });
    if (!response.ok) throw new Error(`Web search failed with ${response.status}`);
    const body = SearchResponse.parse(await response.json());
    return (body.results ?? [])
      .filter((r) => r.url.startsWith("https://"))
      .map((r) => ({ title: r.title, url: r.url.split("#")[0]!, snippet: (r.content ?? "").slice(0, 1200) }));
  }
}
