import type { ISearchEngineAdapter } from "../../application/interfaces/ISearchEngineAdapter";
import type { AppConfig } from "../config";
import { BraveRecipeSearch } from "./BraveRecipeSearch";
import { GoogleRecipeSearch } from "./GoogleRecipeSearch";
import { TavilyRecipeSearch } from "./TavilyRecipeSearch";

/**
 * The recipe search the configuration allows, by which key is set: Tavily
 * first, then Brave, then Google Custom Search (needs both of its settings),
 * otherwise none. Google no longer accepts new projects on the Custom Search
 * JSON API; its adapter stays for projects that still have access.
 */
export function createRecipeSearch(config: Pick<AppConfig, "tavilyApiKey" | "braveSearchApiKey" | "googleSearchApiKey" | "googleSearchEngineId">): ISearchEngineAdapter | undefined {
  if (config.tavilyApiKey) return new TavilyRecipeSearch({ apiKey: config.tavilyApiKey });
  if (config.braveSearchApiKey) return new BraveRecipeSearch({ apiKey: config.braveSearchApiKey });
  if (config.googleSearchApiKey && config.googleSearchEngineId) {
    return new GoogleRecipeSearch({ apiKey: config.googleSearchApiKey, engineId: config.googleSearchEngineId });
  }
  return undefined;
}
