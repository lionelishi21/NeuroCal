import { conditionsOf, weightLossAllowed } from "../../domain/conditions";
import { InvalidError, NotFoundError } from "../../domain/errors";
import { COGNITIVE_GOALS, DIETARY_PREFERENCES, type Profile } from "../../domain/types";
import { MAX_KG, MIN_KG, PACES, type WeightGoal } from "../../domain/weight";
import type { IProfileRepository } from "../interfaces/IRepositories";

export class GetProfileUseCase {
  constructor(private readonly profiles: IProfileRepository) {}

  async execute(input: { userId: string }): Promise<Profile> {
    const profile = await this.profiles.get(input.userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    return profile;
  }
}

/** `weightGoal: null` removes the weight goal. */
export type ProfilePatch = Partial<Omit<Profile, "userId" | "weightGoal">> & { weightGoal?: WeightGoal | null };

const REQUIRED: (keyof ProfilePatch)[] = ["displayName", "dietaryPreference", "dailyCalorieTarget", "macroTargets"];

/** Creates the profile on first save (all required fields needed), then applies partial updates. */
export class UpdateProfileUseCase {
  constructor(private readonly profiles: IProfileRepository) {}

  async execute(input: { userId: string; patch: ProfilePatch }): Promise<Profile> {
    const existing = await this.profiles.get(input.userId);
    if (!existing) {
      const missing = REQUIRED.filter((key) => input.patch[key] === undefined);
      if (missing.length) throw new InvalidError(`To set up your profile, also send: ${missing.join(", ")}.`);
    }
    const { weightGoal, ...patch } = input.patch;
    const next = {
      timeZone: "UTC",
      cognitiveGoals: [],
      ...existing,
      ...patch,
      userId: input.userId,
    } as Profile;
    if (weightGoal === null) delete next.weightGoal;
    else if (weightGoal) next.weightGoal = weightGoal;
    // No weight-loss goal when pregnant or with an eating-disorder history: a new one is refused, and one
    // set before the condition was added is removed, so the plan stops aiming for a deficit.
    if (!weightLossAllowed(conditionsOf(next))) {
      if (weightGoal) {
        throw new InvalidError(
          "A weight-loss goal isn't part of the plan while pregnant or breastfeeding, or with an eating-disorder history. Your calories stay at maintenance; talk to your clinician about weight.",
        );
      }
      delete next.weightGoal;
    }
    assertValidProfile(next);
    await this.profiles.save(next);
    return next;
  }
}

function assertValidProfile(profile: Profile): void {
  if (!profile.displayName.trim()) throw new InvalidError("Add a display name.");
  if (!DIETARY_PREFERENCES.includes(profile.dietaryPreference)) throw new InvalidError("That dietary preference isn't supported.");
  if (profile.cognitiveGoals.some((g) => !COGNITIVE_GOALS.includes(g))) throw new InvalidError("One of those goals isn't supported.");
  if (!Number.isInteger(profile.dailyCalorieTarget) || profile.dailyCalorieTarget <= 0) {
    throw new InvalidError("The daily calorie target must be a whole number above zero.");
  }
  const { proteinG, carbsG, fatG } = profile.macroTargets;
  if ([proteinG, carbsG, fatG].some((n) => !Number.isFinite(n) || n < 0)) throw new InvalidError("Macro targets can't be negative.");
  const goal = profile.weightGoal;
  if (goal) {
    const inRange = (kg: number) => Number.isFinite(kg) && kg >= MIN_KG && kg <= MAX_KG;
    if (!inRange(goal.startKg) || !inRange(goal.targetKg)) throw new InvalidError(`Weights must be between ${MIN_KG} and ${MAX_KG} kg.`);
    if (goal.targetKg >= goal.startKg) throw new InvalidError("The target weight must be below the starting weight.");
    if (!(PACES as readonly number[]).includes(goal.pacePctPerWeek)) throw new InvalidError("Choose a pace of 0.5%, 0.75% or 1% a week.");
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: profile.timeZone });
  } catch {
    throw new InvalidError(`"${profile.timeZone}" isn't a time zone. Use a name like America/Chicago.`);
  }
}
