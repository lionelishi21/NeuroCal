"use client";

import { type FormEvent, type ReactNode, useEffect, useState } from "react";
import { type AnalyzeMealResponse, type FoodItem, MAX_MEAL_PHOTO_BYTES, MealKind } from "@neurocal/contracts";
import { RequestFailed } from "../../api/client";
import { useAnalyzeMeal, useCreateMeal } from "../../api/queries";
import { Button } from "../../components/Button";
import { Sheet, SheetNote, sheetAction } from "../../components/Sheet";
import { Spinner } from "../../components/Spinner";
import { useToast } from "../../components/Toast";
import { kcal, mealKindForHour, mealKindLabel, nowWithOffset } from "../../lib/format";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const glText = { low: "Low glycemic load", medium: "Medium glycemic load", high: "High glycemic load" } as const;

interface PhotoProblem {
  title: string;
  fix: string;
  /** Show the photo above the message, so the person sees what we saw. */
  preview: boolean;
}

const problems: Record<NonNullable<AnalyzeMealResponse["problem"]>, PhotoProblem> = {
  too_dark: { title: "This photo is too dark", fix: "Turn on a light or move nearer a window, then take it again.", preview: true },
  blurry: { title: "This photo is blurry", fix: "Hold the phone still for a second and tap to focus on the plate.", preview: true },
  no_food_found: { title: "We couldn't find food in this photo", fix: "Make sure the plate fills most of the frame, or add the items by hand.", preview: true },
};
const tooBig: PhotoProblem = { title: "This photo is over 8 MB", fix: "Choose a smaller photo, or take a new one with the camera.", preview: false };

/** An item in the sheet: from the photo, or typed in (`manual`), and ticked or not. */
type DraftItem = FoodItem & { included: boolean; manual?: true };

const smallField = "h-[2.875rem] min-w-0 rounded-[0.75rem] border-[1.5px] bg-paper text-ink placeholder:text-ink-faint focus:border-synapse focus:outline-none";

/**
 * Log a meal in three steps: take or choose a photo, wait while it is read,
 * then check the items before logging. Items can also be typed in, with or
 * without a photo.
 */
export function LogMealSheet({ open, onOpenChange }: Props) {
  const [photoUrl, setPhotoUrl] = useState<string>();
  const [oversized, setOversized] = useState(false);
  const [items, setItems] = useState<DraftItem[]>([]);
  // "Use a different photo" goes back to the first step without losing what was typed in.
  const [picking, setPicking] = useState(false);
  const [byHand, setByHand] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [kind, setKind] = useState<MealKind>(() => mealKindForHour(new Date().getHours()));
  const analyze = useAnalyzeMeal();
  const createMeal = useCreateMeal();
  const toast = useToast();

  useEffect(() => () => void (photoUrl && URL.revokeObjectURL(photoUrl)), [photoUrl]);

  const reset = () => {
    setPhotoUrl(undefined);
    setOversized(false);
    setItems([]);
    setPicking(false);
    setByHand(false);
    setFormOpen(false);
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
    // A new photo replaces the last photo's items; anything typed in stays.
    setItems((all) => all.filter((i) => i.manual));
    analyze.reset();
    if (file.size > MAX_MEAL_PHOTO_BYTES) {
      setPhotoUrl(undefined);
      setOversized(true);
      return;
    }
    setOversized(false);
    setPicking(false);
    setPhotoUrl(URL.createObjectURL(file));
    analyze.mutate(file, {
      onSuccess: (result) => setItems((all) => [...result.items.map((item) => ({ ...item, included: true })), ...all.filter((i) => i.manual)]),
    });
  };

  const chosen = items.filter((i) => i.included);
  const total = chosen.reduce((sum, i) => sum + i.calories, 0);
  const sum = (macro: keyof FoodItem["macros"]) => `${Math.round(chosen.reduce((n, i) => n + i.macros[macro], 0))} g`;
  const highGl = chosen.filter((i) => i.glycemicLoad === "high");
  const fromPhoto = items.filter((i) => !i.manual);

  const problem: PhotoProblem | null = oversized
    ? tooBig
    : analyze.data?.problem
      ? problems[analyze.data.problem]
      : analyze.isError
        ? {
            title: "We couldn't read this photo",
            // A 400 says what is wrong with this photo (too large, not an image); anything else is a hiccup.
            fix: analyze.error instanceof RequestFailed && analyze.error.status === 400 ? analyze.error.message : "Check your connection and choose it again.",
            preview: false,
          }
        : null;

  const step = analyze.isPending ? "reading" : !picking && (items.length > 0 || byHand) ? "items" : "pick";

  const logMeal = () =>
    createMeal.mutate(
      { kind, eatenAt: nowWithOffset(), items: chosen.map(({ included: _, manual: __, ...item }) => item) },
      {
        onSuccess: (result) => {
          if (result === "queued") toast("Saved on this device. We'll upload it later.", "info");
          else toast("Meal logged");
          close(false);
        },
      },
    );

  return (
    <Sheet open={open} onOpenChange={close} title="Log a meal">
      {step === "pick" && (
        <>
          {problem && (
            <div className="flex flex-col gap-3">
              {problem.preview && photoUrl && <img src={photoUrl} alt="Your photo" className="h-[10.625rem] w-full rounded-card object-cover" />}
              <div role="alert" className="flex flex-col gap-1 rounded-control bg-beet-soft px-4 py-3.5">
                <span className="text-md font-extrabold text-beet">{problem.title}</span>
                <span className="text-sm text-ink">{problem.fix}</span>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2.5">
            <PhotoTile label={problem ? "Take it again" : "Take a photo"} camera onFile={choosePhoto} className="bg-synapse text-on-accent">
              <path d="M4 8h3l2-2.5h6L17 8h3v11H4z" strokeLinejoin="round" />
              <circle cx="12" cy="13" r="3.5" />
            </PhotoTile>
            <PhotoTile label="Choose a photo" onFile={choosePhoto} className="bg-synapse-soft text-synapse-ink">
              <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
              <circle cx="9" cy="10" r="1.8" />
              <path d="M20 16l-5-5-8 8.5" />
            </PhotoTile>
          </div>
          <p className="m-0 text-center text-xs text-ink-soft">Photos up to 8 MB. Get the whole plate in, from above.</p>
          <Button
            variant="text"
            className="h-11 text-sm"
            onClick={() => {
              setPicking(false);
              setByHand(true);
              setFormOpen(items.length === 0);
            }}
          >
            Add an item by hand instead
          </Button>
        </>
      )}

      {step === "reading" && (
        <>
          <div className="relative h-[16.25rem] overflow-hidden rounded-hero bg-track">
            {photoUrl && <img src={photoUrl} alt="Your meal photo" className="block size-full object-cover" />}
            <span aria-hidden className="absolute inset-0 bg-scrim opacity-50" />
            <span aria-hidden className="scan-line absolute inset-x-4 h-[3px] rounded-pill bg-ion shadow-[0_0_16px_var(--ion)]" style={{ animation: "scan 2s ease-in-out infinite" }} />
          </div>
          <p role="status" className="m-0 flex items-center justify-center gap-2.5 text-base font-bold">
            <Spinner className="size-[1.125rem] text-synapse" />
            Reading your plate…
          </p>
        </>
      )}

      {step === "items" && (
        <>
          {photoUrl && fromPhoto.length > 0 && (
            <div className="relative h-[8.125rem] overflow-hidden rounded-card bg-track">
              <img src={photoUrl} alt="Your meal photo" className="block size-full object-cover" />
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="absolute right-2.5 bottom-2.5 h-9 cursor-pointer rounded-pill bg-toast px-3 text-xs font-bold text-on-toast opacity-90 hover:opacity-100"
              >
                Use a different photo
              </button>
            </div>
          )}
          {problem && (
            <SheetNote tone="problem" lead={`${problem.title}.`} alert>
              {problem.fix}
            </SheetNote>
          )}

          {items.length > 0 && (
            <fieldset className="m-0 min-w-0 border-0 p-0">
              <legend className="mb-3.5 flex w-full items-baseline justify-between gap-2 p-0">
                <span className="text-md font-bold">{fromPhoto.length ? `We found ${fromPhoto.length} ${fromPhoto.length === 1 ? "item" : "items"}` : "Your items"}</span>
                <span className="text-2xs text-ink-soft">Untick anything we got wrong</span>
              </legend>
              <ul className="m-0 list-none overflow-hidden rounded-[1.125rem] border border-rule p-0">
                {items.map((item, index) => (
                  <li key={index} className="border-t border-rule first:border-t-0">
                    <label className={`grid min-h-14 cursor-pointer grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3.5 py-2.5 ${item.included ? "" : "opacity-60"}`}>
                      <input
                        type="checkbox"
                        checked={item.included}
                        onChange={() => setItems((all) => all.map((it, i) => (i === index ? { ...it, included: !it.included } : it)))}
                        className="peer sr-only"
                      />
                      <span
                        aria-hidden
                        className="grid size-[1.375rem] place-items-center rounded-[0.4375rem] border-2 border-rule-strong text-xs font-extrabold text-transparent peer-checked:border-synapse peer-checked:bg-synapse peer-checked:text-on-accent peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-synapse"
                      >
                        ✓
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-1.5 text-md font-semibold">
                          {item.name}
                          {item.confidence !== undefined && item.confidence < 0.85 && (
                            <span className="flex h-5 items-center rounded-[0.375rem] bg-mist px-[0.4375rem] text-3xs font-bold text-ink-soft">Best guess</span>
                          )}
                        </span>
                        <span className="mt-0.5 block text-2xs text-ink-soft">
                          {item.portion}
                          {item.glycemicLoad && (
                            <>
                              {" · "}
                              <span className={`font-semibold ${item.glycemicLoad === "high" ? "text-glucose-ink" : ""}`}>{glText[item.glycemicLoad]}</span>
                            </>
                          )}
                        </span>
                      </span>
                      <span className="text-sm font-bold tabular-nums">{kcal(item.calories)} kcal</span>
                    </label>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}

          {formOpen ? (
            <ManualItemForm
              onAdd={(item) => {
                setItems((all) => [...all, { ...item, included: true, manual: true }]);
                setFormOpen(false);
              }}
              onCancel={() => {
                setFormOpen(false);
                // Nothing typed and no photo: back to the first step.
                if (items.length === 0) setByHand(false);
              }}
            />
          ) : (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="h-11 cursor-pointer rounded-option border-[1.5px] border-dashed border-rule-strong text-sm font-bold text-synapse-ink hover:border-ink-soft"
            >
              + Add an item by hand
            </button>
          )}

          {items.length > 0 && (
            <>
              <fieldset className="m-0 min-w-0 border-0 p-0">
                <legend className="mb-2 p-0 text-sm font-bold">Meal</legend>
                <div className="grid grid-cols-4 gap-1 rounded-option bg-mist p-1">
                  {MealKind.options.map((option) => (
                    <label key={option} className="relative">
                      <input type="radio" name="meal-kind" value={option} checked={kind === option} onChange={() => setKind(option)} className="peer sr-only" />
                      <span className="grid h-10 cursor-pointer place-items-center rounded-[0.625rem] text-xs font-bold text-ink-soft peer-checked:bg-paper peer-checked:text-synapse-ink peer-focus-visible:outline-2 peer-focus-visible:outline-synapse">
                        {mealKindLabel[option]}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <dl className="m-0 grid grid-cols-4 gap-1.5 rounded-control bg-mist p-3">
                {[
                  { label: "kcal", value: kcal(total) },
                  { label: "protein", value: sum("proteinG") },
                  { label: "carbs", value: sum("carbsG") },
                  { label: "fat", value: sum("fatG") },
                ].map(({ label, value }) => (
                  // Source order is dt → dd (valid HTML); the value reads first visually.
                  <div key={label} className="flex flex-col-reverse text-center">
                    <dt className="text-3xs font-semibold text-ink-soft">{label}</dt>
                    <dd className="m-0 text-lg font-extrabold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>

              {highGl.length > 0 && (
                <SheetNote tone="watch" lead="High glycemic load.">
                  {highGl.map((i) => i.name).join(", ")} may bring a dip in 1 to 2 hours. A 10-minute walk after eating helps.
                </SheetNote>
              )}
              {createMeal.isError && (
                <SheetNote tone="problem" lead="Couldn't save your meal." alert>
                  Check your connection and try again. Nothing's been lost.
                </SheetNote>
              )}
              <Button className={`${sheetAction} shadow-action`} onClick={logMeal} disabled={chosen.length === 0 || createMeal.isPending}>
                {createMeal.isPending && <Spinner className="size-4" />}
                {createMeal.isPending ? "Saving…" : chosen.length === 0 ? "Tick at least one item" : createMeal.isError ? "Try again" : `Log meal, ${kcal(total)} kcal`}
              </Button>
            </>
          )}
        </>
      )}
    </Sheet>
  );
}

/** One of the two big photo choices. A label over a hidden file input, so it opens the camera or the library. */
function PhotoTile({ label, camera = false, onFile, className, children }: { label: string; camera?: boolean; onFile: (file: File | undefined) => void; className: string; children: ReactNode }) {
  return (
    <label className={`flex h-[7.5rem] cursor-pointer flex-col items-center justify-center gap-2.5 rounded-card text-md font-bold has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-synapse ${className}`}>
      <input
        type="file"
        accept="image/*"
        {...(camera ? { capture: "environment" as const } : {})}
        className="sr-only"
        onChange={(e) => {
          onFile(e.target.files?.[0]);
          // The same photo can be chosen again after an error.
          e.target.value = "";
        }}
      />
      <svg viewBox="0 0 24 24" aria-hidden className="size-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
        {children}
      </svg>
      {label}
    </label>
  );
}

const numberOr0 = (value: string) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** The fallback when a photo can't be read, or for food without a photo. Macros are optional and count as 0 when left empty. */
function ManualItemForm({ onAdd, onCancel }: { onAdd: (item: FoodItem) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  const [portion, setPortion] = useState("");
  const [calories, setCalories] = useState("");
  const [macros, setMacros] = useState({ proteinG: "", carbsG: "", fatG: "" });
  const [missing, setMissing] = useState(false);
  const noName = name.trim().length === 0;
  const noCalories = !(Number(calories) > 0);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (noName || noCalories) return setMissing(true);
    onAdd({
      name: name.trim(),
      portion: portion.trim() || "1 portion",
      calories: numberOr0(calories),
      macros: { proteinG: numberOr0(macros.proteinG), carbsG: numberOr0(macros.carbsG), fatG: numberOr0(macros.fatG) },
    });
  };

  const digits = (value: string) => value.replace(/[^\d.]/g, "");
  return (
    <form onSubmit={submit} noValidate aria-label="Add an item by hand" className="flex flex-col gap-2.5 rounded-[1.125rem] bg-mist p-3.5">
      <p className="m-0 text-sm font-bold">Add an item by hand</p>
      <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-2">
        <input
          autoFocus
          aria-label="Food"
          placeholder="Food"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setMissing(false);
          }}
          aria-invalid={missing && noName}
          className={`${smallField} px-3 text-md ${missing && noName ? "border-beet" : "border-rule"}`}
        />
        <input aria-label="Portion" placeholder="Portion" value={portion} onChange={(e) => setPortion(e.target.value)} className={`${smallField} border-rule px-3 text-md`} />
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        <input
          inputMode="numeric"
          aria-label="Calories"
          placeholder="kcal"
          value={calories}
          onChange={(e) => {
            setCalories(digits(e.target.value));
            setMissing(false);
          }}
          aria-invalid={missing && noCalories}
          className={`${smallField} px-2.5 text-md tabular-nums ${missing && noCalories ? "border-beet" : "border-rule"}`}
        />
        {(
          [
            ["proteinG", "Protein"],
            ["carbsG", "Carbs"],
            ["fatG", "Fat"],
          ] as const
        ).map(([key, text]) => (
          <input
            key={key}
            inputMode="decimal"
            aria-label={text}
            placeholder={text}
            value={macros[key]}
            onChange={(e) => setMacros((m) => ({ ...m, [key]: digits(e.target.value) }))}
            className={`${smallField} border-rule px-2 text-xs tabular-nums`}
          />
        ))}
      </div>
      <p aria-live="polite" className={`m-0 text-2xs ${missing ? "font-semibold text-beet" : "text-ink-soft"}`}>
        {missing ? "Add a food name and its calories." : "Protein, carbs and fat are optional, in grams."}
      </p>
      <div className="flex gap-2">
        <Button type="submit" className="h-11 flex-1 text-sm">
          Add item
        </Button>
        <Button variant="text" className="h-11 px-4 text-sm text-ink-soft" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
