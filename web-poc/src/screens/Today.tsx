"use client";

import type { BioState, FocusScore, Meal, RecipeRecommendation } from "@neurocal/contracts";
import { mealCalories } from "@neurocal/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RequestFailed } from "../api/client";
import { useBioState, useDeleteMeal, useFocusScore, useMeals, useNextRecommendations, useProfile } from "../api/queries";
import { Button } from "../components/Button";
import { FocusRing } from "../components/FocusRing";
import { LoadFailed, LoadingLines, ScreenFailed, ScreenLoading } from "../components/ListStates";
import { QueuedMealsNotice } from "../components/OfflineMeals";
import { ActionBar, Screen, Section, cardClass } from "../components/Screen";
import { useToast } from "../components/Toast";
import { CheckInSheet } from "../features/check-in/CheckInSheet";
import { LogMealSheet } from "../features/log-meal/LogMealSheet";
import { LogScreenTimeSheet } from "../features/log-screen-time/LogScreenTimeSheet";
import { LogSleepSheet } from "../features/log-sleep/LogSleepSheet";
import { flagLabel, formatDay, kcal, mealKindLabel } from "../lib/format";

type Sheet = "meal" | "check-in" | "sleep" | "screens" | null;
type Component = keyof FocusScore["components"];

/** One word for the score, shown beside the ring. */
function scoreWord(score: number): string {
  if (score >= 80) return "Great";
  if (score >= 65) return "Good";
  if (score >= 45) return "Fair";
  return "Low";
}

/** A component (0–1) as a word and a tone: good from 0.75, otherwise "watch this". */
function reading(value: number): { word: string; good: boolean } {
  if (value >= 0.75) return { word: "Good", good: true };
  return { word: value >= 0.4 ? "Moderate" : "Low", good: false };
}

function greeting(hour: number): string {
  if (hour < 5) return "Good evening";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/** "13:05" in local time. */
const clock = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

const pill = "flex h-11 items-center gap-2 rounded-pill border-[1.5px] border-rule-strong px-4 text-sm font-bold text-ink no-underline hover:bg-paper";
const quick = "flex h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-option border border-rule bg-paper text-sm font-bold text-synapse-ink no-underline hover:border-rule-strong";
const softButton = "h-11 shrink-0 px-4";

/**
 * Today: the Focus Score with the four signals behind it, calories left, how
 * you feel, what to eat next and the day's meals. Missing signals ask to be
 * logged in place.
 */
export function Today() {
  const router = useRouter();
  const profile = useProfile();
  const needsSetup = profile.error instanceof RequestFailed && profile.error.status === 404;
  useEffect(() => {
    if (needsSetup) router.replace("/welcome");
  }, [needsSetup, router]);

  const bio = useBioState();
  const meals = useMeals();
  const recs = useNextRecommendations();
  const focus = useFocusScore();
  const [sheet, setSheet] = useState<Sheet>(null);
  const open = (which: Exclude<Sheet, null>) => () => setSheet(which);
  const close = (isOpen: boolean) => !isOpen && setSheet(null);

  if (needsSetup) return null;

  const components = focus.data?.components;
  const signals: { key: Component; name: string; detail: string; action?: { label: string; name: string; open(): void }; waiting?: string }[] = [
    { key: "sleep", name: "Sleep", detail: "Last night", action: { label: "Log", name: "Log sleep", open: open("sleep") } },
    { key: "timing", name: "Evening timing", detail: "Late food and screens", action: { label: "Log", name: "Log screen time", open: open("screens") } },
    { key: "glycemic", name: "Glycemic load", detail: "Yesterday's food", waiting: "Builds from meals" },
    { key: "stress", name: "Stress", detail: "Recent check-ins", action: { label: "Check in", name: "Check in", open: open("check-in") } },
  ];
  const score = focus.data?.score ?? null;
  const name = profile.data?.displayName.trim().split(/\s+/)[0];
  const hello = greeting(new Date().getHours());
  const eatenToday = meals.data?.reduce((total, meal) => total + mealCalories(meal), 0) ?? 0;

  return (
    <>
      <Screen actions>
        <header className="flex items-start justify-between gap-2 pt-3 pr-2.5 pl-5">
          <div className="min-w-0">
            <p className="m-0 text-xs font-semibold text-ink-soft">{formatDay()}</p>
            <h1 className="m-0 mt-0.5 text-2xl leading-[1.15] font-extrabold tracking-[-0.02em]">{name ? `${hello}, ${name}` : hello}</h1>
          </div>
          <Link href="/settings" aria-label="Settings" className="grid size-11 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-track">
            <svg viewBox="0 0 24 24" aria-hidden className="size-[1.375rem]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
            </svg>
          </Link>
        </header>
        <div className="flex gap-2 px-5 pt-3">
          <Link href="/history" className={pill}>
            <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M5 20V12M12 20V5M19 20v-9" />
            </svg>
            This week
          </Link>
          <Link href="/sleep" className={pill}>
            <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
              <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
            </svg>
            Sleep
          </Link>
        </div>

        {bio.isPending && <ScreenLoading label="Loading today" heights={[14.5, 7.5, 4, 9.375]} />}
        {bio.isError && (
          <ScreenFailed
            title="Couldn't load today"
            onRetry={() => {
              void bio.refetch();
              void focus.refetch();
              void meals.refetch();
              void recs.refetch();
            }}
          >
            Your meals and score are safe. Check your connection and try again.
          </ScreenFailed>
        )}

        {bio.data && (
          <>
            <section aria-labelledby="focus-title" className="mx-4 mt-4 rounded-hero border border-rule bg-paper p-[1.125rem]">
              <div className="grid grid-cols-[6.5rem_minmax(0,1fr)] items-center gap-4">
                <FocusRing score={score} size={104} stroke={18}>
                  <span className={`text-3xl leading-none font-extrabold tracking-[-0.03em] tabular-nums ${score === null ? "text-ink-faint" : ""}`}>{score ?? "–"}</span>
                  {score !== null && <span className="mt-[3px] text-3xs font-medium text-ink-soft">of 100</span>}
                </FocusRing>
                <div className="flex min-w-0 flex-col gap-1">
                  <h2 id="focus-title" className="m-0 text-xs font-semibold text-synapse-ink">
                    Focus Score
                  </h2>
                  {focus.isPending && <LoadingLines label="Working out today's score" lines={2} />}
                  {focus.isError && (
                    <p role="alert" className="m-0 text-sm text-beet">
                      The score didn't load. Try again shortly.
                    </p>
                  )}
                  {focus.data && (
                    <>
                      <p className="m-0 text-xl leading-[1.15] font-extrabold">{score === null ? "No score yet" : scoreWord(score)}</p>
                      <p className="m-0 text-sm text-pretty text-ink-soft">{focus.data.explanation}</p>
                    </>
                  )}
                </div>
              </div>
              {components && (
                <ul className="m-0 mt-4 grid list-none grid-cols-2 gap-2 p-0">
                  {signals.map((signal) => {
                    const value = components[signal.key];
                    const read = value === null ? null : reading(value);
                    return (
                      <li key={signal.key} className="flex min-h-[4.625rem] flex-col gap-1 rounded-option bg-mist px-3 py-2.5">
                        <span className="text-2xs font-semibold text-ink-soft">{signal.name}</span>
                        {read ? (
                          <>
                            <span className={`text-md font-bold ${read.good ? "text-chlorophyll" : "text-glucose-ink"}`}>{read.word}</span>
                            <span aria-hidden className="block h-1 rounded-pill bg-track">
                              <span className={`block h-full rounded-pill ${read.good ? "bg-chlorophyll-bar" : "bg-glucose"}`} style={{ width: `${Math.round(value! * 100)}%` }} />
                            </span>
                          </>
                        ) : signal.action ? (
                          <Button variant="soft" className="my-0.5 h-8 self-start px-3 text-xs" aria-label={signal.action.name} onClick={signal.action.open}>
                            <span aria-hidden>+</span>
                            {signal.action.label}
                          </Button>
                        ) : (
                          <span className="text-md font-bold text-ink-faint">–</span>
                        )}
                        <span className="text-2xs text-ink-faint">{read || signal.action ? signal.detail : signal.waiting}</span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <div className="flex gap-2 px-4 pt-3">
              <button type="button" className={quick} onClick={open("sleep")}>
                <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinejoin="round">
                  <path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
                </svg>
                Log sleep
              </button>
              <Link href="/history#help" className={quick}>
                <svg viewBox="0 0 24 24" aria-hidden className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" />
                </svg>
                See what helps
              </Link>
            </div>

            <section aria-label="Calories today" className={`${cardClass} mt-3 p-4`}>
              <Calories bio={bio.data} />
            </section>

            <section aria-label="How you feel" className={`${cardClass} mt-3 flex items-center gap-3 py-3 pr-3 pl-4`}>
              <div className="min-w-0 flex-1">
                <p className="m-0 text-2xs font-semibold text-ink-soft">{bio.data.cognitiveFlags.length ? "You said you feel" : "How you feel"}</p>
                <p className={`m-0 mt-0.5 text-base font-bold ${bio.data.cognitiveFlags.length ? "" : "text-ink-faint"}`}>
                  {bio.data.cognitiveFlags.length ? sentence(bio.data.cognitiveFlags.map((flag) => flagLabel[flag])) : "No check-in yet today"}
                </p>
              </div>
              <Button variant="soft" className={softButton} onClick={open("check-in")}>
                Check in
              </Button>
            </section>

            <Section title="What to eat next" kind="title">
              <div className={`${cardClass} flex flex-col gap-2.5 p-4`}>
                {recs.isPending && <LoadingLines label="Finding a meal for the day you're having" />}
                {recs.isError && <p className="m-0 text-sm text-ink-soft">Suggestions aren't available right now. They return on their own.</p>}
                {recs.data && recs.data.recipes.length === 0 && <p className="m-0 text-sm text-ink-soft">No recipe fits what's left of today. Check back after your next meal.</p>}
                {recs.data && recs.data.recipes.length > 0 && <Suggestions recipes={recs.data.recipes} />}
              </div>
            </Section>

            <section aria-labelledby="meals-title">
              <div className="flex items-baseline justify-between px-5 pt-[1.375rem] pb-2">
                <h2 id="meals-title" className="m-0 text-lg font-bold">
                  Meals today
                </h2>
                {meals.data && meals.data.length > 0 && (
                  <span className="text-xs text-ink-soft">
                    {meals.data.length} logged · {kcal(eatenToday)} kcal
                  </span>
                )}
              </div>
              <QueuedMealsNotice />
              {meals.isPending && (
                <div className={`${cardClass} p-4`}>
                  <LoadingLines label="Loading meals" />
                </div>
              )}
              {meals.isError && (
                <div className={`${cardClass} p-4`}>
                  <LoadFailed title="Meals didn't load" onRetry={() => meals.refetch()}>
                    Nothing is lost. Check your connection and try again.
                  </LoadFailed>
                </div>
              )}
              {meals.data?.length === 0 && (
                <div className="mx-4 flex flex-col items-start gap-3 rounded-card border-[1.5px] border-dashed border-rule-strong p-[1.125rem]">
                  <p className="m-0 text-md font-bold">No meals yet today</p>
                  <p className="m-0 text-sm text-pretty text-ink-soft">Snap your first plate and we'll read it against your sleep and stress.</p>
                  <Button variant="soft" className={softButton} onClick={open("meal")}>
                    <span aria-hidden>+</span>
                    Log a meal
                  </Button>
                </div>
              )}
              {meals.data && meals.data.length > 0 && <MealList meals={meals.data} />}
            </section>
          </>
        )}
      </Screen>

      <ActionBar>
        <Button className="flex-[1.5] px-2 text-base shadow-action" onClick={open("meal")}>
          <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 8h3l2-2.5h6L17 8h3v11H4z" strokeLinejoin="round" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
          Log a meal
        </Button>
        <Button variant="quiet" className="h-14 flex-1 bg-paper px-2 text-base" onClick={open("check-in")}>
          Check in
        </Button>
      </ActionBar>

      <LogMealSheet open={sheet === "meal"} onOpenChange={close} />
      <CheckInSheet open={sheet === "check-in"} onOpenChange={close} />
      <LogSleepSheet open={sheet === "sleep"} onOpenChange={close} />
      <LogScreenTimeSheet open={sheet === "screens"} onOpenChange={close} />
    </>
  );
}

/** "Sharp, calm": the first word keeps its capital, the rest read as a sentence. */
const sentence = (words: string[]) => words.map((word, i) => (i ? word.toLowerCase() : word)).join(", ");

function Calories({ bio }: { bio: BioState }) {
  const { caloriesEaten: eaten, calorieTarget: target } = bio;
  const left = target - eaten;
  const over = left < 0;
  const macros = [
    ["Protein", bio.macrosEaten.proteinG, bio.macroTargets.proteinG],
    ["Carbs", bio.macrosEaten.carbsG, bio.macroTargets.carbsG],
    ["Fat", bio.macrosEaten.fatG, bio.macroTargets.fatG],
  ] as const;
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <p className={`m-0 text-xl font-extrabold tracking-[-0.015em] ${over ? "text-beet" : ""}`}>
          {kcal(Math.abs(left))} kcal {over ? "over" : "left"}
        </p>
        <p className="m-0 text-xs text-ink-soft">{eaten > 0 ? `${kcal(eaten)} of ${kcal(target)} eaten` : "Nothing eaten yet"}</p>
      </div>
      <div
        role="progressbar"
        aria-label="Calories eaten"
        aria-valuemin={0}
        aria-valuemax={target}
        aria-valuenow={Math.round(Math.min(eaten, target))}
        className="mt-2.5 h-2 rounded-pill bg-track"
      >
        <div className={`h-full rounded-pill ${over ? "bg-beet" : "bg-synapse"}`} style={{ width: `${Math.min(100, (eaten / target) * 100)}%` }} />
      </div>
      {over && <p className="mt-2 mb-0 text-xs leading-[1.4] text-beet">Over today's target. No need to make up for it tomorrow.</p>}
      <dl className="m-0 mt-3.5 grid grid-cols-3 gap-3.5">
        {macros.map(([name, got, goal]) => (
          <div key={name} className="flex min-w-0 flex-col gap-[5px]">
            <div className="flex justify-between gap-1">
              <dt className="text-xs font-bold">{name}</dt>
              <dd className="m-0 text-2xs text-ink-soft tabular-nums">{Math.round(got)} g</dd>
            </div>
            <span aria-hidden className="block h-[5px] rounded-pill bg-track">
              <span className={`block h-full rounded-pill ${got > goal ? "bg-glucose" : "bg-ion"}`} style={{ width: `${Math.min(100, (got / goal) * 100)}%` }} />
            </span>
            <span className="text-3xs text-ink-faint">of {Math.round(goal)} g</span>
          </div>
        ))}
      </dl>
    </>
  );
}

const meta = (recipe: RecipeRecommendation) => `${recipe.minutes} min · ${kcal(recipe.calories)} kcal`;

function Suggestions({ recipes }: { recipes: RecipeRecommendation[] }) {
  const [first, ...more] = recipes as [RecipeRecommendation, ...RecipeRecommendation[]];
  const [showMore, setShowMore] = useState(false);
  return (
    <>
      <article className="flex flex-col gap-2.5">
        <div>
          <h3 className="m-0 text-lg leading-[1.25] font-extrabold">
            <a href={first.sourceUrl} target="_blank" rel="noreferrer" className="text-ink no-underline hover:underline hover:underline-offset-4">
              {first.title}
            </a>
          </h3>
          <p className="m-0 mt-1 text-xs text-ink-soft">{meta(first)}</p>
        </div>
        <p className="m-0 flex flex-wrap gap-1.5">
          {(
            [
              [first.macros.proteinG, "protein"],
              [first.macros.carbsG, "carbs"],
              [first.macros.fatG, "fat"],
            ] as const
          ).map(([grams, label]) => (
            <span key={label} className="flex h-7 items-center gap-1 rounded-pill bg-mist px-2.5 text-2xs font-semibold">
              <b className="font-extrabold">{Math.round(grams)} g</b>
              {label}
            </span>
          ))}
        </p>
        <p className="m-0 border-t border-rule pt-2.5 text-sm text-pretty">
          <b className="font-bold text-ion-ink">Why it fits: </b>
          {first.reasoning}
        </p>
      </article>
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs text-ink-faint">Recipe from {first.sourceName}</span>
        {more.length > 0 && (
          <Button variant="text" className="h-11 pr-1 pl-3 text-sm" aria-expanded={showMore} onClick={() => setShowMore((shown) => !shown)}>
            {showMore ? "Fewer ideas" : "More ideas"}
          </Button>
        )}
      </div>
      {showMore && (
        <ul className="m-0 flex list-none flex-col border-t border-rule p-0">
          {more.map((recipe) => (
            <li key={recipe.id} className="flex justify-between gap-2.5 border-b border-rule py-2.5">
              <a href={recipe.sourceUrl} target="_blank" rel="noreferrer" className="text-sm font-semibold text-ink no-underline hover:underline hover:underline-offset-4">
                {recipe.title}
              </a>
              <span className="text-xs whitespace-nowrap text-ink-soft">{meta(recipe)}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function MealList({ meals }: { meals: Meal[] }) {
  const remove = useDeleteMeal();
  const toast = useToast();

  return (
    <ol className={`${cardClass} m-0 list-none overflow-hidden p-0`}>
      {meals.map((meal) => {
        const name = meal.items.map((item) => item.name).join(", ");
        const high = meal.items.some((item) => item.glycemicLoad === "high");
        const removing = remove.isPending && remove.variables === meal.id;
        return (
          <li key={meal.id} className="grid grid-cols-[2.75rem_minmax(0,1fr)_auto] gap-2.5 border-t border-rule py-3 pr-2 pl-3.5 first:border-t-0">
            <time dateTime={meal.eatenAt} className="pt-px text-xs font-semibold text-ink-soft tabular-nums">
              {clock(meal.eatenAt)}
            </time>
            <div className="flex min-w-0 flex-col gap-[3px]">
              <span className="text-2xs font-bold tracking-[0.015em] text-ink-soft">{mealKindLabel[meal.kind]}</span>
              <h3 className="m-0 text-md leading-[1.3] font-semibold">{name}</h3>
              {high && <span className="mt-[3px] flex h-[1.375rem] items-center self-start rounded-pill bg-glucose-soft px-2 text-3xs font-bold text-glucose-ink">High glycemic load</span>}
            </div>
            <div className="flex flex-col items-end">
              <span className="pt-px pr-1.5 text-sm font-bold whitespace-nowrap tabular-nums">{kcal(mealCalories(meal))} kcal</span>
              <button
                type="button"
                aria-label={`Remove ${name}`}
                disabled={removing}
                onClick={() =>
                  remove.mutate(meal.id, {
                    onSuccess: () => toast("Meal removed", "info"),
                    onError: () => toast("Couldn't remove the meal. Try again.", "problem"),
                  })
                }
                className="h-9 cursor-pointer px-1.5 text-xs font-semibold text-ink-soft hover:text-beet disabled:opacity-45"
              >
                {removing ? "Removing…" : "Remove"}
              </button>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
