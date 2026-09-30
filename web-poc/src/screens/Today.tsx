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
import { SignOutLink } from "../components/SignOutLink";
import { SuggestedMeal } from "../components/SuggestedMeal";
import { useToast } from "../components/Toast";
import { CheckInSheet } from "../features/check-in/CheckInSheet";
import { LogSleepSheet } from "../features/log-sleep/LogSleepSheet";
import { LogMealSheet } from "../features/log-meal/LogMealSheet";
import { formatDay } from "../lib/format";

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
      <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-32 sm:px-8 lg:grid lg:grid-cols-[22rem_1fr] lg:gap-16 lg:pt-12 lg:pb-16">
        <section aria-labelledby="day" className="flex flex-col items-center gap-5 lg:sticky lg:top-12 lg:items-start lg:self-start">
          <div className="flex w-full items-baseline justify-between gap-4">
            <h1 id="day" className="m-0 text-lg font-semibold">
              {formatDay()}
            </h1>
            <nav aria-label="More" className="flex gap-4 text-sm">
              <Link href="/history" className="text-ink-soft underline decoration-rule underline-offset-4 hover:text-ink">
                This week
              </Link>
              <Link href="/welcome" className="text-ink-soft underline decoration-rule underline-offset-4 hover:text-ink">
                Edit profile
              </Link>
              <SignOutLink />
            </nav>
          </div>

          {bio.isPending && <p className="m-0 self-start text-ink-soft">Loading your day…</p>}
          {bio.isError && (
            <div role="alert" className="self-start">
              <p className="m-0 text-beet">Today's numbers didn't load. Check your connection and try again.</p>
              <Button variant="text" className="mt-1 -ml-1" onClick={() => bio.refetch()}>
                Try again
              </Button>
            </div>
          )}
          {bio.data && (
            <>
              <BioStateDial
                calorieTarget={bio.data.calorieTarget}
                caloriesEaten={bio.data.caloriesEaten}
                macrosEaten={bio.data.macrosEaten}
                macroTargets={bio.data.macroTargets}
              />
              <MacroLegend eaten={bio.data.macrosEaten} targets={bio.data.macroTargets} />
              <div className="w-full max-w-[20rem] border-t border-rule pt-4">
                <FlagSummary flags={bio.data.cognitiveFlags} />
              </div>
            </>
          )}

          <div className="hidden w-full gap-3 pt-2 lg:flex">{actions}</div>
        </section>

        <div className="mt-10 flex flex-col gap-10 lg:mt-0">
          <section aria-labelledby="focus">
            <h2 id="focus" className="mt-0 mb-3 text-xl">
              Focus today
            </h2>
            {focus.isPending && <p className="m-0 text-ink-soft">Working out today's Focus Score…</p>}
            {focus.isError && <p className="m-0 text-beet">The Focus Score didn't load. Try again shortly.</p>}
            {focus.data && <FocusSummary focus={focus.data} onLogSleep={() => setLoggingSleep(true)} />}
          </section>

          <section aria-labelledby="meals">
            <h2 id="meals" className="mt-0 mb-3 text-xl">
              Meals today
            </h2>
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

          <section aria-labelledby="next">
            <h2 id="next" className="mt-0 mb-3 text-xl">
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
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-rule bg-mist px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
        <div className="mx-auto flex max-w-[34rem] gap-3">{actions}</div>
      </div>

      <LogMealSheet open={logging} onOpenChange={setLogging} />
      <CheckInSheet open={checkingIn} onOpenChange={setCheckingIn} />
      <LogSleepSheet open={loggingSleep} onOpenChange={setLoggingSleep} />
    </>
  );
}
