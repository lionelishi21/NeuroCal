"use client";

import { CognitiveGoal, DietaryPreference, type Macros, type UpdateProfileRequest } from "@neurocal/contracts";
import { useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { RequestFailed } from "../api/client";
import { useProfile, useUpdateProfile } from "../api/queries";
import { Button } from "../components/Button";
import { useToast } from "../components/Toast";
import { browserTimeZone, macroCalories, suggestMacros, timeZones } from "../lib/targets";

const dietLabel: Record<DietaryPreference, { name: string; detail: string }> = {
  omnivore: { name: "Everything", detail: "Meat, fish, dairy and plants" },
  pescatarian: { name: "Pescatarian", detail: "Fish and seafood, no meat" },
  vegetarian: { name: "Vegetarian", detail: "No meat or fish" },
  vegan: { name: "Vegan", detail: "Plants only" },
  keto: { name: "Keto", detail: "Very low carb, high fat" },
  mediterranean: { name: "Mediterranean", detail: "Olive oil, fish, grains, vegetables" },
};

const goalLabel: Record<CognitiveGoal, string> = {
  focus: "Sharper focus",
  calm: "Feel calmer",
  energy: "Steadier energy",
  sleep: "Better sleep",
};

const STEPS = ["You", "How you eat", "What you want", "Daily targets"] as const;

interface Draft {
  displayName: string;
  timeZone: string;
  dietaryPreference: DietaryPreference | null;
  cognitiveGoals: CognitiveGoal[];
  dailyCalorieTarget: number;
  macroTargets: Macros;
  /** Once the user edits grams by hand, stop recalculating them. */
  macrosEdited: boolean;
}

/**
 * First-run setup, and "Edit profile" afterwards (pre-filled). Four steps
 * because setup genuinely is a sequence; one plain question per step.
 */
export function Welcome() {
  const router = useRouter();
  const toast = useToast();
  const existing = useProfile();
  const save = useUpdateProfile();
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({
    displayName: "",
    timeZone: browserTimeZone(),
    dietaryPreference: null,
    cognitiveGoals: [],
    dailyCalorieTarget: 2200,
    macroTargets: suggestMacros(2200, "omnivore"),
    macrosEdited: false,
  });

  const editing = existing.isSuccess;
  useEffect(() => {
    if (!existing.data) return;
    const p = existing.data;
    setDraft({
      displayName: p.displayName,
      timeZone: p.timeZone ?? browserTimeZone(),
      dietaryPreference: p.dietaryPreference,
      cognitiveGoals: p.cognitiveGoals,
      dailyCalorieTarget: p.dailyCalorieTarget,
      macroTargets: p.macroTargets,
      macrosEdited: true,
    });
  }, [existing.data]);

  const update = (patch: Partial<Draft>) =>
    setDraft((d) => {
      const next = { ...d, ...patch };
      if (!next.macrosEdited && (patch.dailyCalorieTarget !== undefined || patch.dietaryPreference !== undefined)) {
        next.macroTargets = suggestMacros(next.dailyCalorieTarget, next.dietaryPreference ?? "omnivore");
      }
      return next;
    });

  const canContinue = [
    draft.displayName.trim().length > 0,
    draft.dietaryPreference !== null,
    true,
    Number.isInteger(draft.dailyCalorieTarget) && draft.dailyCalorieTarget >= 1000 && draft.dailyCalorieTarget <= 6000,
  ][step];
  const isLast = step === STEPS.length - 1;

  const submit = () => {
    const body: UpdateProfileRequest = {
      displayName: draft.displayName.trim(),
      timeZone: draft.timeZone,
      dietaryPreference: draft.dietaryPreference!,
      cognitiveGoals: draft.cognitiveGoals,
      dailyCalorieTarget: draft.dailyCalorieTarget,
      macroTargets: draft.macroTargets,
    };
    save.mutate(body, {
      onSuccess: () => {
        toast("Profile saved");
        router.replace("/");
      },
    });
  };

  if (existing.isPending) {
    return <main className="mx-auto max-w-[34rem] px-4 pt-12 text-ink-soft">Loading…</main>;
  }
  if (existing.isError && !(existing.error instanceof RequestFailed && existing.error.status === 404)) {
    return (
      <main role="alert" className="mx-auto max-w-[34rem] px-4 pt-12 text-beet">
        Your profile didn't load. Check your connection and reload the page.
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[34rem] flex-col px-4 pt-8 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:px-6 lg:pt-16">
      <header>
        <p className="m-0 text-sm text-ink-soft">
          {editing ? "Edit profile" : "Set up NeuroCal"}. Step {step + 1} of {STEPS.length}: {STEPS[step]}
        </p>
        <ol aria-hidden className="m-0 mt-3 grid list-none grid-cols-4 gap-1.5 p-0">
          {STEPS.map((name, i) => (
            <li key={name} className={`h-1 rounded-pill ${i <= step ? "bg-chlorophyll" : "bg-rule"}`} />
          ))}
        </ol>
      </header>

      <section className="mt-10 flex-1" aria-live="polite">
        {step === 0 && <StepYou draft={draft} update={update} />}
        {step === 1 && <StepDiet draft={draft} update={update} />}
        {step === 2 && <StepGoals draft={draft} update={update} />}
        {step === 3 && <StepTargets draft={draft} update={update} />}
      </section>

      {save.isError && (
        <p role="alert" className="mt-6 mb-0 text-sm text-beet">
          {save.error instanceof RequestFailed ? save.error.message : "Your profile didn't save. Try again."}
        </p>
      )}

      <nav className="mt-8 flex items-center gap-3">
        {step > 0 ? (
          <Button variant="quiet" onClick={() => setStep((s) => s - 1)}>
            Back
          </Button>
        ) : editing ? (
          <Button variant="quiet" onClick={() => router.push("/")}>
            Cancel
          </Button>
        ) : null}
        <Button
          className="flex-1"
          disabled={!canContinue || save.isPending}
          onClick={() => (isLast ? submit() : setStep((s) => s + 1))}
        >
          {isLast ? (save.isPending ? "Saving…" : "Save profile") : "Continue"}
        </Button>
      </nav>
    </main>
  );
}

interface StepProps {
  draft: Draft;
  update: (patch: Partial<Draft>) => void;
}

const fieldClass =
  "mt-1.5 block w-full rounded-control bg-paper px-3.5 py-3 text-lg text-ink ring-1 ring-rule ring-inset focus:outline-none focus-visible:ring-2 focus-visible:ring-synapse";

function StepYou({ draft, update }: StepProps) {
  const nameId = useId();
  const zoneId = useId();
  return (
    <>
      <h1 className="m-0 text-2xl">What should we call you?</h1>
      <label htmlFor={nameId} className="mt-6 block text-sm text-ink-soft">
        Your name
        <input
          id={nameId}
          autoFocus
          autoComplete="given-name"
          value={draft.displayName}
          onChange={(e) => update({ displayName: e.target.value })}
          className={fieldClass}
        />
      </label>
      <label htmlFor={zoneId} className="mt-6 block text-sm text-ink-soft">
        Time zone
        <select id={zoneId} value={draft.timeZone} onChange={(e) => update({ timeZone: e.target.value })} className={fieldClass}>
          {timeZones(draft.timeZone).map((zone) => (
            <option key={zone} value={zone}>
              {zone.replaceAll("_", " ")}
            </option>
          ))}
        </select>
        <span className="mt-1.5 block">Your day, meals and sleep are counted in this time zone.</span>
      </label>
    </>
  );
}

function StepDiet({ draft, update }: StepProps) {
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="m-0 p-0">
        <h1 className="m-0 text-2xl">How do you eat?</h1>
      </legend>
      <p className="mt-2 mb-5 text-ink-soft">Recipe suggestions stay within this.</p>
      <ul className="m-0 list-none p-0">
        {DietaryPreference.options.map((diet) => (
          <li key={diet} className="border-t border-rule last:border-b">
            <label className="flex cursor-pointer items-center gap-3 py-3.5">
              <input
                type="radio"
                name="diet"
                value={diet}
                checked={draft.dietaryPreference === diet}
                onChange={() => update({ dietaryPreference: diet })}
                className="size-5 accent-[var(--chlorophyll)]"
              />
              <span>
                <span className="block text-base text-ink">{dietLabel[diet].name}</span>
                <span className="block text-sm text-ink-soft">{dietLabel[diet].detail}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

function StepGoals({ draft, update }: StepProps) {
  const toggle = (goal: CognitiveGoal) =>
    update({
      cognitiveGoals: draft.cognitiveGoals.includes(goal)
        ? draft.cognitiveGoals.filter((g) => g !== goal)
        : [...draft.cognitiveGoals, goal],
    });
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="m-0 p-0">
        <h1 className="m-0 text-2xl">What do you want food to do for you?</h1>
      </legend>
      <p className="mt-2 mb-5 text-ink-soft">Pick any that matter. You can skip this.</p>
      <div className="flex flex-wrap gap-2">
        {CognitiveGoal.options.map((goal) => {
          const on = draft.cognitiveGoals.includes(goal);
          return (
            <button
              key={goal}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(goal)}
              className={`rounded-pill px-4 py-2.5 text-base ring-1 ring-inset transition-colors duration-150 ${
                on ? "bg-synapse text-on-accent ring-synapse" : "bg-paper text-ink ring-rule hover:ring-ink-soft"
              }`}
            >
              {goalLabel[goal]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function StepTargets({ draft, update }: StepProps) {
  const kcalId = useId();
  const setMacro = (key: keyof Macros, value: number) =>
    update({ macroTargets: { ...draft.macroTargets, [key]: Math.max(0, value) }, macrosEdited: true });
  const fromMacros = macroCalories(draft.macroTargets);
  const drift = Math.abs(fromMacros - draft.dailyCalorieTarget);

  return (
    <>
      <h1 className="m-0 text-2xl">Your daily targets</h1>
      <p className="mt-2 mb-0 text-ink-soft">A starting point. You can change these any time.</p>

      <label htmlFor={kcalId} className="mt-6 block text-sm text-ink-soft">
        Calories per day
        <input
          id={kcalId}
          type="number"
          inputMode="numeric"
          min={1000}
          max={6000}
          step={50}
          value={Number.isNaN(draft.dailyCalorieTarget) ? "" : draft.dailyCalorieTarget}
          onChange={(e) => update({ dailyCalorieTarget: e.target.valueAsNumber })}
          className={`${fieldClass} tabular-nums`}
        />
        <span className="mt-1.5 block">Between 1,000 and 6,000.</span>
      </label>

      <fieldset className="m-0 mt-6 border-0 p-0">
        <legend className="mb-1.5 p-0 text-sm text-ink-soft">
          Grams per day{draft.macrosEdited ? "" : `, suggested for ${dietLabel[draft.dietaryPreference ?? "omnivore"].name.toLowerCase()}`}
        </legend>
        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ["proteinG", "Protein"],
              ["carbsG", "Carbs"],
              ["fatG", "Fat"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="text-sm text-ink-soft">
              {label}
              <input
                type="number"
                inputMode="numeric"
                min={0}
                value={draft.macroTargets[key]}
                onChange={(e) => setMacro(key, e.target.valueAsNumber || 0)}
                className={`${fieldClass} tabular-nums`}
              />
            </label>
          ))}
        </div>
        <p className={`mt-2 mb-0 text-sm ${drift > 150 ? "text-beet" : "text-ink-soft"}`}>
          These add up to <span className="tabular-nums">{fromMacros.toLocaleString()}</span> kcal
          {drift > 150 ? `, ${drift.toLocaleString()} away from your calorie target.` : "."}
        </p>
        {draft.macrosEdited && (
          <Button
            variant="text"
            className="mt-1 -ml-1 text-sm"
            onClick={() =>
              update({
                macrosEdited: false,
                macroTargets: suggestMacros(draft.dailyCalorieTarget, draft.dietaryPreference ?? "omnivore"),
              })
            }
          >
            Use suggested grams
          </Button>
        )}
      </fieldset>
    </>
  );
}
