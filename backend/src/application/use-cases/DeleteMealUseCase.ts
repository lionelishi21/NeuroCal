import { NotFoundError } from "../../domain/errors";
import type { IMealRepository } from "../interfaces/IRepositories";

/** Soft-delete, scoped to the user (ARCHITECTURE §6.3). */
export class DeleteMealUseCase {
  constructor(private readonly meals: IMealRepository) {}

  async execute(input: { userId: string; mealId: string }): Promise<void> {
    const deleted = await this.meals.softDelete(input.userId, input.mealId);
    if (!deleted) throw new NotFoundError("That meal no longer exists.");
  }
}
