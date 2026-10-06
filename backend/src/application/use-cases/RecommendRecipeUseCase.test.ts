import { beforeEach, describe, expect, it } from "@jest/globals";
import { UpstreamError } from "../../domain/errors";
import type { RecipeSearchHit } from "../interfaces/ISearchEngineAdapter";
import {
  FakeReasoning,
  FakeSearch,
  FixedClock,
  InMemoryCheckIns,
  InMemoryMeals,
  InMemoryProfiles,
  InMemoryRecommendations,
  item,
  profile,
} from "../testing/fakes";
import { GetBioStateUseCase } from "./GetBioStateUseCase";
import { RecommendRecipeUseCase } from "./RecommendRecipeUseCase";

const query = { searchQuery: "pescatarian high protein omega-3 dinner", contextualReasoning: "Cod brings steady protein." };
const hit = (overrides: Partial<RecipeSearchHit>): RecipeSearchHit => ({
  title: "Recipe",
  url: "https://www.seriouseats.com/recipe",
  sourceName: "Serious Eats",
  snippet: "",
  minutes: 30,
  calories: 600,
  macros: { proteinG: 40, carbsG: 50, fatG: 20 },
  ...overrides,
});

describe("RecommendRecipeUseCase", () => {
  let profiles: InMemoryProfiles;
  let meals: InMemoryMeals;
  let checkIns: InMemoryCheckIns;
  let saved: InMemoryRecommendations;

  beforeEach(async () => {
    profiles = new InMemoryProfiles();
    meals = new InMemoryMeals();
    checkIns = new InMemoryCheckIns();
    saved = new InMemoryRecommendations();
    await profiles.save(profile());
    await meals.create("u1", { kind: "lunch", eatenAt: new Date("2026-09-29T17:00:00Z"), items: [item("Poke", 1050, 47, 135, 36)] });
    await checkIns.create("u1", { at: new Date("2026-09-29T19:00:00Z"), flags: ["low_focus"] });
  });

  function build(reasoning: FakeReasoning, search: FakeSearch) {
    const clock = new FixedClock(new Date("2026-09-29T22:00:00Z"));
    const bioState = new GetBioStateUseCase(profiles, meals, checkIns, clock);
    return new RecommendRecipeUseCase(profiles, bioState, reasoning, search, saved, {
      allowedDomains: ["seriouseats.com", "bbcgoodfood.com"],
    });
  }

  it("asks Claude with today's bio-state, then ranks and saves recipes", async () => {
    const reasoning = new FakeReasoning(query);
    const search = new FakeSearch([
      hit({ title: "Low protein", url: "https://www.seriouseats.com/a", macros: { proteinG: 10, carbsG: 80, fatG: 20 } }),
      hit({ title: "High protein", url: "https://www.bbcgoodfood.com/b", macros: { proteinG: 50, carbsG: 40, fatG: 15 } }),
      hit({ title: "Too big", url: "https://www.seriouseats.com/c", calories: 1500 }),
      hit({ title: "Off-list site", url: "https://random-blog.example/d" }),
      hit({ title: "No nutrition", url: "https://www.seriouseats.com/e", calories: undefined }),
    ]);

    const result = await build(reasoning, search).execute({ userId: "u1" });

    expect(reasoning.calls[0]).toEqual({
      caloriesRemaining: 1150,
      macroFocus: "protein",
      cognitiveFlags: ["low_focus"],
      dietaryPreference: "pescatarian",
    });
    expect(search.calls[0]).toMatchObject({ query: query.searchQuery, allowedDomains: ["seriouseats.com", "bbcgoodfood.com"] });
    expect(result.recipes.map((r) => r.title)).toEqual(["High protein", "Low protein"]);
    expect(result.recipes[0]).toMatchObject({ reasoning: query.contextualReasoning, id: expect.any(String) });
    expect(saved.rows).toHaveLength(2);
  });

  it("serves the same suggestions again until the day's inputs change", async () => {
    const reasoning = new FakeReasoning(query);
    const search = new FakeSearch([hit({ title: "Cod", url: "https://www.seriouseats.com/cod" }), hit({ title: "Lentils", url: "https://www.bbcgoodfood.com/lentils", macros: { proteinG: 20, carbsG: 60, fatG: 10 } })]);
    const useCase = build(reasoning, search);

    const first = await useCase.execute({ userId: "u1" });
    const again = await useCase.execute({ userId: "u1" });
    expect(again).toEqual(first);
    expect(reasoning.calls).toHaveLength(1);
    expect(search.calls).toHaveLength(1);
    expect(saved.rows).toHaveLength(2);

    // A snack changes the calories left, so the next request searches afresh.
    await meals.create("u1", { kind: "snack", eatenAt: new Date("2026-09-29T20:00:00Z"), items: [item("Apple", 95, 0, 25, 0)] });
    await useCase.execute({ userId: "u1" });
    expect(reasoning.calls).toHaveLength(2);
    expect(reasoning.calls[1]!.caloriesRemaining).toBe(1055);

    // So does a check-in.
    await checkIns.create("u1", { at: new Date("2026-09-29T21:00:00Z"), flags: ["stressed"] });
    await useCase.execute({ userId: "u1" });
    expect(reasoning.calls).toHaveLength(3);
  });

  it("tells Claude what the onboarding answers ask of the meal", async () => {
    await profiles.save(profile({ bioProfile: { friction: "afternoon_crash", fasting: "16_8", movement: "none", moldSensitive: true } }));
    const reasoning = new FakeReasoning(query);

    await build(reasoning, new FakeSearch([])).execute({ userId: "u1" });

    expect(reasoning.calls[0]!.habits).toEqual([
      "Often crashes mid-afternoon: prefer protein, fat and slow carbs over sugar and refined starch.",
      "Eats within an eight-hour window: the meal should be filling.",
    ]);
  });

  it("returns an empty list when nothing usable comes back", async () => {
    const result = await build(new FakeReasoning(query), new FakeSearch([])).execute({ userId: "u1" });
    expect(result).toEqual({ searchQuery: query.searchQuery, recipes: [] });
    expect(saved.rows).toHaveLength(0);
  });

  it("reports a failed model or search call as an upstream error", async () => {
    await expect(build(new FakeReasoning(new Error("429")), new FakeSearch([])).execute({ userId: "u1" })).rejects.toBeInstanceOf(
      UpstreamError,
    );
    await expect(build(new FakeReasoning(query), new FakeSearch(new Error("quota"))).execute({ userId: "u1" })).rejects.toBeInstanceOf(
      UpstreamError,
    );
  });
});
