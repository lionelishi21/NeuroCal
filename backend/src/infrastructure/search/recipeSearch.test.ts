import { describe, expect, it, jest } from "@jest/globals";
import { BraveRecipeSearch } from "./BraveRecipeSearch";
import { createRecipeSearch } from "./createRecipeSearch";
import { GoogleRecipeSearch } from "./GoogleRecipeSearch";
import { readRecipeData } from "./recipeData";
import { TavilyRecipeSearch } from "./TavilyRecipeSearch";

const recipe = {
  "@context": "https://schema.org",
  "@type": "Recipe",
  name: "Miso-Glazed Cod",
  image: ["https://img.example/cod.jpg"],
  totalTime: "PT30M",
  nutrition: { "@type": "NutritionInformation", calories: "640 kcal", proteinContent: "46 g", carbohydrateContent: "62 g", fatContent: "18 g" },
};
const page = (data: unknown) => `<html><head><script type="application/ld+json">${JSON.stringify(data)}</script></head><body></body></html>`;

const results = {
  web: {
    results: [
      { title: "Miso-Glazed Cod Recipe", url: "https://www.seriouseats.com/miso-cod", description: "Flaky <strong>cod</strong>…", profile: { name: "Serious Eats" } },
      { title: "Lentil skillet", url: "https://www.bbcgoodfood.com/lentils" },
      { title: "Off the list", url: "https://evil.example/recipe" },
    ],
  },
};

function withPages(pages: Record<string, { status?: number; html?: string; finalUrl?: string }>, search: unknown = results, searchOk = true) {
  const fetch = jest.fn(async (url: string, _init?: { headers?: Record<string, string> }) => {
    if (url.startsWith("https://api.search.brave.com/")) {
      return { ok: searchOk, status: searchOk ? 200 : 429, json: async () => search, text: async (): Promise<string> => "" };
    }
    const found = pages[url];
    if (!found) throw new Error("network down");
    const status = found.status ?? 200;
    return { ok: status === 200, status, url: found.finalUrl ?? url, json: async () => ({}), text: async (): Promise<string> => found.html ?? "" };
  });
  return { fetch, search: new BraveRecipeSearch({ apiKey: "k", fetch }) };
}

const opts = { allowedDomains: ["seriouseats.com", "bbcgoodfood.com"], limit: 10 };

describe("BraveRecipeSearch", () => {
  it("restricts the query to allowed sites and reads nutrition from each recipe page", async () => {
    const { fetch, search } = withPages({ "https://www.seriouseats.com/miso-cod": { html: page(recipe) }, "https://www.bbcgoodfood.com/lentils": { html: "<html>no data</html>" } });
    const hits = await search.searchRecipes("high protein dinner", opts);

    const [searchUrl, init] = fetch.mock.calls[0]!;
    expect(new URL(searchUrl).searchParams.get("q")).toBe("high protein dinner (site:seriouseats.com OR site:bbcgoodfood.com)");
    expect(init?.headers).toMatchObject({ "x-subscription-token": "k" });
    expect(hits[0]).toEqual({
      title: "Miso-Glazed Cod",
      url: "https://www.seriouseats.com/miso-cod",
      sourceName: "Serious Eats",
      snippet: "Flaky cod…",
      imageUrl: "https://img.example/cod.jpg",
      minutes: 30,
      calories: 640,
      macros: { proteinG: 46, carbsG: 62, fatG: 18 },
    });
    // No recipe data on the page: returned without nutrition, and the use case filters it out.
    expect(hits[1]).toEqual({ title: "Lentil skillet", url: "https://www.bbcgoodfood.com/lentils", sourceName: "bbcgoodfood.com", snippet: "" });
  });

  it("never fetches a page outside the allow-list", async () => {
    const { fetch, search } = withPages({});
    const hits = await search.searchRecipes("q", opts);
    expect(fetch.mock.calls.map(([url]) => url)).not.toContain("https://evil.example/recipe");
    expect(hits[2]).toEqual({ title: "Off the list", url: "https://evil.example/recipe", sourceName: "evil.example", snippet: "" });
  });

  it("keeps the hit when its page fails, errors or redirects off the allow-list", async () => {
    const { search } = withPages({
      "https://www.seriouseats.com/miso-cod": { html: page(recipe), finalUrl: "https://elsewhere.example/landing" },
      "https://www.bbcgoodfood.com/lentils": { status: 403 },
    });
    const hits = await search.searchRecipes("q", opts);
    expect(hits).toHaveLength(3);
    expect(hits.every((hit) => hit.calories === undefined)).toBe(true);
  });

  it("handles no results and a failed search", async () => {
    await expect(withPages({}, {}).search.searchRecipes("q", opts)).resolves.toEqual([]);
    await expect(withPages({}, {}, false).search.searchRecipes("q", opts)).rejects.toThrow("429");
  });
});

describe("TavilyRecipeSearch", () => {
  it("sends the allow-list as include_domains and reads nutrition from each recipe page", async () => {
    const fetch = jest.fn(async (url: string, _init?: { method?: string; headers?: Record<string, string>; body?: string }) => {
      if (url === "https://api.tavily.com/search") {
        const found = { results: [{ title: "Miso cod", url: "https://www.seriouseats.com/miso-cod", content: "Flaky cod…" }, { title: "No page", url: "https://www.bbcgoodfood.com/gone", content: null }] };
        return { ok: true, status: 200, json: async () => found, text: async (): Promise<string> => "" };
      }
      const ok = url === "https://www.seriouseats.com/miso-cod";
      return { ok, status: ok ? 200 : 404, url, json: async () => ({}), text: async (): Promise<string> => (ok ? page(recipe) : "") };
    });
    const hits = await new TavilyRecipeSearch({ apiKey: "tvly-k", fetch }).searchRecipes("high protein dinner", opts);

    const [, init] = fetch.mock.calls[0]!;
    expect(init?.method).toBe("POST");
    expect(init?.headers).toMatchObject({ authorization: "Bearer tvly-k" });
    expect(JSON.parse(init?.body ?? "{}")).toEqual({ query: "high protein dinner", search_depth: "basic", max_results: 20, include_domains: ["seriouseats.com", "bbcgoodfood.com"] });
    expect(hits[0]).toMatchObject({ title: "Miso-Glazed Cod", sourceName: "seriouseats.com", snippet: "Flaky cod…", minutes: 30, calories: 640, macros: { proteinG: 46, carbsG: 62, fatG: 18 } });
    expect(hits[1]).toEqual({ title: "No page", url: "https://www.bbcgoodfood.com/gone", sourceName: "bbcgoodfood.com", snippet: "" });
  });

  it("fails on a refused search", async () => {
    const fetch = jest.fn(async () => ({ ok: false, status: 401, json: async () => ({}), text: async (): Promise<string> => "" }));
    await expect(new TavilyRecipeSearch({ apiKey: "bad", fetch }).searchRecipes("q", opts)).rejects.toThrow("401");
  });
});

describe("readRecipeData", () => {
  it("finds the Recipe inside @graph, lists and typed arrays", () => {
    const expected = { title: "Miso-Glazed Cod", imageUrl: "https://img.example/cod.jpg", minutes: 30, calories: 640, macros: { proteinG: 46, carbsG: 62, fatG: 18 } };
    expect(readRecipeData(page({ "@graph": [{ "@type": "WebSite" }, recipe] }))).toEqual(expected);
    expect(readRecipeData(page([{ "@type": "BreadcrumbList" }, { ...recipe, "@type": ["Recipe", "NewsArticle"] }]))).toEqual(expected);
  });

  it("adds prep and cook time, reads numbers and image objects, and skips broken blocks", () => {
    const html =
      `<script type="application/ld+json">{ not json</script>` +
      page({ "@type": "Recipe", name: "Stew", prepTime: "PT15M", cookTime: "PT1H", image: { "@type": "ImageObject", url: "https://img.example/stew.jpg" }, nutrition: { calories: 410 } });
    expect(readRecipeData(html)).toEqual({ title: "Stew", imageUrl: "https://img.example/stew.jpg", minutes: 75, calories: 410 });
  });

  it("returns nothing for a page without recipe data", () => {
    expect(readRecipeData("<html><body>Hello</body></html>")).toEqual({});
    expect(readRecipeData(page({ "@type": "Article", name: "Not a recipe" }))).toEqual({});
  });
});

describe("createRecipeSearch", () => {
  it("prefers Tavily, then Brave, then Google, and is undefined without keys", () => {
    expect(createRecipeSearch({ tavilyApiKey: "t", braveSearchApiKey: "b" })).toBeInstanceOf(TavilyRecipeSearch);
    expect(createRecipeSearch({ braveSearchApiKey: "b", googleSearchApiKey: "g", googleSearchEngineId: "cx" })).toBeInstanceOf(BraveRecipeSearch);
    expect(createRecipeSearch({ googleSearchApiKey: "g", googleSearchEngineId: "cx" })).toBeInstanceOf(GoogleRecipeSearch);
    expect(createRecipeSearch({ googleSearchApiKey: "g" })).toBeUndefined();
  });
});
