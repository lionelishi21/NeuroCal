"use client";

import { useEffect, useId, useState } from "react";
import { type AnalyzeMealResponse, type FoodItem, MealKind } from "@neurocal/contracts";
import { useAnalyzeMeal, useCreateMeal } from "../../api/queries";
import { Button } from "../../components/Button";
import { Sheet } from "../../components/Sheet";
import { useToast } from "../../components/Toast";
import { kcal, mealKindForHour, mealKindLabel, nowWithOffset } from "../../lib/format";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const glLabel = { low: "GL low", medium: "GL medium", high: "GL high" } as const;
const glColor = { low: "text-chlorophyll", medium: "text-glucose-ink", high: "text-beet" } as const;

const problemText: Record<NonNullable<AnalyzeMealResponse["problem"]>, string> = {
  too_dark: "The photo is too dark to read. Try again with more light on the plate.",
  no_food_found: "No food found in that photo. Try a closer shot of the plate.",
  blurry: "The photo is blurry. Hold the phone steady and try again.",
};

export function LogMealSheet({ open, onOpenChange }: Props) {
  const inputId = useId();
  const [photoUrl, setPhotoUrl] = useState<string>();
  const [items, setItems] = useState<(FoodItem & { included: boolean })[]>([]);
  const [kind, setKind] = useState<MealKind>(() => mealKindForHour(new Date().getHours()));
  const analyze = useAnalyzeMeal();
  const createMeal = useCreateMeal();
  const toast = useToast();

  useEffect(() => () => void (photoUrl && URL.revokeObjectURL(photoUrl)), [photoUrl]);

  const reset = () => {
    setPhotoUrl(undefined);
    setItems([]);
    setKind(mealKindForHour(new Date().getHours()));
    analyze.reset();
    createMeal.reset();
  };

  const close = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const choosePhoto = (file: File | undefined) => {
    if (!file) return;
    setPhotoUrl(URL.createObjectURL(file));
    setItems([]);
    analyze.mutate(file, {
      onSuccess: (result) => setItems(result.items.map((item) => ({ ...item, included: true }))),
    });
  };

  const chosen = items.filter((i) => i.included);
  const total = chosen.reduce((sum, i) => sum + i.calories, 0);
  const problem = analyze.data?.problem;

  const logMeal = () =>
    createMeal.mutate(
      { kind, eatenAt: nowWithOffset(), items: chosen.map(({ included: _, ...item }) => item) },
      {
        onSuccess: () => {
          toast("Meal logged");
          close(false);
        },
      },
    );

  return (
    <Sheet
      open={open}
      onOpenChange={close}
      title="Log a meal"
      description="Take a photo of your plate. You can check every item before it's logged."
    >
      <input
        id={inputId}
        type="file"
        accept="image/*"
        capture="environment"
        className="peer sr-only"
        onChange={(e) => choosePhoto(e.target.files?.[0])}
      />
      <label
        htmlFor={inputId}
        className="relative flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-card border-2 border-dashed border-rule bg-[radial-gradient(circle_at_50%_40%,var(--glow),var(--mist)_70%)] text-center peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-synapse hover:border-ink-soft"
      >
        {photoUrl ? (
          <>
            <img src={photoUrl} alt="Your meal" className="absolute inset-0 size-full object-cover" />
            <span className="absolute bottom-3 rounded-pill bg-paper px-4 py-1.5 text-sm text-ink">Use a different photo</span>
          </>
        ) : (
          <>
            <span className="text-lg font-semibold text-ink">Take or choose a photo</span>
            <span className="max-w-[18rem] text-sm text-ink-soft">One plate per photo works best, shot from above.</span>
          </>
        )}
      </label>

      <div aria-live="polite" className="mt-5">
        {analyze.isPending && <p className="m-0 text-ink-soft">Reading your plate…</p>}
        {analyze.isError && (
          <p role="alert" className="m-0 text-beet">
            The photo couldn't be analyzed. Check your connection and choose it again.
          </p>
        )}
        {problem && (
          <p role="alert" className="m-0 text-beet">
            {problemText[problem]}
          </p>
        )}
      </div>

      {items.length > 0 && (
        <>
          <fieldset className="m-0 mt-2 border-0 p-0">
            <legend className="mb-2 text-base font-semibold">On your plate</legend>
            <ul className="m-0 list-none p-0">
              {items.map((item, index) => (
                <li key={index} className="border-t border-rule">
                  <label className="flex cursor-pointer items-start gap-3 py-3">
                    <input
                      type="checkbox"
                      checked={item.included}
                      onChange={() =>
                        setItems((all) => all.map((it, i) => (i === index ? { ...it, included: !it.included } : it)))
                      }
                      className="mt-1 size-5 accent-[var(--chlorophyll)]"
                    />
                    <span className="min-w-0 flex-1">
                      <span className={`block ${item.included ? "text-ink" : "text-ink-soft line-through"}`}>{item.name}</span>
                      <span className="block text-sm text-ink-soft">
                        {item.portion}
                        {item.confidence !== undefined && item.confidence < 0.85 && ", best guess — check the portion"}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-0.5">
                      <span className="text-base font-semibold tabular-nums text-ink">{kcal(item.calories)}</span>
                      {item.glycemicLoad && (
                        <span className={`text-xs font-bold ${glColor[item.glycemicLoad]}`}>{glLabel[item.glycemicLoad]}</span>
                      )}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>

          <fieldset className="m-0 mt-4 border-0 p-0">
            <legend className="mb-2 text-base font-semibold">Meal</legend>
            <div className="grid grid-cols-4 gap-1 rounded-pill bg-mist p-1">
              {MealKind.options.map((option) => (
                <label key={option} className="relative">
                  <input
                    type="radio"
                    name="meal-kind"
                    value={option}
                    checked={kind === option}
                    onChange={() => setKind(option)}
                    className="peer sr-only"
                  />
                  <span className="block cursor-pointer rounded-pill py-2 text-center text-sm text-ink-soft peer-checked:bg-paper peer-checked:font-semibold peer-checked:text-ink peer-focus-visible:outline-2 peer-focus-visible:outline-synapse">
                    {mealKindLabel[option]}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <dl className="m-0 mt-5 grid grid-cols-4 gap-2 rounded-card bg-mist p-3.5 text-xs text-ink-soft">
            {[
              { label: "kcal", value: kcal(total), color: "text-ink" },
              { label: "Protein", value: `${Math.round(chosen.reduce((n, i) => n + i.macros.proteinG, 0))} g`, color: "text-chlorophyll" },
              { label: "Carbs", value: `${Math.round(chosen.reduce((n, i) => n + i.macros.carbsG, 0))} g`, color: "text-glucose-ink" },
              { label: "Fat", value: `${Math.round(chosen.reduce((n, i) => n + i.macros.fatG, 0))} g`, color: "text-oil" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex flex-col gap-0.5">
                <dt>{label}</dt>
                <dd className={`m-0 text-base font-semibold tabular-nums ${color}`}>{value}</dd>
              </div>
            ))}
          </dl>

          {createMeal.isError && (
            <p role="alert" className="mt-4 mb-0 text-sm text-beet">
              The meal didn't save. Check your connection and try again.
            </p>
          )}
          <Button className="mt-6 w-full" onClick={logMeal} disabled={chosen.length === 0 || createMeal.isPending}>
            {createMeal.isPending ? "Logging…" : `Log meal, ${kcal(total)} kcal`}
          </Button>
        </>
      )}
    </Sheet>
  );
}
