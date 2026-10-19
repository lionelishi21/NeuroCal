import { describe, expect, it } from "@jest/globals";
import { FOODS } from "../../infrastructure/catalog/foods";
import { FakeMealPlanner, FixedClock, InMemoryMealPlans, InMemoryPantry, InMemoryProfiles, profile } from "../testing/fakes";
import { MealPlanUseCases } from "./MealPlanUseCases";

describe("MealPlanUseCases", () => {
  it("asks for one meal a day on OMAD, with the targets and pantry, and keeps the plan", async () => {
    const profiles = new InMemoryProfiles();
    await profiles.save(profile({ bioProfile: { fasting: "omad" } }));
    const pantry = new InMemoryPantry();
    await pantry.add("u1", ["Oats"]);
    const planner = new FakeMealPlanner();
    const plans = new InMemoryMealPlans();
    const useCase = new MealPlanUseCases(profiles, pantry, planner, plans, FOODS, new FixedClock(new Date("2026-10-16T12:00:00Z")));

    const plan = await useCase.create("u1", 3);
    expect(planner.calls[0]).toMatchObject({ days: 3, meals: ["dinner"], pantry: ["Oats"], calorieTarget: profile().dailyCalorieTarget });
    expect(plan.days.map((d) => d.meals.length)).toEqual([1, 1, 1]);
    expect(await useCase.latest("u1")).toBe(plan);
    await expect(useCase.create("u1", 0)).rejects.toThrow("Plan 1 to 3 days");
  });

  it("plans for health conditions: no fasting window when pregnant, and the food rules go to the planner", async () => {
    const profiles = new InMemoryProfiles();
    await profiles.save(profile({ bioProfile: { fasting: "omad", conditions: ["pregnant", "type2_diabetes"] } }));
    const planner = new FakeMealPlanner();
    const useCase = new MealPlanUseCases(profiles, new InMemoryPantry(), planner, new InMemoryMealPlans(), FOODS, new FixedClock(new Date("2026-10-16T12:00:00Z")));
    await useCase.create("u1", 1);
    const asked = planner.calls[0]!;
    expect(asked.meals.length).toBeGreaterThan(1);
    expect(asked.healthNotes?.join(" ")).toMatch(/high-mercury fish/);
    expect(asked.healthNotes?.join(" ")).toMatch(/glycemic load low/);
  });
});
