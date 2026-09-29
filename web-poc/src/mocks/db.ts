import {
  type BioState,
  type HistoryDay,
  type ProtocolsResponse,
  type WeakPoint,
  type FocusScore,
  type IngestScreenTimeRequest,
  type IngestSleepRequest,
  type CheckIn,
  type CreateCheckInRequest,
  type CreateMealRequest,
  type FoodItem,
  type MacroFocus,
  type Macros,
  type Meal,
  type NextRecommendationsResponse,
  type Profile,
  type RecipeRecommendation,
  mealCalories,
} from "@neurocal/contracts";
import { flagLabel, todayIso } from "../lib/format";

/** In-memory stand-in for the backend, seeded with a plausible day. */
function at(hour: number, minute: number): string {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  const offset = -d.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const pad = (n: number) => String(Math.floor(Math.abs(n))).padStart(2, "0");
  const local = new Date(d.getTime() + offset * 60_000).toISOString().slice(0, 19);
  return `${local}${sign}${pad(offset / 60)}:${pad(offset % 60)}`;
}

const item = (name: string, portion: string, calories: number, p: number, c: number, f: number, confidence?: number): FoodItem => ({
  name,
  portion,
  calories,
  macros: { proteinG: p, carbsG: c, fatG: f },
  ...(confidence === undefined ? {} : { confidence }),
});

export function createDb(options: { newUser?: boolean } = {}) {
  let nextId = 100;
  let profile: Profile | null = options.newUser ? null : {
    id: "u1",
    displayName: "Lionel",
    dietaryPreference: "pescatarian",
    cognitiveGoals: ["focus", "energy"],
    dailyCalorieTarget: 2200,
    macroTargets: { proteinG: 130, carbsG: 240, fatG: 75 },
  };

  const meals: Meal[] = [
    {
      id: "m1",
      kind: "breakfast",
      eatenAt: at(8, 10),
      items: [
        item("Steel-cut oats", "1 cup cooked", 300, 10, 54, 5),
        item("Blueberries", "½ cup", 42, 0.5, 11, 0.2),
        item("Walnuts", "15 g", 98, 2.3, 2, 9.8),
      ],
    },
    {
      id: "m2",
      kind: "lunch",
      eatenAt: at(12, 40),
      items: [
        item("Salmon poke bowl", "1 bowl", 610, 34, 68, 21),
        item("Sparkling water", "330 ml", 0, 0, 0, 0),
      ],
    },
  ];

  const checkIns: CheckIn[] = [{ id: "c1", at: at(14, 5), flags: ["low_focus", "low_energy"] }];

  // Last night: 23:15 → 05:45, six and a half hours.
  const bedtime = new Date(at(23, 15));
  bedtime.setDate(bedtime.getDate() - 1);
  const sleep: IngestSleepRequest["sessions"] = [{ start: bedtime.toISOString(), end: at(5, 45), source: "manual" }];
  const screenTime: IngestScreenTimeRequest["samples"] = [];

  // Six earlier days with varied sleep, dinner times and feelings (mirrors the backend dev seed).
  if (!options.newUser) {
    const plan = [
      { sleep: 7.5, dinner: [19, 0], high: false, flags: ["sharp"] },
      { sleep: 6, dinner: [21, 45], high: true, flags: ["low_focus", "wired"] },
      { sleep: 5.5, dinner: [22, 10], high: true, flags: ["brain_fog", "stressed"] },
      { sleep: 8, dinner: [18, 45], high: false, flags: ["calm"] },
      { sleep: 7, dinner: [20, 15], high: false, flags: ["sharp"] },
      { sleep: 6.5, dinner: [21, 30], high: true, flags: ["low_energy"] },
    ] as const;
    plan.forEach((day, i) => {
      const back = plan.length - i;
      const on = (h: number, m: number) => {
        const d = new Date(at(h, m));
        d.setDate(d.getDate() - back);
        return d;
      };
      const wake = on(6, 30);
      sleep.push({ start: new Date(wake.getTime() - day.sleep * 3_600_000).toISOString(), end: wake.toISOString(), source: "manual" });
      meals.push(
        { id: `h${i}b`, kind: "breakfast", eatenAt: on(8, 0).toISOString(), items: [item("Greek yogurt and berries", "1 bowl", 320, 22, 35, 9)] },
        { id: `h${i}l`, kind: "lunch", eatenAt: on(12, 45).toISOString(), items: [item("Grain bowl", "1 bowl", 640, 32, 70, 22)] },
        {
          id: `h${i}d`,
          kind: "dinner",
          eatenAt: on(day.dinner[0], day.dinner[1]).toISOString(),
          items: [
            day.high
              ? { ...item("Pasta and garlic bread", "1 plate", 980, 28, 140, 30), glycemicLoad: "high" as const }
              : { ...item("Salmon, greens and quinoa", "1 plate", 720, 45, 50, 30), glycemicLoad: "low" as const },
          ],
        },
      );
      checkIns.push({ id: `hc${i}`, at: on(15, 0).toISOString(), flags: [...day.flags] });
    });
  }

  const sumMacros = (list: Meal[]): Macros =>
    list
      .flatMap((m) => m.items)
      .reduce(
        (acc, i) => ({
          proteinG: acc.proteinG + i.macros.proteinG,
          carbsG: acc.carbsG + i.macros.carbsG,
          fatG: acc.fatG + i.macros.fatG,
        }),
        { proteinG: 0, carbsG: 0, fatG: 0 },
      );

  function macroFocus(eaten: Macros, target: Macros): MacroFocus {
    const gaps: [MacroFocus, number][] = [
      ["protein", 1 - eaten.proteinG / target.proteinG],
      ["complex_carbs", 1 - eaten.carbsG / target.carbsG],
      ["healthy_fats", 1 - eaten.fatG / target.fatG],
    ];
    gaps.sort((a, b) => b[1] - a[1]);
    const [top, second] = gaps;
    return top && second && top[1] - second[1] > 0.1 ? top[0] : "balanced";
  }

  function mealsOn(date: string) {
    return meals.filter((m) => todayIso(new Date(m.eatenAt)) === date).sort((a, b) => a.eatenAt.localeCompare(b.eatenAt));
  }

  /** Handlers answer 404 before calling anything that needs a profile. */
  const me = () => {
    if (!profile) throw new Error("No profile: handlers must check db.profile() first");
    return profile;
  };

  function bioState(date: string): BioState {
    const profile = me();
    const day = mealsOn(date);
    const macrosEaten = sumMacros(day);
    const latest = checkIns.filter((c) => todayIso(new Date(c.at)) === date).at(-1);
    return {
      date,
      calorieTarget: profile.dailyCalorieTarget,
      caloriesEaten: day.reduce((sum, m) => sum + mealCalories(m), 0),
      macrosEaten,
      macroTargets: profile.macroTargets,
      macroFocus: macroFocus(macrosEaten, profile.macroTargets),
      cognitiveFlags: latest?.flags ?? [],
      dietaryPreference: profile.dietaryPreference,
    };
  }

  const recipes: Omit<RecipeRecommendation, "reasoning">[] = [
    {
      id: "r1",
      title: "Miso-glazed cod with edamame and brown rice",
      sourceName: "Serious Eats",
      sourceUrl: "https://www.seriouseats.com/",
      minutes: 30,
      calories: 640,
      macros: { proteinG: 46, carbsG: 62, fatG: 18 },
    },
    {
      id: "r2",
      title: "Lentil, spinach and feta skillet with a soft egg",
      sourceName: "BBC Good Food",
      sourceUrl: "https://www.bbcgoodfood.com/",
      minutes: 25,
      calories: 520,
      macros: { proteinG: 32, carbsG: 48, fatG: 20 },
    },
    {
      id: "r3",
      title: "Sardines on rye with avocado and lemon",
      sourceName: "Bon Appétit",
      sourceUrl: "https://www.bonappetit.com/",
      minutes: 10,
      calories: 480,
      macros: { proteinG: 27, carbsG: 34, fatG: 26 },
    },
  ];

  function recommendations(): NextRecommendationsResponse {
    const state = bioState(todayIso());
    const left = state.calorieTarget - state.caloriesEaten;
    const flags = state.cognitiveFlags.map((f) => flagLabel[f].toLowerCase());
    const feeling = flags.length ? `You checked in with ${flags.join(" and ")}` : "You haven't checked in yet";
    const reasons: Record<string, string> = {
      r1: `${feeling}. Cod and edamame bring slow protein and omega-3s, and brown rice releases energy gradually instead of spiking it. It fits in your ${Math.round(left)} kcal left.`,
      r2: `Lentils and eggs cover the protein you're short on today, and iron-rich spinach supports steady energy through the afternoon.`,
      r3: `A ten-minute option: sardines and avocado add the healthy fats your brain runs on, with rye for fibre that keeps you full.`,
    };
    return {
      searchQuery: `${state.dietaryPreference} high protein omega-3 dinner under ${Math.round(left)} calories`,
      recipes: recipes.map((r) => ({ ...r, reasoning: reasons[r.id] ?? "" })),
    };
  }

  const plates: FoodItem[][] = [
    [item("Grilled chicken breast", "150 g", 248, 46, 0, 5.4, 0.92), item("Quinoa", "¾ cup", 166, 6, 29, 2.7, 0.81), item("Roasted broccoli", "1 cup", 55, 3.7, 11, 0.6, 0.88)],
    [item("Avocado toast", "1 slice sourdough", 290, 7, 30, 16, 0.9), item("Poached egg", "1 large", 72, 6.3, 0.4, 4.8, 0.86)],
  ];

  /** Mirrors backend/src/domain/focusScore.ts closely enough for the UI; the backend is the source of truth. */
  function focusScore(date: string): FocusScore {
    const clamp = (n: number) => Math.min(1, Math.max(0, n));
    const round = (n: number | null) => (n === null ? null : Math.round(n * 100) / 100);
    const d = new Date(`${date}T12:00:00`);
    d.setDate(d.getDate() - 1);
    const yesterday = todayIso(d);

    const nights = sleep.filter((s) => todayIso(new Date(s.end)) === date);
    // Overlapping sessions count once.
    let sleepMin = 0;
    let coveredUntil = -Infinity;
    for (const s of [...nights].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))) {
      const start = Math.max(Date.parse(s.start), coveredUntil);
      if (Date.parse(s.end) > start) sleepMin += (Date.parse(s.end) - start) / 60_000;
      coveredUntil = Math.max(coveredUntil, Date.parse(s.end));
    }
    const sleepC = nights.length ? clamp(sleepMin / 480) : null;

    const yMeals = mealsOn(yesterday);
    const lateEating = Math.max(0, ...yMeals.map((m) => (new Date(m.eatenAt).getHours() - 21) * 60 + new Date(m.eatenAt).getMinutes()));
    const lateScreen = screenTime
      .filter((s) => {
        const start = new Date(s.windowStart);
        return (todayIso(start) === yesterday && start.getHours() >= 22) || (todayIso(start) === date && start.getHours() < 4);
      })
      .reduce((sum, s) => sum + s.minutes, 0);
    const timingC = yMeals.length || screenTime.length ? clamp(1 - clamp(lateEating / 120) - 0.5 * clamp(lateScreen / 120)) : null;

    const yCalories = yMeals.reduce((sum, m) => sum + mealCalories(m), 0);
    const high = yMeals.flatMap((m) => m.items).filter((i) => i.glycemicLoad === "high").reduce((sum, i) => sum + i.calories, 0);
    const glycemicC = yCalories > 0 ? clamp(1 - high / yCalories) : null;

    const recent = checkIns.filter((c) => [yesterday, date].includes(todayIso(new Date(c.at))));
    const negatives = new Set(recent.flatMap((c) => c.flags).filter((f) => ["stressed", "brain_fog", "low_focus", "wired"].includes(f)));
    const stressC = recent.length ? clamp(1 - 0.25 * negatives.size) : null;

    const components = { sleep: round(sleepC), timing: round(timingC), glycemic: round(glycemicC), stress: round(stressC) };
    const weights = { sleep: 0.4, timing: 0.2, glycemic: 0.2, stress: 0.2 } as const;
    let weighted = 0;
    let total = 0;
    for (const key of Object.keys(weights) as (keyof typeof weights)[]) {
      const value = components[key];
      if (value === null) continue;
      weighted += weights[key] * value;
      total += weights[key];
    }
    const score = total ? Math.round((100 * weighted) / total) : null;
    const explanation =
      score === null
        ? "Log last night's sleep or a check-in to get today's Focus Score."
        : components.sleep !== null && components.sleep < 0.9
          ? `About ${Math.round(sleepMin / 6) / 10} hours of sleep is holding your focus back most. A short walk in daylight before lunch can help.`
          : "Your inputs look steady today. Keep dinner before 9pm to protect tomorrow's score.";
    return { date, score, components, explanation };
  }

  function history(days: number): HistoryDay[] {
    const dates: string[] = [];
    for (let back = days - 1; back >= 0; back--) {
      const d = new Date();
      d.setDate(d.getDate() - back);
      dates.push(todayIso(d));
    }
    return dates.map((date) => {
      const state = bioState(date);
      const day = mealsOn(date);
      const last = day.at(-1);
      const nights = sleep.filter((s) => todayIso(new Date(s.end)) === date);
      const minutes = nights.reduce((sum, s) => sum + (Date.parse(s.end) - Date.parse(s.start)) / 60_000, 0);
      const lastAt = last ? new Date(last.eatenAt) : null;
      return {
        date,
        calorieTarget: state.calorieTarget,
        caloriesEaten: state.caloriesEaten,
        proteinG: Math.round(state.macrosEaten.proteinG),
        focusScore: focusScore(date).score,
        sleepMinutes: nights.length ? Math.round(minutes) : null,
        lastMealAt: lastAt ? `${String(lastAt.getHours()).padStart(2, "0")}:${String(lastAt.getMinutes()).padStart(2, "0")}` : null,
        flags: [...new Set(checkIns.filter((c) => todayIso(new Date(c.at)) === date).flatMap((c) => c.flags))],
      };
    });
  }

  /** A small stand-in for the pgvector match: weak points from the mock week, protocols picked by component. */
  function protocols(): ProtocolsResponse {
    const labels: Record<WeakPoint["component"], string> = {
      sleep: "short or light sleep",
      timing: "late eating and late-night screens",
      glycemic: "high-glycemic meals",
      stress: "stress and low focus",
    };
    const week = history(7).map((d) => focusScore(d.date).components);
    const weakPoints = (Object.keys(labels) as WeakPoint["component"][])
      .map((component) => {
        const values = week.map((c) => c[component]).filter((v): v is number => v !== null);
        return { component, label: labels[component], average: values.length ? values.reduce((a, b) => a + b, 0) / values.length : 1 };
      })
      .filter((w) => w.average < 0.75)
      .sort((a, b) => a.average - b.average)
      .slice(0, 2)
      .map((w) => ({ ...w, average: Math.round(w.average * 100) / 100 }));

    const library: Record<WeakPoint["component"], ProtocolsResponse["protocols"][number]> = {
      sleep: {
        id: "wind-down-hour",
        title: "A wind-down hour before bed",
        summary: "Give your brain a slow runway into sleep so you fall asleep sooner and sleep longer.",
        steps: ["Set an alarm one hour before bedtime.", "Dim the lights and put screens on charge outside the bedroom.", "Do something calm and analogue.", "Keep the bedroom cool and dark."],
        match: 0.82,
      },
      timing: {
        id: "kitchen-closes-at-eight",
        title: "The kitchen closes three hours before bed",
        summary: "Finishing dinner earlier gives digestion time to settle before sleep and cuts late-night snacking.",
        steps: ["Set a kitchen-closed time three hours before bedtime.", "Plan dinner to finish by then.", "After closing, stick to water or herbal tea."],
        match: 0.79,
      },
      glycemic: {
        id: "steady-plate",
        title: "Build a steady-energy plate",
        summary: "Pairing carbs with protein, fibre and fat smooths out energy dips after meals.",
        steps: ["Half vegetables, a quarter protein, a quarter whole grains.", "Swap white carbs for wholegrain a few times a week.", "Take a 10-minute walk after your largest meal."],
        match: 0.77,
      },
      stress: {
        id: "box-breathing",
        title: "Two minutes of box breathing",
        summary: "A short, structured breathing break helps you reset when you feel stressed, wired or scattered.",
        steps: ["Breathe in for four counts.", "Hold for four.", "Breathe out for four.", "Hold for four, and repeat for two minutes."],
        match: 0.74,
      },
    };
    const picked = (weakPoints.length ? weakPoints.map((w) => w.component) : (["sleep", "glycemic"] as const)).map((c) => library[c]);
    return {
      weakPoints,
      protocols: picked,
      products: [
        {
          id: "sunrise-alarm",
          name: "Sunrise alarm clock",
          description: "Brightens gradually before your alarm so waking at a fixed time feels easier.",
          url: "https://example.com/mock-partner/sunrise-alarm",
          affiliate: true,
          match: 0.71,
        },
        {
          id: "phone-lockbox",
          name: "Timed phone lockbox",
          description: "Locks your phone away until a set time, so a screens-off rule sticks on busy evenings.",
          affiliate: false,
          match: 0.66,
        },
      ],
    };
  }

  return {
    protocols,
    history,
    focusScore,
    addSleep(sessions: IngestSleepRequest["sessions"]) {
      for (const s of sessions) {
        // A new session replaces any overlapping one from the same source.
        const overlaps = (x: (typeof sleep)[number]) =>
          x.source === s.source && Date.parse(x.start) < Date.parse(s.end) && Date.parse(x.end) > Date.parse(s.start);
        for (let i = sleep.length - 1; i >= 0; i--) if (overlaps(sleep[i]!)) sleep.splice(i, 1);
        sleep.push(s);
      }
      return sessions.length;
    },
    addScreenTime(samples: IngestScreenTimeRequest["samples"]) {
      screenTime.push(...samples);
      return samples.length;
    },
    profile: () => profile,
    /** Mirrors the backend: the first save needs every required field; later saves can be partial. */
    updateProfile(patch: Partial<Omit<Profile, "id">>): Profile | { missing: string[] } {
      if (!profile) {
        const required = ["displayName", "dietaryPreference", "dailyCalorieTarget", "macroTargets"] as const;
        const missing = required.filter((key) => patch[key] === undefined);
        if (missing.length) return { missing };
        profile = { id: "u1", timeZone: "UTC", ...(patch as Omit<Profile, "id">), cognitiveGoals: patch.cognitiveGoals ?? [] };
        return profile;
      }
      profile = { ...profile, ...patch };
      return profile;
    },
    mealsOn,
    bioState,
    recommendations,
    analyze(fileName: string) {
      if (/dark/i.test(fileName)) return { items: [], problem: "too_dark" as const };
      return { items: plates[nextId++ % plates.length] ?? [] };
    },
    addMeal(input: CreateMealRequest): Meal {
      const meal = { ...input, id: `m${nextId++}` };
      meals.push(meal);
      return meal;
    },
    deleteMeal(id: string) {
      const index = meals.findIndex((m) => m.id === id);
      if (index >= 0) meals.splice(index, 1);
      return index >= 0;
    },
    addCheckIn(input: CreateCheckInRequest): CheckIn {
      const checkIn = { ...input, id: `c${nextId++}` };
      checkIns.push(checkIn);
      return checkIn;
    },
  };
}
