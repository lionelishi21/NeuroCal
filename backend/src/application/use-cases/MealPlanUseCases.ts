import { DomainError, InvalidError, NotFoundError, UpstreamError } from "../../domain/errors";
import { fastingProtocolOf } from "../../domain/fasting";
import type { Food } from "../../domain/foods";
import { MAX_PLAN_DAYS, type MealPlan, buildMealPlan, mealSlotsFor } from "../../domain/mealPlan";
import type { IClock } from "../interfaces/IClock";
import type { IMealPlanRepository, IMealPlanner } from "../interfaces/IMealPlans";
import type { IPantryRepository } from "../interfaces/IPantry";
import type { IProfileRepository } from "../interfaces/IRepositories";

/** Plans a few days of meals for the targets, pantry and fasting plan, and keeps the latest. */
export class MealPlanUseCases {
  constructor(
    private readonly profiles: IProfileRepository,
    private readonly pantry: IPantryRepository,
    private readonly planner: IMealPlanner,
    private readonly plans: IMealPlanRepository,
    private readonly foods: readonly Food[],
    private readonly clock: IClock,
  ) {}

  latest(userId: string): Promise<MealPlan | null> {
    return this.plans.latest(userId);
  }

  async create(userId: string, days: number): Promise<MealPlan> {
    if (!Number.isInteger(days) || days < 1 || days > MAX_PLAN_DAYS) throw new InvalidError(`Plan 1 to ${MAX_PLAN_DAYS} days.`);
    const profile = await this.profiles.get(userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    const pantry = (await this.pantry.list(userId)).map((i) => i.name);
    const meals = mealSlotsFor(fastingProtocolOf(profile));
    let planned;
    try {
      planned = await this.planner.plan({
        days,
        meals,
        calorieTarget: profile.dailyCalorieTarget,
        macroTargets: profile.macroTargets,
        dietaryPreference: profile.dietaryPreference,
        cognitiveGoals: profile.cognitiveGoals,
        pantry,
        catalog: this.foods.map((f) => ({ id: f.id, name: f.name, serving: f.serving })),
      });
    } catch (error) {
      if (error instanceof DomainError) throw error;
      console.error(JSON.stringify({ event: "meal_plan_failed", error: String(error).slice(0, 300) }));
      throw new UpstreamError("A plan couldn't be made right now. Try again in a moment.");
    }
    const plan = buildMealPlan(planned.slice(0, days), {
      catalog: this.foods,
      pantry,
      targets: { calories: profile.dailyCalorieTarget, macros: profile.macroTargets },
      createdAt: this.clock.now(),
    });
    await this.plans.save(userId, plan);
    return plan;
  }
}
