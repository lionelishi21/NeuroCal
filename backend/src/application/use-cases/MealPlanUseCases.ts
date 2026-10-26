import { withHealthNotes } from "../../domain/conditions";
import { DomainError, InvalidError, NotFoundError, UpstreamError } from "../../domain/errors";
import { fastingProtocolOf } from "../../domain/fasting";
import type { Food } from "../../domain/foods";
import { MAX_PLAN_DAYS, type MealPlan, buildMealPlan, mealSlotsFor, replaceMeal } from "../../domain/mealPlan";
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

  /**
   * Swaps one meal of the latest plan for a different one of the same kind and about the same calories
   * and macros; [day] counts from 1, [meal] from 0.
   */
  async swap(userId: string, day: number, meal: number): Promise<MealPlan> {
    const [profile, plan] = await Promise.all([this.profiles.get(userId), this.plans.latest(userId)]);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    if (!plan) throw new NotFoundError("Make a plan first.");
    const old = plan.days[day - 1]?.meals[meal];
    if (!old) throw new NotFoundError("That meal isn't in your plan.");
    const pantry = (await this.pantry.list(userId)).map((i) => i.name);
    // This meal's share of the day: the replacement aims for the same.
    const share = plan.targets.calories > 0 ? old.calories / plan.targets.calories : 1 / 3;
    const m = profile.macroTargets;
    let planned;
    try {
      planned = await this.planner.plan({
        days: 1,
        meals: [old.kind],
        calorieTarget: old.calories,
        macroTargets: { proteinG: Math.round(m.proteinG * share), carbsG: Math.round(m.carbsG * share), fatG: Math.round(m.fatG * share) },
        dietaryPreference: profile.dietaryPreference,
        cognitiveGoals: profile.cognitiveGoals,
        pantry,
        catalog: this.foods.map((f) => ({ id: f.id, name: f.name, serving: f.serving })),
        avoid: plan.days.flatMap((d) => d.meals.map((x) => x.title)),
        ...withHealthNotes(profile),
      });
    } catch (error) {
      if (error instanceof DomainError) throw error;
      console.error(JSON.stringify({ event: "meal_swap_failed", error: String(error).slice(0, 300) }));
      throw new UpstreamError("A new meal couldn't be found right now. Try again in a moment.");
    }
    const fresh = planned[0]?.[0];
    if (!fresh) throw new UpstreamError("A new meal couldn't be found right now. Try again in a moment.");
    const built = buildMealPlan([[{ ...fresh, kind: old.kind }]], { catalog: this.foods, pantry, targets: plan.targets, createdAt: plan.createdAt });
    const next = replaceMeal(plan, day - 1, meal, built.days[0]!.meals[0]!);
    await this.plans.save(userId, next);
    return next;
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
        ...withHealthNotes(profile),
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
