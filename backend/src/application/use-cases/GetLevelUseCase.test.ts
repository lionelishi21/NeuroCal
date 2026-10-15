import { describe, expect, it } from "@jest/globals";
import {
  FixedClock,
  InMemoryBrainChecks,
  InMemoryCheckIns,
  InMemoryExercises,
  InMemoryMeals,
  InMemoryProfiles,
  InMemoryTelemetry,
  item,
  profile,
} from "../testing/fakes";
import { GetLevelUseCase } from "./GetLevelUseCase";

const clock = new FixedClock(new Date("2026-09-29T15:00:00Z")); // 10:00 on the 29th in Chicago

describe("GetLevelUseCase", () => {
  it("reaches Aware after two weeks of food and sleep, and says what Fuelled needs", async () => {
    const profiles = new InMemoryProfiles();
    await profiles.save(profile());
    const meals = new InMemoryMeals();
    const telemetry = new InMemoryTelemetry();
    const useCase = new GetLevelUseCase(profiles, meals, new InMemoryCheckIns(), telemetry, new InMemoryExercises(), new InMemoryBrainChecks(), clock);
    expect((await useCase.execute({ userId: "u1" })).level).toBe(0);

    for (let i = 1; i <= 15; i++) {
      const noon = new Date(Date.UTC(2026, 8, 29 - i, 17)); // 12:00 in Chicago
      await meals.create("u1", { kind: "lunch", eatenAt: noon, items: [{ ...item("Packaged pasta", 700, 20, 100, 20), processing: "ultra_processed" }] });
      // 23:00–07:00 Chicago, ending on the next day.
      await telemetry.upsertSleep("u1", [{ start: new Date(noon.getTime() + 11 * 3_600_000), end: new Date(noon.getTime() + 19 * 3_600_000), source: "manual" }]);
    }

    const result = await useCase.execute({ userId: "u1" });
    expect(result).toMatchObject({ level: 1, name: "Aware" });
    expect(result.requirements.find((r) => r.title === "Keep ultra-processed food under 20%")).toMatchObject({
      met: false,
      progress: "100% of graded calories were ultra-processed",
    });
  });
});
