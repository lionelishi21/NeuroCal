import type {
  CheckIn,
  LocalDay,
  Meal,
  NewCheckIn,
  NewMeal,
  NewRecipeRecommendation,
  Profile,
  RecipeRecommendation,
} from "../../domain/types";

/** Every method is scoped to one user; implementations must filter by userId (ARCHITECTURE §10). */

export interface IProfileRepository {
  get(userId: string): Promise<Profile | null>;
  save(profile: Profile): Promise<void>;
}

export interface IMealRepository {
  /** Non-deleted meals eaten on the local day, oldest first. */
  listForDay(userId: string, day: LocalDay): Promise<Meal[]>;
  get(userId: string, mealId: string): Promise<Meal | null>;
  create(userId: string, meal: NewMeal): Promise<Meal>;
  /** False when the meal doesn't exist or isn't this user's. */
  softDelete(userId: string, mealId: string): Promise<boolean>;
}

export interface ICheckInRepository {
  create(userId: string, checkIn: NewCheckIn): Promise<CheckIn>;
  latestForDay(userId: string, day: LocalDay): Promise<CheckIn | null>;
}

export interface IRecommendationRepository {
  saveRecipes(userId: string, recipes: NewRecipeRecommendation[]): Promise<RecipeRecommendation[]>;
}
