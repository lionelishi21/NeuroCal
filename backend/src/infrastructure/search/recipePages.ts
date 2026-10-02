import type { RecipeSearchHit } from "../../application/interfaces/ISearchEngineAdapter";
import { readRecipeData } from "./recipeData";

/** Recipe pages are a few hundred KB; anything far beyond that isn't one. */
const MAX_PAGE_BYTES = 3_000_000;

interface FetchResponse {
  ok: boolean;
  status: number;
  url?: string;
  json(): Promise<unknown>;
  text(): Promise<string>;
}
/** The part of `fetch` the search adapters use; tests pass a fake. */
export type PageFetch = (
  url: string,
  init?: { method?: string; headers?: Record<string, string>; body?: string; signal?: AbortSignal },
) => Promise<FetchResponse>;

export function hostOf(url: string): string | undefined {
  try {
    return new URL(url).hostname;
  } catch {
    return undefined;
  }
}

export function isAllowed(url: string, allowedDomains: string[]): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  return parsed.protocol === "https:" && allowedDomains.some((d) => parsed.hostname === d || parsed.hostname.endsWith(`.${d}`));
}

/**
 * Adds minutes, calories and macros from the recipe's own page, for search
 * providers that return links without nutrition. Never throws: a page that
 * can't be read leaves the hit as it was, and the use case drops it.
 */
export async function withRecipeData(hit: RecipeSearchHit, allowedDomains: string[], fetchImpl: PageFetch, timeoutMs = 5_000): Promise<RecipeSearchHit> {
  // Only allow-listed https pages are fetched: search results are untrusted input.
  if (!isAllowed(hit.url, allowedDomains)) return hit;
  try {
    const response = await fetchImpl(hit.url, {
      headers: { accept: "text/html", "user-agent": "NeuroCalBot/0.1 (recipe nutrition lookup)" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    // A redirect off the allow-list is not the page we asked for.
    if (!response.ok || (response.url && !isAllowed(response.url, allowedDomains))) return hit;
    const html = await response.text();
    if (html.length > MAX_PAGE_BYTES) return hit;
    const data = readRecipeData(html);
    return {
      ...hit,
      ...(data.title ? { title: data.title } : {}),
      ...(data.imageUrl ? { imageUrl: data.imageUrl } : {}),
      ...(data.minutes !== undefined ? { minutes: data.minutes } : {}),
      ...(data.calories !== undefined ? { calories: data.calories } : {}),
      ...(data.macros ? { macros: data.macros } : {}),
    };
  } catch {
    return hit;
  }
}
