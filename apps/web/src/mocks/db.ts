import {
  type BioState,
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

export function createDb() {
  let nextId = 100;
  const profile: Profile = {
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

  function bioState(date: string): BioState {
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

  return {
    profile: () => profile,
    updateProfile(patch: Partial<Profile>) {
      Object.assign(profile, patch);
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
