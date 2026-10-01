"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { RequestFailed } from "../api/client";
import { useBioState, useDeleteMeal, useFocusScore, useMeals, useNextRecommendations, useProfile } from "../api/queries";
import { BioStateDial } from "../components/BioStateDial";
import { Button } from "../components/Button";
import { FlagSummary } from "../components/FlagSummary";
import { FocusSummary } from "../components/FocusSummary";
import { MacroLegend } from "../components/MacroLegend";
import { MealTimeline } from "../components/MealTimeline";
import { QueuedMealsNotice } from "../components/OfflineMeals";
import { SuggestedMeal } from "../components/SuggestedMeal";
import { useToast } from "../components/Toast";
import { CheckInSheet } from "../features/check-in/CheckInSheet";
import { LogSleepSheet } from "../features/log-sleep/LogSleepSheet";
import { LogMealSheet } from "../features/log-meal/LogMealSheet";
import { formatDay } from "../lib/format";

/** "Morning", "Afternoon" or "Evening" for the local time. */
function greeting(hour = new Date().getHours()) {
  if (hour < 12) return "Morning";
  if (hour < 18) return "Afternoon";
  return "Evening";
}

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
  const removeMeal = useDeleteMeal();
  const toast = useToast();
  const [logging, setLogging] = useState(false);
  const [checkingIn, setCheckingIn] = useState(false);
  const [loggingSleep, setLoggingSleep] = useState(false);

  const [first, ...more] = recs.data?.recipes ?? [];
  if (needsSetup) return null;

  const actions = (
    <>
      <Button className="flex-1 lg:flex-none" onClick={() => setLogging(true)}>
        Log a meal
      </Button>
      <Button variant="quiet" onClick={() => setCheckingIn(true)}>
        Check in
      </Button>
    </>
  );

  return (
    <>
      <main className="relative mx-auto w-full max-w-6xl px-4 pt-6 pb-32 sm:px-8 lg:grid lg:grid-cols-[24rem_1fr] lg:gap-14 lg:pt-10 lg:pb-16">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-80 bg-[radial-gradient(40rem_16rem_at_20%_0%,var(--glow),transparent_70%)]" />

        <header className="col-span-full mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="m-0 text-sm text-ink-soft">{formatDay()}</p>
            <h1 id="day" className="m-0 mt-0.5 text-xl font-semibold">
              {greeting()}
              {profile.data ? `, ${profile.data.displayName}` : ""}
            </h1>
          </div>
          <nav aria-label="More" className="flex flex-wrap justify-end gap-x-4 gap-y-1 pt-1 text-sm">
            <Link href="/history" className="text-ink-soft underline decoration-rule underline-offset-4 hover:text-ink">
              This week
            </Link>
            <Link href="/sleep" className="text-ink-soft underline decoration-rule underline-offset-4 hover:text-ink">
              Sleep
            </Link>
            <Link href="/settings" className="text-ink-soft underline decoration-rule underline-offset-4 hover:text-ink">
              Settings
            </Link>
          </nav>
        </header>

        <section aria-labelledby="focus" className="lg:sticky lg:top-10 lg:self-start">
          <h2 id="focus" className="sr-only">
            Focus today
          </h2>
          {focus.isPending && <p className="m-0 text-ink-soft">Working out today's Focus Score…</p>}
          {focus.isError && <p className="m-0 text-beet">The Focus Score didn't load. Try again shortly.</p>}
          {focus.data && <FocusSummary focus={focus.data} onLogSleep={() => setLoggingSleep(true)} />}
          <div className="mt-6 hidden gap-3 lg:flex">{actions}</div>
        </section>

        <div className="mt-10 flex flex-col gap-8 lg:mt-0">
          <section aria-labelledby="energy" className="rounded-card bg-paper p-5 ring-1 ring-rule ring-inset sm:p-6">
            <h2 id="energy" className="mt-0 mb-4 text-lg">
              Energy today
            </h2>
            {bio.isPending && <p className="m-0 text-ink-soft">Loading your day…</p>}
            {bio.isError && (
              <div role="alert">
                <p className="m-0 text-beet">Today's numbers didn't load. Check your connection and try again.</p>
                <Button variant="text" className="mt-1 -ml-1" onClick={() => bio.refetch()}>
                  Try again
                </Button>
              </div>
            )}
            {bio.data && (
              <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start sm:gap-8">
                <div className="w-full max-w-[13rem] shrink-0">
                  <BioStateDial
                    calorieTarget={bio.data.calorieTarget}
                    caloriesEaten={bio.data.caloriesEaten}
                    macrosEaten={bio.data.macrosEaten}
                    macroTargets={bio.data.macroTargets}
                  />
                </div>
                <div className="flex w-full min-w-0 flex-col gap-4">
                  <MacroLegend eaten={bio.data.macrosEaten} targets={bio.data.macroTargets} />
                  <div className="border-t border-rule pt-4">
                    <FlagSummary flags={bio.data.cognitiveFlags} />
                  </div>
                </div>
              </div>
            )}
          </section>

          <section aria-labelledby="next" className="rounded-card bg-[linear-gradient(145deg,color-mix(in_oklab,var(--glucose)_14%,var(--paper)),var(--paper))] p-5 ring-1 ring-rule ring-inset sm:p-6">
            <h2 id="next" className="mt-0 mb-3 text-lg">
              What to eat next
            </h2>
            {recs.isPending && <p className="m-0 text-ink-soft">Finding recipes for how you feel…</p>}
            {recs.isError && <p className="m-0 text-beet">Suggestions didn't load. They'll return when you're back online.</p>}
            {first && <SuggestedMeal recipe={first} />}
            {more.length > 0 && (
              <details className="group mt-4">
                <summary className="cursor-pointer text-ink-soft hover:text-ink">
                  {more.length} more {more.length === 1 ? "idea" : "ideas"}
                </summary>
                <div className="mt-2 flex flex-col gap-6">
                  {more.map((recipe) => (
                    <SuggestedMeal key={recipe.id} recipe={recipe} />
                  ))}
                </div>
              </details>
            )}
          </section>

          <section aria-labelledby="meals">
            <h2 id="meals" className="mt-0 mb-3 text-lg">
              Meals today
            </h2>
            <QueuedMealsNotice />
            {meals.isPending && <p className="m-0 text-ink-soft">Loading meals…</p>}
            {meals.isError && <p className="m-0 text-beet">Meals didn't load. Pull to refresh or try again shortly.</p>}
            {meals.data && (
              <MealTimeline
                meals={meals.data}
                removingId={removeMeal.isPending ? removeMeal.variables : undefined}
                onRemove={(meal) =>
                  removeMeal.mutate(meal.id, {
                    onSuccess: () => toast("Meal removed"),
                    onError: () => toast("The meal wasn't removed. Try again.", "problem"),
                  })
                }
              />
            )}
          </section>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 bg-[linear-gradient(transparent,var(--mist)_35%)] px-4 pt-6 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <div className="mx-auto flex max-w-[34rem] gap-3">{actions}</div>
      </div>

      <LogMealSheet open={logging} onOpenChange={setLogging} />
      <CheckInSheet open={checkingIn} onOpenChange={setCheckingIn} />
      <LogSleepSheet open={loggingSleep} onOpenChange={setLoggingSleep} />
    </>
  );
}
