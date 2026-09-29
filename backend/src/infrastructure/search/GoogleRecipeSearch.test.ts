import { describe, expect, it, jest } from "@jest/globals";
import { GoogleRecipeSearch, isoMinutes } from "./GoogleRecipeSearch";

const fixture = {
  items: [
    {
      title: "Miso-Glazed Cod Recipe | Serious Eats",
      link: "https://www.seriouseats.com/miso-cod",
      displayLink: "www.seriouseats.com",
      snippet: "Flaky cod…",
      pagemap: {
        recipe: [{ name: "Miso-Glazed Cod", totaltime: "PT30M" }],
        nutritioninformation: [{ calories: "640 kcal", proteincontent: "46 g", carbohydratecontent: "62 g", fatcontent: "18 g" }],
        cse_image: [{ src: "https://img.example/cod.jpg" }],
        metatags: [{ "og:site_name": "Serious Eats" }],
      },
    },
    { title: "Lentil skillet", link: "https://www.bbcgoodfood.com/lentils", displayLink: "www.bbcgoodfood.com" },
  ],
};

function withFetch(body: unknown, ok = true) {
  const fetch = jest.fn(async (_url: string) => ({ ok, status: ok ? 200 : 429, json: async () => body }));
  return { fetch, search: new GoogleRecipeSearch({ apiKey: "k", engineId: "cx", fetch }) };
}

describe("GoogleRecipeSearch", () => {
  it("restricts the query to allowed sites and reads schema.org recipe data", async () => {
    const { fetch, search } = withFetch(fixture);
    const hits = await search.searchRecipes("high protein dinner", { allowedDomains: ["seriouseats.com", "bbcgoodfood.com"], limit: 10 });

    const url = new URL(fetch.mock.calls[0]![0]);
    expect(url.searchParams.get("q")).toBe("high protein dinner (site:seriouseats.com OR site:bbcgoodfood.com)");
    expect(url.searchParams.get("num")).toBe("10");
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
    // No structured data: returned without nutrition, and the use case filters it out.
    expect(hits[1]).toEqual({ title: "Lentil skillet", url: "https://www.bbcgoodfood.com/lentils", sourceName: "bbcgoodfood.com", snippet: "" });
  });

  it("handles no results and failed calls", async () => {
    await expect(withFetch({}).search.searchRecipes("q", { allowedDomains: [], limit: 5 })).resolves.toEqual([]);
    await expect(withFetch({}, false).search.searchRecipes("q", { allowedDomains: [], limit: 5 })).rejects.toThrow("429");
  });
});

describe("isoMinutes", () => {
  it.each([
    ["PT30M", 30],
    ["PT1H30M", 90],
    ["P1DT2H", 1560],
    ["30 minutes", undefined],
    ["PT0M", undefined],
  ])("%s → %s", (input, expected) => {
    expect(isoMinutes(input)).toBe(expected);
  });
});
