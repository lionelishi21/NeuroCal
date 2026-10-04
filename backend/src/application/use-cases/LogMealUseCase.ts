import { assertValidMeal } from "../../domain/meal";
import type { Meal, NewMeal } from "../../domain/types";
import type { IClock } from "../interfaces/IClock";
import type { IMealRepository } from "../interfaces/IRepositories";

/** Save a meal the user confirmed (ARCHITECTURE §6.2). */
export class LogMealUseCase {
  constructor(
    private readonly meals: IMealRepository,
    private readonly clock: IClock,
  ) {}

  async execute(input: { userId: string; meal: NewMeal }): Promise<Meal> {
    assertValidMeal(input.meal, this.clock.now());
    return this.meals.create(input.userId, input.meal);
  }
}
