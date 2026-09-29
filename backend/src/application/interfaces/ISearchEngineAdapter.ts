import type { Macros } from "../../domain/types";

export interface RecipeSearchHit {
  title: string;
  url: string;
  sourceName: string;
  snippet: string;
  imageUrl?: string;
  /** From the page's schema.org Recipe data when the search result carries it. */
  minutes?: number;
  calories?: number;
  macros?: Macros;
}

export interface ISearchEngineAdapter {
  searchRecipes(query: string, opts: { allowedDomains: string[]; limit: number }): Promise<RecipeSearchHit[]>;
}
