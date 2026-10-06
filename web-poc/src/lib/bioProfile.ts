import type { BioProfile, CognitiveGoal, DietaryPreference, Macros } from "@neurocal/contracts";

/**
 * The bio-profile onboarding, as data: eleven steps, each a list of questions.
 * Option values are the contract's ids; labels are what the person reads.
 */
export type Choice = readonly [value: string, label: string, detail?: string];

export interface Question {
  /** The answer's key in `Answers`. */
  key: AnswerKey;
  prompt?: string;
  note?: string;
  /** rows: stacked cards with a radio mark. pills: wrapping chips. segments: equal columns. grid: two-column tiles. multi: chips, pick any. */
  kind: "rows" | "pills" | "segments" | "grid" | "multi";
  options: readonly Choice[];
  optional?: boolean;
  /** Shown only when this returns true. */
  when?: (answers: Answers) => boolean;
}

export interface Step {
  eyebrow: string;
  title: string;
  detail?: string;
  questions: readonly Question[];
}

const YES_NO = [
  ["yes", "Yes"],
  ["no", "No"],
] as const;
const FREQUENCY = [
  ["daily", "Daily"],
  ["weekly", "Weekly"],
  ["never", "Never"],
] as const;

/** Diet protocols offered in onboarding (a subset of the contract's DietaryPreference). */
export const DIETS = [
  ["cyclical_keto", "Cyclical keto", "Keto most days, planned carb refeeds"],
  ["low_toxin", "Bulletproof (low-toxin)", "Whole foods, healthy fats, low toxins"],
  ["carnivore", "Carnivore", "Animal foods only"],
  ["paleo", "Paleo", "Meat, fish and vegetables, no grains or dairy"],
  ["standard", "Standard", "No specific protocol"],
] as const satisfies readonly Choice[];

/** Step 1 (name, time zone, devices) is its own form; these are steps 2 to 11. */
export const STEPS: readonly Step[] = [
  {
    eyebrow: "Chronotype",
    title: "When do you naturally wake up?",
    detail: "Without an alarm. This sets your daily caffeine curfew and when the app switches to amber light.",
    questions: [
      {
        key: "wake",
        kind: "rows",
        options: [
          ["before_6", "Before 6 AM", "Early riser"],
          ["6_to_8", "6–8 AM", "Middle of the pack"],
          ["after_8", "After 8 AM", "Night owl"],
        ],
      },
    ],
  },
  {
    eyebrow: "Fuel & fasting",
    title: "How do you eat?",
    questions: [
      { key: "diet", prompt: "Diet protocol", kind: "rows", options: DIETS },
      {
        key: "fasting",
        prompt: "Fasting schedule",
        kind: "pills",
        options: [
          ["16_8", "16:8"],
          ["omad", "OMAD"],
          ["12_12", "12:12"],
          ["none", "No fasting"],
        ],
      },
    ],
  },
  {
    eyebrow: "Coffee",
    title: "Your coffee ritual",
    questions: [
      {
        key: "coffeeType",
        prompt: "What do you drink?",
        kind: "pills",
        options: [
          ["biohacked", "Biohacked (MCT/ghee)"],
          ["black", "Black"],
          ["espresso", "Espresso"],
          ["none", "None"],
        ],
      },
      {
        key: "coffeeTime",
        prompt: "When do you have it?",
        kind: "pills",
        options: [
          ["before_9", "Before 9 AM"],
          ["9_to_11", "9–11 AM"],
          ["afternoon", "Afternoon"],
        ],
        when: (a) => a.coffeeType !== "none",
      },
      {
        key: "coffeeMoldTested",
        prompt: "Do you only drink mycotoxin-free or mold-tested coffee?",
        kind: "segments",
        options: YES_NO,
        when: (a) => a.coffeeType !== "none",
      },
    ],
  },
  {
    eyebrow: "Environment & EMF",
    title: "Your environment",
    questions: [
      { key: "moldSensitive", prompt: "Are you sensitive to mold, or do you live or work in a water-damaged building?", kind: "segments", options: YES_NO },
      {
        key: "eveningScreens",
        prompt: "Hours of screen time after sunset without blue-light blockers",
        kind: "segments",
        options: [
          ["none", "None"],
          ["1_2", "1–2"],
          ["3_plus", "3+"],
        ],
      },
      {
        key: "phoneAtNight",
        prompt: "Where is your phone when you sleep?",
        kind: "rows",
        options: [
          ["airplane_mode", "Airplane mode"],
          ["another_room", "Another room"],
          ["nightstand", "On the nightstand"],
          ["next_to_head", "Next to my head"],
        ],
      },
    ],
  },
  {
    eyebrow: "Hydration & minerals",
    title: "Water and minerals",
    questions: [
      {
        key: "water",
        prompt: "Main water source",
        kind: "rows",
        options: [
          ["filtered", "Filtered or reverse osmosis"],
          ["spring", "Spring or structured"],
          ["tap", "Tap water"],
        ],
      },
      { key: "addsMinerals", prompt: "Do you add trace minerals or sea salt to your water?", kind: "segments", options: YES_NO },
    ],
  },
  {
    eyebrow: "Recovery",
    title: "Recovery protocols",
    detail: "How often do you use each?",
    questions: [
      { key: "coldTherapy", prompt: "Cold therapy", kind: "segments", options: FREQUENCY },
      { key: "redLight", prompt: "Red light / photobiomodulation", kind: "segments", options: FREQUENCY },
      { key: "pemf", prompt: "PEMF mat or vibration plate", kind: "segments", options: FREQUENCY },
    ],
  },
  {
    eyebrow: "The stack",
    title: "Do you take supplements?",
    questions: [
      { key: "takesSupplements", kind: "segments", options: YES_NO },
      {
        key: "supplements",
        prompt: "Which ones?",
        note: "Pick any",
        kind: "multi",
        optional: true,
        options: [
          ["c8_mct", "C8 MCT"],
          ["magnesium_l_threonate", "Magnesium L-threonate"],
          ["l_theanine", "L-theanine"],
          ["creatine", "Creatine"],
          ["ashwagandha", "Ashwagandha"],
          ["rhodiola", "Rhodiola"],
          ["binders", "Binders / charcoal"],
          ["ketone_esters", "Ketone esters"],
          ["methyl_b", "Methyl B vitamins"],
          ["nootropics", "Nootropics"],
        ],
        when: (a) => a.takesSupplements === "yes",
      },
    ],
  },
  {
    eyebrow: "Movement vs strain",
    title: "How do you train?",
    questions: [
      {
        key: "movement",
        kind: "rows",
        options: [
          ["heavy_lifting", "Heavy lifting"],
          ["rehit", "REHIT or sprints", "Short, all-out intervals"],
          ["chronic_cardio", "Chronic cardio", "Long steady sessions most days"],
          ["mobility", "Mobility", "Yoga, stretching, walking"],
          ["none", "None"],
        ],
      },
    ],
  },
  {
    eyebrow: "Friction",
    title: "What is your biggest daily friction point?",
    detail: "Pick one. NeuroCal will watch for it first.",
    questions: [
      {
        key: "friction",
        kind: "rows",
        options: [
          ["afternoon_crash", "2:00 PM crashes"],
          ["night_waking", "3:00 AM wake-ups"],
          ["post_meal_fog", "Brain fog after meals"],
          ["slow_recovery", "Slow physical recovery"],
        ],
      },
    ],
  },
  {
    eyebrow: "Optimization targets",
    title: "What are you optimizing for?",
    questions: [
      {
        key: "goal",
        kind: "grid",
        options: [
          ["focus", "Unshakable focus", "Long, clean deep-work blocks"],
          ["deep_sleep", "Deep sleep architecture", "More deep and REM sleep"],
          ["steady_energy", "Steady energy", "No peaks, no crashes"],
          ["longevity", "Longevity", "Long-term healthspan"],
        ],
      },
    ],
  },
];

/** Total steps shown in the progress bar, including the first (name and time zone). */
export const STEP_COUNT = STEPS.length + 1;

export type AnswerKey =
  | "wake"
  | "diet"
  | "fasting"
  | "coffeeType"
  | "coffeeTime"
  | "coffeeMoldTested"
  | "moldSensitive"
  | "eveningScreens"
  | "phoneAtNight"
  | "water"
  | "addsMinerals"
  | "coldTherapy"
  | "redLight"
  | "pemf"
  | "takesSupplements"
  | "supplements"
  | "movement"
  | "friction"
  | "goal";

/** What the form holds while it is being filled in: one id per question, a list for "pick any". */
export type Answers = Partial<Record<Exclude<AnswerKey, "supplements">, string>> & { supplements?: string[] };

export const visibleQuestions = (step: Step, answers: Answers) => step.questions.filter((q) => !q.when || q.when(answers));

/** A step can be left once every visible, required question has an answer. */
export function stepComplete(step: Step, answers: Answers): boolean {
  return visibleQuestions(step, answers).every((q) => q.optional || (q.key === "supplements" ? (answers.supplements ?? []).length > 0 : Boolean(answers[q.key])));
}

export const DAILY_CALORIES = 2200;

/** Share of calories from fat, protein and carbs for each diet protocol. */
const RATIOS: Record<string, readonly [fat: number, protein: number, carbs: number]> = {
  cyclical_keto: [70, 20, 10],
  low_toxin: [60, 25, 15],
  carnivore: [65, 35, 0],
  paleo: [40, 30, 30],
  standard: [30, 25, 45],
};

export interface MacroShare {
  name: "Fat" | "Protein" | "Carbs";
  percent: number;
  grams: number;
}

export function macroRatio(diet: string | undefined, calories = DAILY_CALORIES): MacroShare[] {
  const [fat, protein, carbs] = RATIOS[diet ?? ""] ?? RATIOS.standard!;
  const grams = (percent: number, perGram: number) => Math.round((calories * percent) / 100 / perGram);
  return [
    { name: "Fat", percent: fat, grams: grams(fat, 9) },
    { name: "Protein", percent: protein, grams: grams(protein, 4) },
    { name: "Carbs", percent: carbs, grams: grams(carbs, 4) },
  ];
}

export function macroTargets(diet: string | undefined): Macros {
  const [fat, protein, carbs] = macroRatio(diet);
  return { fatG: fat!.grams, proteinG: protein!.grams, carbsG: carbs!.grams };
}

const WAKE_HOUR: Record<string, number> = { before_6: 5.5, "6_to_8": 7, after_8: 8.5 };

/** 7.5 → "07:30", wrapping past midnight. */
function clock(hours: number): string {
  const h = ((hours % 24) + 24) % 24;
  return `${String(Math.floor(h)).padStart(2, "0")}:${h % 1 ? "30" : "00"}`;
}

/** The day's rhythm that follows from wake time and fasting schedule. */
export function dayPlan(answers: Pick<Answers, "wake" | "fasting">): { label: string; value: string }[] {
  const wake = WAKE_HOUR[answers.wake ?? ""] ?? 7;
  const eating =
    answers.fasting === "16_8"
      ? `${clock(wake + 4)}–${clock(wake + 12)} (16:8)`
      : answers.fasting === "12_12"
        ? `${clock(wake + 1)}–${clock(wake + 13)} (12:12)`
        : answers.fasting === "omad"
          ? `${clock(wake + 9)}–${clock(wake + 10)} (OMAD)`
          : `Open, last meal by ${clock(wake + 12)}`;
  return [
    { label: "Eating window", value: eating },
    { label: "Caffeine curfew", value: clock(wake + 8) },
    { label: "Amber light from", value: clock(wake + 13.5) },
  ];
}

export const dietLabelOf = (diet: string | undefined) => DIETS.find(([value]) => value === diet)?.[1];

const GOALS: Record<string, CognitiveGoal[]> = { focus: ["focus"], deep_sleep: ["sleep"], steady_energy: ["energy"], longevity: [] };

/** The completed form as the API's profile fields. Call only when every step is complete. */
export function toProfileFields(answers: Answers): {
  dietaryPreference: DietaryPreference;
  cognitiveGoals: CognitiveGoal[];
  dailyCalorieTarget: number;
  macroTargets: Macros;
  bioProfile: BioProfile;
} {
  const drinksCoffee = answers.coffeeType !== "none";
  const takes = answers.takesSupplements === "yes";
  return {
    dietaryPreference: answers.diet as DietaryPreference,
    cognitiveGoals: GOALS[answers.goal ?? ""] ?? [],
    dailyCalorieTarget: DAILY_CALORIES,
    macroTargets: macroTargets(answers.diet),
    // The API validates this against the contract; the casts only narrow ids the form already restricts.
    bioProfile: {
      wake: answers.wake,
      fasting: answers.fasting,
      coffeeType: answers.coffeeType,
      ...(drinksCoffee ? { coffeeTime: answers.coffeeTime, coffeeMoldTested: answers.coffeeMoldTested === "yes" } : {}),
      moldSensitive: answers.moldSensitive === "yes",
      eveningScreens: answers.eveningScreens,
      phoneAtNight: answers.phoneAtNight,
      water: answers.water,
      addsMinerals: answers.addsMinerals === "yes",
      coldTherapy: answers.coldTherapy,
      redLight: answers.redLight,
      pemf: answers.pemf,
      takesSupplements: takes,
      supplements: takes ? (answers.supplements ?? []) : [],
      movement: answers.movement,
      friction: answers.friction,
      goal: answers.goal,
    } as BioProfile,
  };
}
