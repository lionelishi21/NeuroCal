/** Kinds of exercise someone can log, and how hard it felt. */
export const EXERCISE_KINDS = ["walk", "run", "cycle", "strength", "hiit", "yoga", "swim", "sport", "other"] as const;
export type ExerciseKind = (typeof EXERCISE_KINDS)[number];
export const INTENSITIES = ["light", "moderate", "hard"] as const;
export type Intensity = (typeof INTENSITIES)[number];

export const MAX_EXERCISE_MINUTES = 600;

/** Used when there is no weigh-in yet: close to the adult average, and said so in the response. */
export const DEFAULT_WEIGHT_KG = 70;

/**
 * Metabolic equivalents (1 MET = resting) by kind and intensity, from the Compendium of Physical
 * Activities (Ainsworth et al., 2011 update): e.g. walking 3.0 mph ≈ 3.5, running 6 mph ≈ 9.8.
 */
const METS: Record<ExerciseKind, Record<Intensity, number>> = {
  walk: { light: 2.8, moderate: 3.5, hard: 5.0 },
  run: { light: 7.0, moderate: 9.8, hard: 11.5 },
  cycle: { light: 4.0, moderate: 6.8, hard: 10.0 },
  strength: { light: 3.5, moderate: 5.0, hard: 6.0 },
  hiit: { light: 6.0, moderate: 8.0, hard: 10.0 },
  yoga: { light: 2.5, moderate: 3.0, hard: 4.0 },
  swim: { light: 5.8, moderate: 7.0, hard: 9.8 },
  sport: { light: 4.5, moderate: 6.5, hard: 8.0 },
  other: { light: 3.0, moderate: 4.5, hard: 6.5 },
};

/**
 * Calories burned by the exercise itself: MET × kg × hours, less the 1 MET a body burns at rest anyway,
 * so a day's total doesn't count resting energy twice. Whole kcal.
 */
export function exerciseKcal(kind: ExerciseKind, intensity: Intensity, minutes: number, weightKg: number): number {
  const met = METS[kind][intensity];
  return Math.max(0, Math.round((met - 1) * weightKg * (minutes / 60)));
}
