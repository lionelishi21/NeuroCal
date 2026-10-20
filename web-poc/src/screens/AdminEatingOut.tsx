"use client";

import type { CatalogFood, SaveEatingOutItemRequest } from "@neurocal/contracts";
import { type FormEvent, useState } from "react";
import { RequestFailed } from "../api/client";
import { useAdminEatingOut, useDeleteEatingOutItem, useSaveEatingOutItem } from "../api/queries";
import { AdminShell } from "../components/AdminShell";
import { Button } from "../components/Button";
import { ScreenFailed, ScreenLoading } from "../components/ListStates";
import { Section, cardClass } from "../components/Screen";
import { useToast } from "../components/Toast";

/** This screen's fields sit on cards, so they take the page colour (as on Products). */
const field =
  "block h-12 w-full rounded-option border-[1.5px] border-rule bg-mist px-3.5 text-md text-ink placeholder:text-ink-faint focus:border-synapse focus:shadow-[0_0_0_3px_var(--focus-ring)] focus:outline-none";
const fieldLabel = "text-xs font-bold";
const fieldError = "text-2xs font-semibold text-beet";

const REGIONS = [
  ["GB", "United Kingdom"],
  ["US", "United States"],
  ["JM", "Jamaica"],
] as const;
const regionName = Object.fromEntries(REGIONS) as Record<string, string>;

const KINDS = [
  ["meat", "Meat"],
  ["fish", "Fish"],
  ["eggs_dairy", "Egg or dairy"],
  ["plant", "Plant"],
] as const;

/** Chains whose UK sites can't be read automatically; a nudge, not a limit. */
const SUGGESTED_CHAINS = ["McDonald's", "KFC", "Burger King", "Nando's", "Subway", "Pret A Manger", "Wagamama", "Domino's", "Pizza Hut", "Leon"];

const problem = (error: unknown, fallback: string) => (error instanceof RequestFailed ? error.message : fallback);

/**
 * Eating-out menus for chains NeuroCal can't read on its own: an admin copies each item's figures from
 * the chain's nutrition page. Items appear in the app's Add food → Eating out for that country.
 */
export function AdminEatingOut() {
  const items = useAdminEatingOut();
  const forbidden = items.error instanceof RequestFailed && items.error.status === 403;
  const list = items.data?.items ?? [];
  const byChain = new Map<string, CatalogFood[]>();
  for (const item of list) {
    const key = `${item.chain?.name ?? "Other"} · ${regionName[item.regions?.[0] ?? ""] ?? ""}`;
    byChain.set(key, [...(byChain.get(key) ?? []), item]);
  }

  return (
    <AdminShell title="Eating out" detail="Chain menu items you copy from each chain's nutrition page, for the menus NeuroCal can't read on its own.">
      <div className="-mx-4 max-w-[44rem] sm:-mx-5">
        {items.isPending && <ScreenLoading label="Loading menus" heights={[22, 13.75]} />}
        {forbidden && (
          <p role="alert" className="m-4 rounded-card border border-rule bg-paper p-5 text-md">
            This page is for admins.
          </p>
        )}
        {items.isError && !forbidden && (
          <ScreenFailed title="Couldn't load the menus" onRetry={() => items.refetch()}>
            Check your connection and try again.
          </ScreenFailed>
        )}
        {items.data && (
          <>
            <AddItem />
            <Section title="Added items" kind="title" className="[&>h2]:pt-6">
              {list.length === 0 ? (
                <p className="mx-4 mt-1 rounded-card border-[1.5px] border-dashed border-rule-strong p-[1.125rem] text-sm text-ink-soft">
                  Nothing added yet. The app already has US chains from USDA, Greggs in the UK and Jamaican favourites.
                </p>
              ) : (
                [...byChain].map(([group, foods]) => (
                  <div key={group} className="mt-3">
                    <h3 className="m-0 px-4 pb-1.5 text-sm font-extrabold">{group}</h3>
                    <ul aria-label={group} className="m-0 flex list-none flex-col gap-2 px-4 pb-0">
                      {foods.map((food) => (
                        <ItemRow key={food.id} food={food} />
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </Section>
          </>
        )}
      </div>
    </AdminShell>
  );
}

function ItemRow({ food }: { food: CatalogFood }) {
  const remove = useDeleteEatingOutItem();
  const toast = useToast();
  return (
    <li aria-label={food.name} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-card border border-rule bg-paper px-4 py-3">
      <div className="min-w-0 flex-1">
        <p className="m-0 text-sm font-bold">{food.name}</p>
        <p className="m-0 text-2xs text-ink-soft tabular-nums">
          {food.serving} · {food.calories} kcal · {food.macros.proteinG} g protein · {food.macros.carbsG} g carbs · {food.macros.fatG} g fat
        </p>
      </div>
      {food.sourceUrl && (
        <a href={food.sourceUrl} target="_blank" rel="noreferrer" className="text-xs font-bold text-synapse-ink">
          Source
        </a>
      )}
      <button
        type="button"
        disabled={remove.isPending}
        onClick={() => remove.mutate(food.id, { onSuccess: () => toast("Item removed", "info") })}
        className="h-9 cursor-pointer rounded-pill bg-beet-soft px-3 text-xs font-bold text-beet hover:brightness-95 disabled:opacity-45"
      >
        {remove.isPending ? "Removing…" : "Remove"}
      </button>
    </li>
  );
}

const emptyDraft = {
  chainName: "",
  region: "GB" as SaveEatingOutItemRequest["region"],
  name: "",
  serving: "",
  grams: "",
  calories: "",
  proteinG: "",
  carbsG: "",
  fatG: "",
  fiberG: "",
  kind: "meat" as SaveEatingOutItemRequest["kind"],
  why: "",
  sourceUrl: "",
};
type Draft = typeof emptyDraft;
type NumberKey = "grams" | "calories" | "proteinG" | "carbsG" | "fatG" | "fiberG";

const num = (v: string) => (v.trim() === "" ? NaN : Number(v.replace(",", ".")));

/** Adds an item, or updates the one with the same chain, name and country. */
function AddItem() {
  const save = useSaveEatingOutItem();
  const toast = useToast();
  const [draft, setDraft] = useState(emptyDraft);
  const [missing, setMissing] = useState(false);
  const set = (patch: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setMissing(false);
    save.reset();
  };

  const [p, c, f, kcal] = [num(draft.proteinG), num(draft.carbsG), num(draft.fatG), num(draft.calories)];
  const fromMacros = [p, c, f].every(Number.isFinite) ? Math.round(4 * p + 4 * c + 9 * f) : null;
  const offBy = fromMacros !== null && Number.isFinite(kcal) && Math.abs(fromMacros - kcal) > Math.max(15, 0.2 * kcal);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const required: NumberKey[] = ["grams", "calories", "proteinG", "carbsG", "fatG"];
    if (!draft.chainName.trim() || !draft.name.trim() || !draft.serving.trim() || !draft.sourceUrl.trim() || required.some((k) => !Number.isFinite(num(draft[k])))) {
      setMissing(true);
      return;
    }
    const fiber = num(draft.fiberG);
    save.mutate(
      {
        chainName: draft.chainName.trim(),
        region: draft.region,
        name: draft.name.trim(),
        serving: draft.serving.trim(),
        grams: num(draft.grams),
        calories: kcal,
        proteinG: p,
        carbsG: c,
        fatG: f,
        ...(Number.isFinite(fiber) ? { fiberG: fiber } : {}),
        kind: draft.kind,
        ...(draft.why.trim() ? { why: draft.why.trim() } : {}),
        sourceUrl: draft.sourceUrl.trim(),
      },
      {
        onSuccess: (saved) => {
          toast(`${saved.name} saved`);
          // Keep the chain, country and link page: the next item is usually from the same menu.
          setDraft({ ...emptyDraft, chainName: draft.chainName, region: draft.region, kind: draft.kind });
        },
      },
    );
  };

  const numberField = (key: NumberKey, label: string, unit: string, optional = false) => (
    <label className="flex flex-col gap-1.5">
      <span className={fieldLabel}>
        {label}
        {optional && <span className="font-normal text-ink-soft"> (if published)</span>}
      </span>
      <span className="relative">
        <input inputMode="decimal" value={draft[key]} onChange={(e) => set({ [key]: e.target.value })} className={`${field} pr-12 tabular-nums`} />
        <span className="pointer-events-none absolute top-3.5 right-3.5 text-xs text-ink-soft">{unit}</span>
      </span>
    </label>
  );

  return (
    <Section title="Add an item" kind="title" className="[&>h2]:pt-[1.125rem]">
      <form onSubmit={submit} noValidate aria-label="Add an item" className={`${cardClass} flex flex-col gap-3 p-4`}>
        <p className="m-0 text-xs leading-[1.45] text-ink-soft">
          Open the chain&apos;s nutrition page and copy the per-portion figures. Saving the same chain, item and country again updates it.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>Chain</span>
            <input list="eating-out-chains" value={draft.chainName} onChange={(e) => set({ chainName: e.target.value })} placeholder="e.g. KFC" className={field} />
            <datalist id="eating-out-chains">
              {SUGGESTED_CHAINS.map((chain) => (
                <option key={chain} value={chain} />
              ))}
            </datalist>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>Country</span>
            <select value={draft.region} onChange={(e) => set({ region: e.target.value as Draft["region"] })} className={field}>
              {REGIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>Item</span>
            <input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Zinger burger" className={field} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className={fieldLabel}>Portion</span>
            <input value={draft.serving} onChange={(e) => set({ serving: e.target.value })} placeholder="e.g. 1 burger" className={field} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {numberField("grams", "Weight", "g")}
          {numberField("calories", "Energy", "kcal")}
          {numberField("proteinG", "Protein", "g")}
          {numberField("carbsG", "Carbs", "g")}
          {numberField("fatG", "Fat", "g")}
          {numberField("fiberG", "Fibre", "g", true)}
        </div>
        {fromMacros !== null && (
          <p role="status" className={`m-0 text-2xs ${offBy ? "font-semibold text-beet" : "text-ink-soft"}`}>
            Protein, carbs and fat make about {fromMacros} kcal{offBy ? ". That's far from the energy above: check for a typo." : "."}
          </p>
        )}
        <fieldset className="m-0 flex min-w-0 flex-col gap-1.5 border-0 p-0">
          <legend className={`mb-1.5 p-0 ${fieldLabel}`}>Mostly</legend>
          <div className="grid grid-cols-4 gap-1 rounded-option bg-mist p-1">
            {KINDS.map(([value, text]) => (
              <label key={value} className="relative">
                <input type="radio" name="kind" className="peer sr-only" checked={draft.kind === value} onChange={() => set({ kind: value })} />
                <span className="grid h-10 cursor-pointer place-items-center rounded-[0.625rem] text-xs font-bold text-ink-soft peer-checked:bg-paper peer-checked:text-synapse-ink peer-focus-visible:outline-2 peer-focus-visible:outline-synapse">
                  {text}
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>Link to the chain&apos;s page</span>
          <input type="url" inputMode="url" placeholder="https://" value={draft.sourceUrl} onChange={(e) => set({ sourceUrl: e.target.value })} className={field} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>
            One line people see<span className="font-normal text-ink-soft"> (optional)</span>
          </span>
          <input value={draft.why} onChange={(e) => set({ why: e.target.value })} maxLength={200} placeholder="e.g. Spicy fried chicken fillet in a bun." className={field} />
        </label>

        {missing && (
          <p role="alert" className={`m-0 ${fieldError}`}>
            Fill in the chain, item, portion, the five numbers and the link.
          </p>
        )}
        {save.isError && (
          <p role="alert" className={`m-0 ${fieldError}`}>
            {problem(save.error, "The item wasn't saved. Try again.")}
          </p>
        )}
        <Button type="submit" className="h-[3.125rem] text-md" disabled={save.isPending}>
          {save.isPending ? "Saving…" : "Save item"}
        </Button>
      </form>
    </Section>
  );
}
