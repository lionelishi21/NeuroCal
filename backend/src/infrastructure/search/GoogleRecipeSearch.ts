import { z } from "zod";
import type { ISearchEngineAdapter, RecipeSearchHit } from "../../application/interfaces/ISearchEngineAdapter";

const ENDPOINT = "https://www.googleapis.com/customsearch/v1";

/** Only the parts of the Custom Search JSON API response we read. Everything else is ignored. */
const PageMapEntry = z.record(z.string(), z.unknown());
const SearchResponse = z.object({
  items: z
    .array(
      z.object({
        title: z.string(),
        link: z.string(),
        displayLink: z.string(),
        snippet: z.string().optional(),
        pagemap: z.record(z.string(), z.array(PageMapEntry)).optional(),
      }),
    )
    .optional(),
});

type Fetch = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

/** Recipe search via Google Custom Search, restricted to the allow-list (ARCHITECTURE §6.6). */
export class GoogleRecipeSearch implements ISearchEngineAdapter {
  constructor(
    private readonly options: { apiKey: string; engineId: string; fetch?: Fetch; timeoutMs?: number },
  ) {}

  async searchRecipes(query: string, opts: { allowedDomains: string[]; limit: number }): Promise<RecipeSearchHit[]> {
    const sites = opts.allowedDomains.map((d) => `site:${d}`).join(" OR ");
    const params = new URLSearchParams({
      key: this.options.apiKey,
      cx: this.options.engineId,
      q: sites ? `${query} (${sites})` : query,
      num: String(Math.min(opts.limit, 10)),
    });
    const fetchImpl: Fetch = this.options.fetch ?? fetch;
    const response = await fetchImpl(`${ENDPOINT}?${params}`, {
      signal: AbortSignal.timeout(this.options.timeoutMs ?? 8_000),
    });
    if (!response.ok) throw new Error(`Recipe search failed with ${response.status}`);
    const body = SearchResponse.parse(await response.json());
    return (body.items ?? []).map(toHit);
  }
}

function toHit(item: NonNullable<z.infer<typeof SearchResponse>["items"]>[number]): RecipeSearchHit {
  const pagemap = item.pagemap ?? {};
  const recipe = pagemap.recipe?.[0] ?? {};
  const nutrition = pagemap.nutritioninformation?.[0] ?? recipe;
  const meta = pagemap.metatags?.[0] ?? {};

  const minutes =
    isoMinutes(recipe.totaltime) ?? sum(isoMinutes(recipe.preptime), isoMinutes(recipe.cooktime));
  const calories = firstNumber(nutrition.calories);
  const proteinG = firstNumber(nutrition.proteincontent);
  const carbsG = firstNumber(nutrition.carbohydratecontent);
  const fatG = firstNumber(nutrition.fatcontent);
  const imageUrl = str(pagemap.cse_image?.[0]?.src) ?? str(meta["og:image"]);

  return {
    title: str(recipe.name) ?? item.title,
    url: item.link,
    sourceName: str(meta["og:site_name"]) ?? item.displayLink.replace(/^www\./, ""),
    snippet: item.snippet ?? "",
    ...(imageUrl ? { imageUrl } : {}),
    ...(minutes !== undefined ? { minutes } : {}),
    ...(calories !== undefined ? { calories } : {}),
    ...(proteinG !== undefined && carbsG !== undefined && fatG !== undefined ? { macros: { proteinG, carbsG, fatG } } : {}),
  };
}

const str = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : undefined);

/** "450 calories", "30 g" → 450, 30. */
function firstNumber(value: unknown): number | undefined {
  const match = str(value)?.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

/** ISO 8601 duration ("PT1H30M") → 90. */
export function isoMinutes(value: unknown): number | undefined {
  const match = str(value)?.match(/^P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!match || !(match[1] || match[2] || match[3])) return undefined;
  const [, d = "0", h = "0", m = "0"] = match;
  const total = Number(d) * 1440 + Number(h) * 60 + Number(m);
  return total > 0 ? total : undefined;
}

function sum(a: number | undefined, b: number | undefined): number | undefined {
  return a === undefined && b === undefined ? undefined : (a ?? 0) + (b ?? 0);
}
