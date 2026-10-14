import type { ExerciseKind, Intensity } from "../../domain/exercise";

export interface NewExercise {
  kind: ExerciseKind;
  intensity: Intensity;
  minutes: number;
  startedAt: Date;
  kcal: number;
}

export interface Exercise extends NewExercise {
  id: string;
}

/** Scoped to one user (ARCHITECTURE §10). */
export interface IExerciseRepository {
  add(userId: string, exercise: NewExercise): Promise<Exercise>;
  /** Started at or after `from` and before `to`, earliest first. */
  listBetween(userId: string, from: Date, to: Date): Promise<Exercise[]>;
  /** False when there was no such exercise for this user. */
  delete(userId: string, id: string): Promise<boolean>;
}
