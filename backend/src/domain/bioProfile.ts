import type { BioProfileAnswers } from "./types";

/** The onboarding "friction point": what it is called when searching the catalog, and what it asks of a meal. */
const FRICTION: Record<string, { need: string; meal: string }> = {
  afternoon_crash: {
    need: "afternoon energy crashes",
    meal: "Often crashes mid-afternoon: prefer protein, fat and slow carbs over sugar and refined starch.",
  },
  night_waking: {
    need: "waking in the night",
    meal: "Often wakes in the night: keep an evening meal light and easy to digest.",
  },
  post_meal_fog: {
    need: "brain fog after meals",
    meal: "Gets brain fog after meals: prefer a low-glycemic meal of moderate size.",
  },
  slow_recovery: {
    need: "slow physical recovery",
    meal: "Recovers slowly from training: make the meal rich in protein.",
  },
};

const FASTING: Record<string, string> = {
  "16_8": "Eats within an eight-hour window: the meal should be filling.",
  omad: "Eats one meal a day: it should be a large, complete meal.",
};

const MOVEMENT: Record<string, string> = {
  heavy_lifting: "Lifts heavy weights: protein matters.",
  rehit: "Trains with short all-out sprints: protein matters.",
  chronic_cardio: "Does long cardio sessions most days: include slow carbs unless the diet rules them out.",
};

const text = (value: unknown): string => (typeof value === "string" ? value : "");

/** The friction point as a catalog search phrase, e.g. "afternoon energy crashes". */
export function frictionNeed(answers: BioProfileAnswers | undefined): string | undefined {
  return FRICTION[text(answers?.friction)]?.need;
}

/**
 * What the onboarding answers ask of the next meal, as plain sentences for the
 * recipe prompt. Only fixed sentences leave here, never the stored answers themselves.
 */
export function mealHabits(answers: BioProfileAnswers | undefined): string[] {
  if (!answers) return [];
  return [FRICTION[text(answers.friction)]?.meal, FASTING[text(answers.fasting)], MOVEMENT[text(answers.movement)]].filter(
    (line): line is string => line !== undefined,
  );
}
