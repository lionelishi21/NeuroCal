"use client";

import type { FocusScore, Meal, RecipeRecommendation } from "@neurocal/contracts";
import { mealCalories } from "@neurocal/contracts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RequestFailed } from "../api/client";
import { useBioState, useDeleteMeal, useFocusScore, useMeals, useNextRecommendations, useProfile } from "../api/queries";
import { Button } from "../components/Button";
import { FocusRing } from "../components/FocusRing";
import { LogoMark } from "../components/Logo";
import { QueuedMealsNotice } from "../components/OfflineMeals";
import { useToast } from "../components/Toast";
import { CheckInSheet } from "../features/check-in/CheckInSheet";
import { LogMealSheet } from "../features/log-meal/LogMealSheet";
import { LogScreenTimeSheet } from "../features/log-screen-time/LogScreenTimeSheet";
import { LogSleepSheet } from "../features/log-sleep/LogSleepSheet";
import { formatDay, formatTime, kcal, mealKindLabel } from "../lib/format";

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

const card = "rounded-card border border-rule bg-paper";
const sectionTitle = "m-0 text-lg font-bold";

/**
 * Today: the Focus Score with the four signals behind it, calories left, what
 * to eat next and the day's meals. Missing signals ask to be logged in place.
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
  const factors: { key: Component; name: string; detail: string; action?: { label: string; open(): void }; passive?: string }[] = [
    { key: "sleep", name: "Sleep", detail: "Last night", action: { label: "Log", open: open("sleep") } },
    { key: "timing", name: "Evening", detail: "Late food and screens", action: { label: "Log", open: open("screens") } },
    { key: "glycemic", name: "Glycemic load", detail: "Yesterday's food", passive: "Builds from your meals" },
    { key: "stress", name: "Stress", detail: "Recent check-ins", action: { label: "Check in", open: open("check-in") } },
  ];
  const signals = components ? factors.filter((f) => components[f.key] !== null).length : 0;

  return (
    <>
      <main className="mx-auto w-full max-w-[30rem] pb-32">
        <header className="flex items-center justify-between pt-6 pr-3 pl-5">
          <div className="flex items-center gap-2.5">
            <LogoMark className="size-[1.875rem]" />
            <div>
              <h1 className="m-0 text-[1.625rem] leading-[1.05] font-extrabold tracking-[-0.015em]">Today</h1>
              <p className="m-0 text-xs font-medium text-ink-soft">{formatDay()}</p>
            </div>
          </div>
          <Link href="/settings" aria-label="Settings" className="grid size-11 place-items-center text-ink-soft hover:text-ink">
            <svg viewBox="0 0 24 24" aria-hidden className="size-[1.375rem]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
            </svg>
          </Link>
        </header>

        <section aria-labelledby="focus-title" className="mx-4 mt-4 grid grid-cols-[7.25rem_minmax(0,1fr)] items-center gap-4 rounded-hero border border-rule bg-paper p-4">
          <FocusRing score={focus.data?.score ?? null} size={116} stroke={17}>
            <span className={`text-figure leading-none font-extrabold tracking-[-0.03em] tabular-nums ${focus.data?.score == null ? "text-ink-faint" : ""}`}>
              {focus.data?.score ?? "–"}
            </span>
            {focus.data?.score != null && <span className="mt-0.5 text-2xs font-medium text-ink-soft">of 100</span>}
          </FocusRing>
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id="focus-title" className="m-0 text-xs font-semibold text-synapse-ink">
              Focus score
            </h2>
            {focus.isPending && <p className="m-0 text-sm text-ink-soft">Working out today's score…</p>}
            {focus.isError && (
              <p role="alert" className="m-0 text-sm text-beet">
                The score didn't load. Try again shortly.
              </p>
            )}
            {focus.data && (
              <>
                <p className="m-0 text-[1.3125rem] leading-[1.2] font-bold">{focus.data.score === null ? "No score yet" : scoreWord(focus.data.score)}</p>
                <p className="m-0 text-sm leading-[1.45] text-pretty text-ink-soft">{focus.data.explanation}</p>
                {(components?.sleep === null || focus.data.score === null) && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {components?.sleep === null && (
                      <Button className="h-10 px-4 text-sm" onClick={open("sleep")}>
                        Log sleep
                      </Button>
                    )}
                    {focus.data.score === null && (
                      <Button variant="quiet" className="h-10 px-3.5" onClick={open("check-in")}>
                        Check in
                      </Button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </section>

        <section aria-labelledby="shaping-title">
          <div className="flex items-baseline justify-between px-5 pt-6 pb-2">
            <h2 id="shaping-title" className={sectionTitle}>
              What's shaping it
            </h2>
            {components && <span className="text-xs font-medium text-ink-soft">{signals} of 4 signals</span>}
          </div>
          <ul className={`mx-4 mb-0 list-none overflow-hidden p-0 ${card}`}>
            {factors.map((factor, i) => {
              const value = components?.[factor.key] ?? null;
              const read = value === null ? null : reading(value);
              return (
                <li key={factor.key} className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3 pr-3.5 pl-4 ${i ? "border-t border-rule" : ""}`}>
                  <div className="min-w-0">
                    <p className="m-0 text-md font-semibold">{factor.name}</p>
                    <p className="m-0 text-xs text-ink-soft">{factor.detail}</p>
                  </div>
                  {read ? (
                    <div className="flex min-w-24 flex-col items-end gap-1.5">
                      <span className={`text-md font-bold ${read.good ? "text-chlorophyll" : "text-glucose-ink"}`}>{read.word}</span>
                      <span aria-hidden className="block h-[5px] w-[5.25rem] rounded-pill bg-track">
                        <span className={`block h-full rounded-pill ${read.good ? "bg-chlorophyll-bar" : "bg-glucose"}`} style={{ width: `${Math.round(value! * 100)}%` }} />
                      </span>
                    </div>
                  ) : factor.action ? (
                    <Button variant="soft" aria-label={`${factor.action.label === "Log" ? `Log ${factor.name.toLowerCase()}` : factor.action.label}`} onClick={factor.action.open}>
                      <span aria-hidden className="text-lg leading-none">
                        +
                      </span>
                      {factor.action.label}
                    </Button>
                  ) : (
                    <span className="max-w-[6.875rem] text-right text-xs font-medium text-ink-faint">{factor.passive}</span>
                  )}
                </li>
              );
            })}
          </ul>
          {components?.stress != null && (
            <Button variant="text" className="mx-4 mt-2 h-11" onClick={open("check-in")}>
              Check in
            </Button>
          )}
        </section>

        <section aria-label="Calories today" className={`mx-4 mt-5 p-4 ${card}`}>
          {bio.isPending && <p className="m-0 text-sm text-ink-soft">Loading your day…</p>}
          {bio.isError && (
            <div role="alert">
              <p className="m-0 text-sm text-beet">Today's numbers didn't load. Check your connection and try again.</p>
              <Button variant="text" className="mt-1 -ml-1" onClick={() => bio.refetch()}>
                Try again
              </Button>
            </div>
          )}
          {bio.data && <Calories eaten={bio.data.caloriesEaten} target={bio.data.calorieTarget} macros={bio.data.macrosEaten} />}
        </section>

        <section aria-labelledby="next-title" className={`mx-4 mt-5 p-4 ${card}`}>
          <h2 id="next-title" className="m-0 text-xs font-semibold text-synapse-ink">
            What to eat next
          </h2>
          {recs.isPending && <p className="mt-1 mb-0 text-sm text-ink-soft">Finding a meal for the day you're having…</p>}
          {recs.isError && <p className="mt-1 mb-0 text-sm text-ink-soft">Suggestions aren't available right now. They return on their own.</p>}
          {recs.data && recs.data.recipes.length === 0 && <p className="mt-1 mb-0 text-sm text-ink-soft">No recipe fits what's left of today. Check back after your next meal.</p>}
          {recs.data && recs.data.recipes.length > 0 && <Suggestions recipes={recs.data.recipes} />}
        </section>

        <section aria-labelledby="meals-title">
          <h2 id="meals-title" className={`px-5 pt-6 pb-1.5 ${sectionTitle}`}>
            Meals today
          </h2>
          <div className="mx-4">
            <QueuedMealsNotice />
            {meals.isPending && <p className="m-0 text-sm text-ink-soft">Loading meals…</p>}
            {meals.isError && <p className="m-0 text-sm text-beet">Meals didn't load. Check your connection and try again.</p>}
            {meals.data?.length === 0 && (
              <p className="m-0 rounded-card border-[1.5px] border-dashed border-rule-strong p-4 text-sm leading-[1.45] text-pretty text-ink-soft">
                Nothing yet. Snap your first meal and NeuroCal will read it against your sleep and stress.
              </p>
            )}
            {meals.data && meals.data.length > 0 && <MealList meals={meals.data} />}
          </div>
        </section>

        <nav aria-label="More" className="mx-4 mt-6 flex gap-2">
          <Link href="/history" className="grid h-12 flex-1 place-items-center rounded-pill border-[1.5px] border-rule-strong text-sm font-bold text-synapse-ink hover:border-ink-soft">
            This week
          </Link>
          <Link href="/sleep" className="grid h-12 flex-1 place-items-center rounded-pill border-[1.5px] border-rule-strong text-sm font-bold text-synapse-ink hover:border-ink-soft">
            Sleep and evenings
          </Link>
        </nav>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 bg-[linear-gradient(to_bottom,transparent,var(--mist)_40%)] px-4 pt-4 pb-[max(1.375rem,env(safe-area-inset-bottom))]">
        <Button className="mx-auto flex w-full max-w-[28rem] shadow-action" onClick={open("meal")}>
          <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 8h3l2-2.5h6L17 8h3v11H4z" strokeLinejoin="round" />
            <circle cx="12" cy="13" r="3.5" />
          </svg>
          Log a meal
        </Button>
      </div>

      <LogMealSheet open={sheet === "meal"} onOpenChange={close} />
      <CheckInSheet open={sheet === "check-in"} onOpenChange={close} />
      <LogSleepSheet open={sheet === "sleep"} onOpenChange={close} />
      <LogScreenTimeSheet open={sheet === "screens"} onOpenChange={close} />
    </>
  );
}

function Calories({ eaten, target, macros }: { eaten: number; target: number; macros: { proteinG: number; carbsG: number; fatG: number } }) {
  const left = target - eaten;
  const over = left < 0;
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <p className={`m-0 text-xl font-extrabold tracking-[-0.015em] ${over ? "text-beet" : ""}`}>
          {kcal(Math.abs(left))} kcal {over ? "over" : "left"}
        </p>
        <p className="m-0 text-xs font-medium text-ink-soft">{eaten > 0 ? `${kcal(eaten)} of ${kcal(target)} eaten` : "Nothing eaten yet"}</p>
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
      {eaten > 0 && (
        <p className="mt-3 mb-0 flex gap-4 text-xs font-medium text-ink-soft">
          {(
            [
              [macros.proteinG, "protein"],
              [macros.carbsG, "carbs"],
              [macros.fatG, "fat"],
            ] as const
          ).map(([grams, name]) => (
            <span key={name}>
              <b className="font-bold text-ink">{Math.round(grams)} g</b> {name}
            </span>
          ))}
        </p>
      )}
    </>
  );
}

function Suggestions({ recipes }: { recipes: RecipeRecommendation[] }) {
  const [first, ...more] = recipes;
  return (
    <>
      <Suggestion recipe={first!} />
      {more.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-sm font-bold text-synapse-ink">
            {more.length} more {more.length === 1 ? "idea" : "ideas"}
          </summary>
          <div className="mt-3 flex flex-col gap-4">
            {more.map((recipe) => (
              <Suggestion key={recipe.id} recipe={recipe} compact />
            ))}
          </div>
        </details>
      )}
    </>
  );
}

function Suggestion({ recipe, compact }: { recipe: RecipeRecommendation; compact?: boolean }) {
  return (
    <article>
      <h3 className="mt-1 mb-0 text-lg font-bold">
        <a href={recipe.sourceUrl} target="_blank" rel="noreferrer" className="text-ink hover:underline hover:underline-offset-4">
          {recipe.title}
        </a>
      </h3>
      <p className="mt-0.5 mb-0 text-xs font-medium text-ink-soft">
        {recipe.minutes} min · {kcal(recipe.calories)} kcal · {Math.round(recipe.macros.proteinG)} g protein · {recipe.sourceName}
      </p>
      {!compact && <p className="mt-2.5 mb-0 border-t border-rule pt-2.5 text-sm leading-[1.45] text-pretty">{recipe.reasoning}</p>}
    </article>
  );
}

function MealList({ meals }: { meals: Meal[] }) {
  const remove = useDeleteMeal();
  const toast = useToast();
  const [optionsFor, setOptionsFor] = useState<string | null>(null);

  return (
    <ol className="m-0 list-none p-0">
      {meals.map((meal) => {
        const name = meal.items.map((item) => item.name).join(", ");
        const high = meal.items.some((item) => item.glycemicLoad === "high");
        const removing = remove.isPending && remove.variables === meal.id;
        return (
          <li key={meal.id} className="border-b border-rule py-2.5">
            <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_2.25rem] items-center gap-2.5">
              <time dateTime={meal.eatenAt} className="min-w-[2.875rem] text-xs font-semibold whitespace-nowrap text-ink-soft">
                {formatTime(meal.eatenAt)}
              </time>
              <div className="min-w-0">
                <h3 className="m-0 truncate text-md font-semibold">{name}</h3>
                <p className={`m-0 text-xs ${high ? "text-glucose-ink" : "text-ink-soft"}`}>
                  {mealKindLabel[meal.kind]}
                  {high && " · high glycemic load"}
                </p>
              </div>
              <span className="text-sm font-bold whitespace-nowrap">{kcal(mealCalories(meal))} kcal</span>
              <button
                type="button"
                aria-label={`Options for ${name}`}
                aria-expanded={optionsFor === meal.id}
                onClick={() => setOptionsFor((id) => (id === meal.id ? null : meal.id))}
                className="grid h-11 w-9 cursor-pointer place-items-center text-lg font-bold text-ink-soft hover:text-ink"
              >
                ⋯
              </button>
            </div>
            {optionsFor === meal.id && (
              <div className="mt-1 flex justify-end">
                <Button
                  variant="soft"
                  disabled={removing}
                  onClick={() =>
                    remove.mutate(meal.id, {
                      onSuccess: () => toast("Meal removed"),
                      onError: () => toast("The meal wasn't removed. Try again.", "problem"),
                    })
                  }
                >
                  {removing ? "Removing…" : "Remove meal"}
                </Button>
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}
