import { beforeEach, describe, expect, it } from "@jest/globals";
import { InvalidError, NotFoundError } from "../../domain/errors";
import { FixedClock, InMemoryCheckIns, InMemoryMeals, InMemoryProfiles, item, profile } from "../testing/fakes";
import { GetBioStateUseCase } from "./GetBioStateUseCase";
import { RecordCheckInUseCase } from "./RecordCheckInUseCase";

describe("RecordCheckInUseCase", () => {
  const useCase = new RecordCheckInUseCase(new InMemoryCheckIns());
  const at = new Date("2026-09-29T19:00:00Z");

  it("saves flags once each", async () => {
    const saved = await useCase.execute({ userId: "u1", checkIn: { at, flags: ["low_focus", "low_focus", "wired"] } });
    expect(saved.flags).toEqual(["low_focus", "wired"]);
  });

  it("needs at least one flag and a short note", async () => {
    await expect(useCase.execute({ userId: "u1", checkIn: { at, flags: [] } })).rejects.toBeInstanceOf(InvalidError);
    await expect(
      useCase.execute({ userId: "u1", checkIn: { at, flags: ["calm"], note: "x".repeat(281) } }),
    ).rejects.toBeInstanceOf(InvalidError);
  });
});

describe("GetBioStateUseCase", () => {
  let profiles: InMemoryProfiles;
  let meals: InMemoryMeals;
  let checkIns: InMemoryCheckIns;
  // 21:30 on 29 Sep in Chicago, already 30 Sep in UTC.
  const clock = new FixedClock(new Date("2026-09-30T02:30:00Z"));
  let useCase: GetBioStateUseCase;

  beforeEach(async () => {
    profiles = new InMemoryProfiles();
    meals = new InMemoryMeals();
    checkIns = new InMemoryCheckIns();
    useCase = new GetBioStateUseCase(profiles, meals, checkIns, clock);
    await profiles.save(profile());
    await meals.create("u1", { kind: "breakfast", eatenAt: new Date("2026-09-29T13:10:00Z"), items: [item("Oats", 440, 12.8, 67, 15)] });
    await meals.create("u1", { kind: "dinner", eatenAt: new Date("2026-09-30T01:00:00Z"), items: [item("Cod", 640, 46, 62, 18)] });
    await meals.create("u1", { kind: "lunch", eatenAt: new Date("2026-09-28T17:00:00Z"), items: [item("Yesterday", 900, 30, 90, 30)] });
    await meals.create("u2", { kind: "lunch", eatenAt: new Date("2026-09-29T17:00:00Z"), items: [item("Not mine", 700, 30, 70, 30)] });
    await checkIns.create("u1", { at: new Date("2026-09-29T15:00:00Z"), flags: ["brain_fog"] });
    await checkIns.create("u1", { at: new Date("2026-09-29T20:00:00Z"), flags: ["low_focus", "low_energy"] });
  });

  it("uses today in the user's time zone by default", async () => {
    const state = await useCase.execute({ userId: "u1" });
    expect(state.date).toBe("2026-09-29");
    expect(state.caloriesEaten).toBe(1080);
    expect(state.cognitiveFlags).toEqual(["low_focus", "low_energy"]);
  });

  it("reads a requested day", async () => {
    const state = await useCase.execute({ userId: "u1", date: "2026-09-28" });
    expect(state.caloriesEaten).toBe(900);
    expect(state.cognitiveFlags).toEqual([]);
  });

  it("rejects a malformed date and a missing profile", async () => {
    await expect(useCase.execute({ userId: "u1", date: "yesterday" })).rejects.toBeInstanceOf(InvalidError);
    await expect(useCase.execute({ userId: "nobody" })).rejects.toBeInstanceOf(NotFoundError);
  });
});
