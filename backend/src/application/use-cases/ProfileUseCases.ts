import { InvalidError, NotFoundError } from "../../domain/errors";
import { COGNITIVE_GOALS, DIETARY_PREFERENCES, type Profile } from "../../domain/types";
import type { IProfileRepository } from "../interfaces/IRepositories";

export class GetProfileUseCase {
  constructor(private readonly profiles: IProfileRepository) {}

  async execute(input: { userId: string }): Promise<Profile> {
    const profile = await this.profiles.get(input.userId);
    if (!profile) throw new NotFoundError("Set up your profile first.");
    return profile;
  }
}

export type ProfilePatch = Partial<Omit<Profile, "userId">>;

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
    const next = {
      timeZone: "UTC",
      cognitiveGoals: [],
      ...existing,
      ...input.patch,
      userId: input.userId,
    } as Profile;
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
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: profile.timeZone });
  } catch {
    throw new InvalidError(`"${profile.timeZone}" isn't a time zone. Use a name like America/Chicago.`);
  }
}
