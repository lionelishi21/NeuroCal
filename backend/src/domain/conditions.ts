/**
 * Health conditions people tell us about in onboarding, and what each changes. NeuroCal never treats a
 * condition or advises on medicines: a condition only makes the plan safer (no long fasts on insulin, no
 * cold plunges with a heart condition) and points suggestions at what suits it. Wherever a condition
 * changes advice, the app says to check with a clinician.
 */
export const HEALTH_CONDITIONS = [
  "type1_diabetes",
  "type2_diabetes",
  /** Insulin, sulfonylureas or other medicines that can push blood sugar too low. */
  "glucose_lowering_meds",
  /** Narcolepsy, sleep apnoea, insomnia. */
  "sleep_disorder",
  "joint_pain",
  /** Chronic fatigue or brain fog. */
  "brain_fog",
  "heart_condition",
  "mitochondrial",
  /** Pregnant or breastfeeding. */
  "pregnant",
  "eating_disorder_history",
  /** Warfarin, apixaban and other anticoagulants. */
  "blood_thinners",
] as const;

export type HealthCondition = (typeof HEALTH_CONDITIONS)[number];

export function conditionsOf(profile: { healthConditions?: readonly string[] | null }): HealthCondition[] {
  const listed = profile.healthConditions ?? [];
  return HEALTH_CONDITIONS.filter((c) => listed.includes(c));
}

const has = (conditions: readonly HealthCondition[], ...any: HealthCondition[]) => any.some((c) => conditions.includes(c));

/**
 * The longest fasting protocol that's safe: none at all when pregnant or with an eating-disorder
 * history, 12:12 at most with type 1 diabetes or blood-sugar-lowering medicines; null when there's no
 * limit.
 */
export function fastingLimit(conditions: readonly HealthCondition[]): "none" | "12_12" | null {
  if (has(conditions, "pregnant", "eating_disorder_history")) return "none";
  if (has(conditions, "type1_diabetes", "glucose_lowering_meds")) return "12_12";
  return null;
}

/** No weight-loss goal or calorie deficit when pregnant or with an eating-disorder history. */
export function weightLossAllowed(conditions: readonly HealthCondition[]): boolean {
  return !has(conditions, "pregnant", "eating_disorder_history");
}

/** Words in a routine or product that make it unsuitable, per condition. */
const AVOID: Partial<Record<HealthCondition, RegExp>> = {
  heart_condition: /\b(cold (plunge|shower|exposure|water|therapy)|ice bath|cryo\w*|sauna|sprints?|rehit|hiit|all-out)\b/i,
  pregnant: /\b(fast(ing|s)?|omad|cold (plunge|exposure|therapy)|ice bath|sauna|ketones?|ketone esters?|ashwagandha|weight loss)\b/i,
  eating_disorder_history: /\b(fast(ing|s)?|omad|weight loss|calorie deficit|appetite)\b/i,
  type1_diabetes: /\b(fast(ing|s)?|omad|extended fast)\b/i,
  glucose_lowering_meds: /\b(fast(ing|s)?|omad|extended fast|berberine)\b/i,
  joint_pain: /\b(sprints?|rehit|hiit|jump\w*|plyometric\w*|running)\b/i,
  blood_thinners: /\b(fish oil|omega-?3|krill|vitamin k|ginkgo|vitamin e|turmeric|curcumin|nattokinase)\b/i,
};

/** Words that make something a good fit, per condition: these are put first. */
const GOOD_FOR: Partial<Record<HealthCondition, RegExp>> = {
  type1_diabetes: /\b(blood sugar|glucose|glycemic|low-carb|fibre|fiber|protein)\b/i,
  type2_diabetes: /\b(blood sugar|glucose|glycemic|low-carb|fibre|fiber|protein|walk\w*)\b/i,
  brain_fog: /\b(brain fog|focus|blood sugar|glycemic|sleep|hydration)\b/i,
  sleep_disorder: /\b(sleep|bedtime|circadian|morning light|nap\w*)\b/i,
  joint_pain: /\b(mobility|recovery|swim\w*|cycl\w*|walk\w*|calf)\b/i,
  mitochondrial: /\b(energy|mitochondri\w*|coq10|creatine|red light|zone 2)\b/i,
};

const textOf = (item: { title?: string; name?: string; summary?: string; description?: string; tags?: readonly string[] }) =>
  [item.title, item.name, item.summary, item.description, ...(item.tags ?? [])].filter(Boolean).join(" ");

/** Whether a routine or product is unsuitable for any of these conditions. */
export function unsuitable(item: Parameters<typeof textOf>[0], conditions: readonly HealthCondition[]): boolean {
  const text = textOf(item);
  return conditions.some((c) => AVOID[c]?.test(text) ?? false);
}

/** Whether a routine or product suits one of these conditions, so it goes first. */
export function suits(item: Parameters<typeof textOf>[0], conditions: readonly HealthCondition[]): boolean {
  const text = textOf(item);
  return conditions.some((c) => GOOD_FOR[c]?.test(text) ?? false);
}

/** A supplement ingredient that interacts with these conditions' medicines, with the reason; null if none. */
export function interactionOf(ingredient: string, conditions: readonly HealthCondition[]): string | null {
  if (has(conditions, "blood_thinners") && AVOID.blood_thinners!.test(ingredient)) {
    return `${ingredient} can add to the effect of blood thinners. Check with your clinician before taking it.`;
  }
  if (has(conditions, "glucose_lowering_meds", "type1_diabetes") && /\b(berberine|chromium|cinnamon extract|alpha-lipoic|bitter melon)\b/i.test(ingredient)) {
    return `${ingredient} can lower blood sugar alongside diabetes medicines. Check with your clinician before taking it.`;
  }
  if (has(conditions, "pregnant") && /\b(ashwagandha|vitamin a|retinol|dong quai|black cohosh|ketone)\b/i.test(ingredient)) {
    return `${ingredient} isn't advised in pregnancy or while breastfeeding. Check with your clinician.`;
  }
  return null;
}

/**
 * What the AI must respect when planning meals or suggesting recipes, in plain sentences. Food
 * guidance only: never medicine or dosing.
 */
export function mealNotes(conditions: readonly HealthCondition[]): string[] {
  const notes: string[] = [];
  if (has(conditions, "type1_diabetes", "type2_diabetes")) {
    notes.push("Diabetes: keep every meal's glycemic load low; pair carbohydrates with protein, fat and fibre; no sugary drinks or desserts.");
  }
  if (has(conditions, "pregnant")) {
    notes.push("Pregnant or breastfeeding: no high-mercury fish (shark, swordfish, king mackerel), no raw or undercooked fish, meat or eggs, no unpasteurised cheese, no liver, no alcohol; no calorie deficit.");
  }
  if (has(conditions, "eating_disorder_history")) {
    notes.push("Eating-disorder history: no calorie-cutting language, no 'guilt-free' or 'cheat' framing, no fasting; regular, satisfying meals.");
  }
  if (has(conditions, "heart_condition")) notes.push("Heart condition: keep salt low and favour whole foods, oily fish, nuts, vegetables and legumes.");
  if (has(conditions, "joint_pain")) notes.push("Joint pain: favour oily fish, leafy greens, berries, olive oil and other anti-inflammatory whole foods.");
  if (has(conditions, "blood_thinners")) notes.push("Blood thinners: keep vitamin K steady from day to day (no sudden large servings of kale, spinach or other leafy greens).");
  if (has(conditions, "brain_fog")) notes.push("Brain fog: steady blood sugar first; protein at every meal; avoid ultra-processed food.");
  return notes;
}

/** The Focus Score leans on blood sugar more with diabetes (model v1.1 weights otherwise). */
export function glycemicWeightFor(conditions: readonly HealthCondition[]): number | null {
  return has(conditions, "type1_diabetes", "type2_diabetes") ? 0.25 : null;
}

/** `{ healthNotes }` for an AI request when there are any, else nothing. */
export function withHealthNotes(profile: Parameters<typeof conditionsOf>[0]): { healthNotes?: string[] } {
  const notes = mealNotes(conditionsOf(profile));
  return notes.length ? { healthNotes: notes } : {};
}
