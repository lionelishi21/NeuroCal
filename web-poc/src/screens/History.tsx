"use client";

import type { HistoryDay } from "@neurocal/contracts";
import Link from "next/link";
import { useState } from "react";
import { useHistory } from "../api/queries";
import { DayColumns } from "../components/DayColumns";
import { WhatHelps } from "../components/WhatHelps";
import { flagLabel, kcal } from "../lib/format";

const weekday = (date: string, style: "short" | "long" = "short") =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: style });
const fullDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
const hours = (minutes: number | null) =>
  minutes === null ? "No data" : `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;
const clock = (hhmm: string | null) => {
  if (!hhmm) return "Nothing logged";
  const [h, m] = hhmm.split(":").map(Number);
  const d = new Date();
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
};

/**
 * The past week as three aligned single-series charts (no dual axis: focus,
 * calories and sleep have different scales), one shared day axis, a readout for
 * the selected day, and a table with every value.
 */
export function History() {
  const history = useHistory(7);
  const [hovered, setHovered] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);

  const days = history.data?.days ?? [];
  const current = hovered ?? selected ?? (days.length ? days.length - 1 : null);
  const day: HistoryDay | undefined = current === null ? undefined : days[current];
  const highlight = hovered ?? selected;

  const maxCalories = Math.max(3000, ...days.map((d) => d.caloriesEaten), ...days.map((d) => d.calorieTarget));
  const calorieScale = Math.ceil(maxCalories / 500) * 500;
  const target = days.at(-1)?.calorieTarget;

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-6 pb-16 sm:px-8 lg:pt-12">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="m-0 text-2xl">This week</h1>
        <Link href="/" className="text-sm text-ink-soft underline decoration-rule underline-offset-4 hover:text-ink">
          Back to today
        </Link>
      </div>
      <p className="mt-2 mb-0 max-w-[var(--measure)] text-ink-soft">
        Each Focus Score reflects the night before it: sleep, how late you ate and how you felt.
      </p>

      {history.isPending && <p className="mt-8 text-ink-soft">Loading your week…</p>}
      {history.isError && <p className="mt-8 text-beet">Your week didn't load. Check your connection and try again.</p>}

      {day && (
        <>
          <section aria-live="polite" aria-label="Selected day" className="mt-8 border-t border-rule pt-4">
            <h2 className="m-0 text-base font-semibold">{fullDate(day.date)}</h2>
            <dl className="mt-3 mb-0 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              <Readout value={day.focusScore === null ? "No data" : String(day.focusScore)} label="Focus Score" swatch="bg-chart-focus" />
              <Readout value={`${kcal(day.caloriesEaten)} kcal`} label={`of ${kcal(day.calorieTarget)} target`} swatch="bg-chart-calories" />
              <Readout value={hours(day.sleepMinutes)} label="Sleep that morning" swatch="bg-chart-sleep" />
              <Readout value={clock(day.lastMealAt)} label="Last meal" />
            </dl>
          </section>

          <div className="mt-8 flex flex-col gap-7">
            <DayColumns
              title="Focus Score"
              max={100}
              maxLabel="100"
              values={days.map((d) => d.focusScore)}
              colorClass="bg-chart-focus"
              active={highlight}
              onActive={setHovered}
            />
            <DayColumns
              title="Calories"
              max={calorieScale}
              maxLabel={`${kcal(calorieScale)} kcal`}
              values={days.map((d) => d.caloriesEaten)}
              colorClass="bg-chart-calories"
              {...(target ? { reference: { value: target, label: `target ${kcal(target)}` } } : {})}
              active={highlight}
              onActive={setHovered}
            />
            <DayColumns
              title="Sleep"
              max={600}
              maxLabel="10 h"
              values={days.map((d) => d.sleepMinutes)}
              colorClass="bg-chart-sleep"
              reference={{ value: 480, label: "8 h" }}
              active={highlight}
              onActive={setHovered}
            />
          </div>

          <div role="group" aria-label="Choose a day" className="mt-2 grid grid-cols-7">
            {days.map((d, i) => (
              <button
                key={d.date}
                type="button"
                aria-pressed={current === i}
                aria-label={fullDate(d.date)}
                onClick={() => setSelected(i)}
                onFocus={() => setSelected(i)}
                className={`rounded-control py-2 text-center text-sm ${current === i ? "font-semibold text-ink" : "text-ink-soft hover:text-ink"}`}
              >
                {i === days.length - 1 ? "Today" : weekday(d.date)}
              </button>
            ))}
          </div>

          <WhatHelps />

          <section aria-labelledby="table-title" className="mt-12">
            <h2 id="table-title" className="mt-0 mb-3 text-xl">
              Day by day
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-rule text-ink-soft">
                    <th scope="col" className="py-2 pr-4 font-normal">Day</th>
                    <th scope="col" className="py-2 pr-4 text-right font-normal">Focus</th>
                    <th scope="col" className="py-2 pr-4 text-right font-normal">Calories</th>
                    <th scope="col" className="py-2 pr-4 text-right font-normal">Protein</th>
                    <th scope="col" className="py-2 pr-4 text-right font-normal">Sleep</th>
                    <th scope="col" className="py-2 pr-4 font-normal">Last meal</th>
                    <th scope="col" className="py-2 font-normal">Feeling</th>
                  </tr>
                </thead>
                <tbody>
                  {[...days].reverse().map((d) => (
                    <tr key={d.date} className="border-b border-rule align-top">
                      <th scope="row" className="py-2.5 pr-4 font-normal text-ink">{weekday(d.date, "long")}</th>
                      <td className="py-2.5 pr-4 text-right">{d.focusScore ?? "–"}</td>
                      <td className="py-2.5 pr-4 text-right">{kcal(d.caloriesEaten)}</td>
                      <td className="py-2.5 pr-4 text-right">{d.proteinG} g</td>
                      <td className="py-2.5 pr-4 text-right">
                        {d.sleepMinutes === null ? "–" : `${(d.sleepMinutes / 60).toFixed(1)} h`}
                      </td>
                      <td className="py-2.5 pr-4">{d.lastMealAt ? clock(d.lastMealAt) : "–"}</td>
                      <td className="py-2.5 text-ink-soft">{d.flags.map((f) => flagLabel[f]).join(", ") || "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </main>
  );
}

function Readout({ value, label, swatch }: { value: string; label: string; swatch?: string }) {
  return (
    // Source order is dt → dd (valid HTML); the value reads first visually.
    <div className="flex flex-col-reverse">
      <dt className="m-0 flex items-center gap-1.5 text-sm text-ink-soft">
        {swatch && <span aria-hidden className={`h-0.5 w-3 rounded-pill ${swatch}`} />}
        {label}
      </dt>
      <dd className="m-0 text-lg font-semibold text-ink">{value}</dd>
    </div>
  );
}
