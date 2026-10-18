/**
 * How many AI calls one person can make in a day (UTC), so one account (or a script using a stolen
 * sign-in) can't run up the bill. Far above normal use: three meals and a label or two is about five
 * reads; a plan, a pantry idea and a recipe check is three generations.
 */
export const AI_ALLOWANCE = {
  /** Photo and label reading: meals, food packages, supplements (gpt-4o vision). */
  read: 60,
  /** Writing: pantry recipes, meal plans, the recipe calculator, the shopping review (Claude). */
  generate: 30,
} as const;

/**
 * Photo reads allowed before a subscription, so onboarding can show a meal being read before the trial
 * starts. More than one, so a blurry first photo can be tried again.
 */
export const FREE_READS = 3;

export type AiFeature = keyof typeof AI_ALLOWANCE;

export function limitMessage(feature: AiFeature): string {
  return feature === "read"
    ? `That's today's limit of ${AI_ALLOWANCE.read} photo and label reads. It resets tomorrow; you can still add food by hand.`
    : `That's today's limit of ${AI_ALLOWANCE.generate} plans and recipes. It resets tomorrow.`;
}
