import { beforeEach, describe, expect, it } from "@jest/globals";
import { InvalidError, NotFoundError, UpstreamError } from "../../domain/errors";
import { FakeVision, FixedClock, InMemoryMeals, item } from "../testing/fakes";
import { AnalyzeMealPhotoUseCase, MAX_PHOTO_BYTES } from "./AnalyzeMealPhotoUseCase";
import { DeleteMealUseCase } from "./DeleteMealUseCase";
import { LogMealUseCase } from "./LogMealUseCase";

const now = new Date("2026-09-29T17:00:00Z");
const photo = { bytes: new Uint8Array([1, 2, 3]), mediaType: "image/jpeg" };

describe("AnalyzeMealPhotoUseCase", () => {
  it("returns the proposed items without saving anything", async () => {
    const vision = new FakeVision({ items: [{ ...item("Quinoa", 166, 6, 29, 2.7), confidence: 0.8 }] });
    const result = await new AnalyzeMealPhotoUseCase(vision).execute(photo);
    expect(result.items).toHaveLength(1);
    expect(vision.calls).toHaveLength(1);
  });

  it("passes an unreadable photo through as a normal result", async () => {
    const result = await new AnalyzeMealPhotoUseCase(new FakeVision({ items: [], problem: "too_dark" })).execute(photo);
    expect(result.problem).toBe("too_dark");
  });

  it("rejects non-images and oversized photos before calling the model", async () => {
    const vision = new FakeVision({ items: [] });
    const useCase = new AnalyzeMealPhotoUseCase(vision);
    await expect(useCase.execute({ ...photo, mediaType: "application/pdf" })).rejects.toBeInstanceOf(InvalidError);
    await expect(useCase.execute({ ...photo, bytes: new Uint8Array(MAX_PHOTO_BYTES + 1) })).rejects.toBeInstanceOf(
      InvalidError,
    );
    expect(vision.calls).toHaveLength(0);
  });

  it("turns a provider failure into an upstream error", async () => {
    const useCase = new AnalyzeMealPhotoUseCase(new FakeVision(new Error("timeout")));
    await expect(useCase.execute(photo)).rejects.toBeInstanceOf(UpstreamError);
  });
});

describe("LogMealUseCase", () => {
  let meals: InMemoryMeals;
  let useCase: LogMealUseCase;
  beforeEach(() => {
    meals = new InMemoryMeals();
    useCase = new LogMealUseCase(meals, new FixedClock(now));
  });

  it("saves a valid meal for the user", async () => {
    const meal = await useCase.execute({
      userId: "u1",
      meal: { kind: "lunch", eatenAt: now, items: [item("Salmon", 400, 40, 0, 25)] },
    });
    expect(meal).toMatchObject({ userId: "u1", kind: "lunch" });
    expect(meals.rows).toHaveLength(1);
  });

  it.each([
    ["no items", { kind: "lunch" as const, eatenAt: now, items: [] }],
    ["a future time", { kind: "lunch" as const, eatenAt: new Date(now.getTime() + 60 * 60_000), items: [item("Tea", 2, 0, 0, 0)] }],
    ["negative calories", { kind: "snack" as const, eatenAt: now, items: [item("Mystery", -10, 0, 0, 0)] }],
  ])("rejects a meal with %s", async (_, meal) => {
    await expect(useCase.execute({ userId: "u1", meal })).rejects.toBeInstanceOf(InvalidError);
    expect(meals.rows).toHaveLength(0);
  });
});

describe("DeleteMealUseCase", () => {
  it("deletes the user's own meal", async () => {
    const meals = new InMemoryMeals();
    const meal = await meals.create("u1", { kind: "snack", eatenAt: now, items: [item("Apple", 95, 0.5, 25, 0.3)] });
    await new DeleteMealUseCase(meals).execute({ userId: "u1", mealId: meal.id });
    expect(await meals.get("u1", meal.id)).toBeNull();
  });

  it("treats another user's meal as not found", async () => {
    const meals = new InMemoryMeals();
    const meal = await meals.create("u2", { kind: "snack", eatenAt: now, items: [item("Apple", 95, 0.5, 25, 0.3)] });
    await expect(new DeleteMealUseCase(meals).execute({ userId: "u1", mealId: meal.id })).rejects.toBeInstanceOf(
      NotFoundError,
    );
    expect(await meals.get("u2", meal.id)).not.toBeNull();
  });
});
