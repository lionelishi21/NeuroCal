import type { ExerciseKind } from "./exercise";
import type { SessionKind } from "./session";
import { addDays, dayNumber } from "./weight";

/**
 * A guide's day-by-day program (docs/NCBM.md §11): The Mitoproof Protocol's 30 days, a 7-day reset
 * then a 21-day build. Each day lists its habits; those NeuroCal can see in what's logged tick
 * themselves, the rest are ticked by hand.
 */
export const PROGRAM_DAYS = 30;
export const RESET_DAYS = 7;
/** A finished program stays on Today this many days, with its results, before it goes. */
export const FINISHED_SHOWN_DAYS = 7;

/** What a habit is ticked from, when NeuroCal can see it. */
export type RuleSource = "daylight" | "lastMeal" | "walk" | "training" | "cold" | "blueBlocking";

export interface RuleDef {
  id: string;
  label: string;
  detail: string;
  /** The program day it starts on. */
  fromDay: number;
  auto?: RuleSource;
  /** Not every day: rest days don't break a full day. */
  weekly?: number;
}

export const PROGRAM_RULES: readonly RuleDef[] = [
  { id: "daylight", label: "Morning daylight", detail: "Ten minutes outside within 30 minutes of waking sets your body clock.", fromDay: 1, auto: "daylight" },
  { id: "noSeedOils", label: "No seed oils", detail: "Cook with olive oil, and skip fried food, packaged snacks and takeaway.", fromDay: 1 },
  { id: "noSugar", label: "No added sugar or refined carbs", detail: "Sweet potato, rice, oats and fruit are fine.", fromDay: 1 },
  { id: "noAlcohol", label: "No alcohol", detail: "Alcohol breaks up sleep, especially the second half of the night.", fromDay: 1 },
  {
    id: "screensOff",
    label: "Screens off by 9pm",
    detail: "Or amber blue-light-blocking glasses from 8pm. Logging the glasses ticks it.",
    fromDay: 1,
    auto: "blueBlocking",
  },
  { id: "lastMeal", label: "Last meal by 7pm", detail: "Ticks itself after 7pm when your meals are logged and none came later.", fromDay: 1, auto: "lastMeal" },
  { id: "walk", label: "A walk after your largest meal", detail: "Ten to thirty gentle minutes. Logging a walk ticks it.", fromDay: 1, auto: "walk" },
  {
    id: "train",
    label: "Zone 2 or strength",
    detail: "Five sessions a week: Zone 2 three times, strength twice. Logging exercise ticks it.",
    fromDay: RESET_DAYS + 1,
    auto: "training",
    weekly: 5,
  },
  {
    id: "cold",
    label: "Cold at the end of your shower",
    detail: "Start with 30 seconds and build to 2–3 minutes. Skip it with heart disease or high blood pressure.",
    fromDay: 10,
    auto: "cold",
  },
];

/** What's logged on one local day, as far as the program's habits go. */
export interface ProgramDayFacts {
  daylight: boolean;
  /** Minutes after local midnight each meal was eaten. */
  mealMinutes: number[];
  exercise: ExerciseKind[];
  sessions: SessionKind[];
}

const SEVEN_PM = 19 * 60;

/** Whether what's logged shows the habit done; [nowMinutes] is the local time now, on that day. */
export function autoDone(source: RuleSource, facts: ProgramDayFacts, nowMinutes: number): boolean {
  switch (source) {
    case "daylight":
      return facts.daylight;
    case "lastMeal":
      // Only once 7pm has passed, with a meal logged and none after.
      return nowMinutes >= SEVEN_PM && facts.mealMinutes.length > 0 && facts.mealMinutes.every((m) => m < SEVEN_PM);
    case "walk":
      return facts.exercise.includes("walk");
    case "training":
      return facts.exercise.some((k) => k !== "calf");
    case "cold":
      return facts.sessions.includes("cold_plunge");
    case "blueBlocking":
      return facts.sessions.includes("blue_blocking");
  }
}

export const dayOf = (startedOn: string, today: string) => dayNumber(today) - dayNumber(startedOn) + 1;
export const dateOfDay = (startedOn: string, day: number) => addDays(startedOn, day - 1);

export type Phase = "reset" | "build" | "finished";
export const phaseOf = (day: number): Phase => (day > PROGRAM_DAYS ? "finished" : day > RESET_DAYS ? "build" : "reset");

export const rulesFor = (day: number) => (day > PROGRAM_DAYS ? [] : PROGRAM_RULES.filter((r) => r.fromDay <= day));

/** A day counts as full when every daily habit (not the weekly ones) of that day is done. */
export function isFullDay(day: number, done: readonly string[]): boolean {
  const daily = rulesFor(day).filter((r) => !r.weekly);
  return daily.length > 0 && daily.every((r) => done.includes(r.id));
}

// The energy check (the guide's chapter 3): five areas, each 0 (best) to 4.
export const ENERGY_AREAS = ["Energy", "Clear thinking", "Sleep", "Energy after meals", "Recovery from exercise"] as const;
export const CHECKPOINTS = [1, 15, 30] as const;
export type Checkpoint = (typeof CHECKPOINTS)[number];

/** The days each check can be taken on: it's due from its day, for a few days. */
const CHECK_WINDOW: Record<Checkpoint, readonly [number, number]> = { 1: [1, 3], 15: [15, 18], 30: [30, 30 + FINISHED_SHOWN_DAYS] };

export function checkDue(day: number, taken: readonly Checkpoint[]): Checkpoint | null {
  return CHECKPOINTS.find((c) => !taken.includes(c) && day >= CHECK_WINDOW[c][0] && day <= CHECK_WINDOW[c][1]) ?? null;
}

export type EnergyBand = "well" | "some" | "lots" | "doctor";

export function energyBand(total: number): EnergyBand {
  return total <= 4 ? "well" : total <= 9 ? "some" : total <= 14 ? "lots" : "doctor";
}

/** One short tip per program day (index 0 is day 1), following the guide; then one for when it's done. */
export const PROGRAM_TIPS: readonly { title: string; detail: string }[] = [
  { title: "Start with the energy check", detail: "It's your starting point for days 15 and 30. Then aim for the seven habits, not perfection." },
  { title: "Daylight first thing", detail: "Step outside within 30 minutes of waking, without sunglasses. On a cloudy day, stay 15–20 minutes." },
  { title: "Read the labels", detail: "Most packaged snacks and dressings use sunflower, soybean or canola oil. Cook with olive oil instead." },
  { title: "Bring dinner forward", detail: "Eat earlier rather than skipping dinner. A 12–14 hour overnight fast is enough." },
  { title: "A 9pm screen alarm", detail: "Set an alarm to put screens away. If you need them, wear amber or red lenses from 8pm." },
  { title: "Ten minutes is enough", detail: "Even a short walk after your biggest meal lowers the rise in blood sugar." },
  { title: "Last day of the reset", detail: "Tomorrow phase 2 starts: Zone 2 and strength sessions join the seven habits." },
  { title: "Find your Zone 2", detail: "A pace where you can talk in full sentences but would rather not sing. Three sessions a week, 30–45 minutes." },
  { title: "Strength twice a week", detail: "Squats, hinges, pushes and pulls. Add a little weight or a rep each time." },
  { title: "Cold starts today", detail: "30 seconds of cold water at the end of your shower. Skip it with heart disease, high blood pressure or Raynaud's." },
  { title: "Set your supplement times", detail: "If you take the stack, add it to your Stack so NeuroCal reminds you. Check it with your doctor if you take medicine." },
  { title: "A cool, dark bedroom", detail: "Aim for 18–20°C, dark and quiet, and charge your phone outside the bedroom." },
  { title: "Coffee before noon", detail: "Stop caffeine by 2pm: late caffeine lightens sleep even when you fall asleep fine." },
  { title: "A longer fast, if it suits you", detail: "If 12–14 hours feels easy, try eating 10am–6pm. Not with diabetes medicine, in pregnancy or after disordered eating." },
  { title: "Halfway", detail: "Take the energy check again and see what's moved since day 1." },
  { title: "Protein at every meal", detail: "Aim for 1.2–1.6 g per kg of body weight a day; more if you're training hard." },
  { title: "Build the cold slowly", detail: "Work up to 2–3 minutes. Keep cold plunges six hours away from strength training." },
  { title: "Same bedtime, weekends too", detail: "Your body clock likes a steady rhythm: go to bed and get up at the same times." },
  { title: "Same meal times", detail: "Your liver and gut keep their own clocks. Eating at regular times keeps them in step." },
  { title: "Beat the afternoon crash", detail: "Add protein and fat to lunch, and walk afterwards." },
  { title: "Write down your weights", detail: "Small steady increases in strength training beat big jumps." },
  { title: "Notice your sleep", detail: "Three weeks without alcohol: compare your sleep scores with the first week." },
  { title: "Trust the talk test", detail: "It fits you better than a heart-rate formula, especially if you take heart medicine." },
  { title: "Dim the lights too", detail: "After sunset, lower the room lights as well as screens." },
  { title: "Build meals around good fats", detail: "Olive oil, avocado, nuts and oily fish; butter and ghee in moderation." },
  { title: "Rest counts", detail: "Run down? Swap a session for a walk. Recovery is part of the plan." },
  { title: "Is each supplement earning its place?", detail: "Your Stack shows how each one is going, from your own data." },
  { title: "Pick what you'll keep", detail: "The guide's maintenance chapter is a good minimum to carry on with." },
  { title: "Almost there", detail: "Tomorrow is the last day, and the final energy check." },
  { title: "The final energy check", detail: "Take it today and compare it with day 1 and day 15." },
];

export const FINISHED_TIP = {
  title: "You finished the 30 days",
  detail: "Keep the habits that worked for you. The guide's maintenance chapter shows the minimum to carry on with.",
};

export const tipFor = (day: number) => (day > PROGRAM_DAYS ? FINISHED_TIP : PROGRAM_TIPS[day - 1]!);
