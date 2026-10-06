"use client";

import type { HistoryDay } from "@neurocal/contracts";
import { useState } from "react";
import { useHistory } from "../api/queries";
import { DayColumns } from "../components/DayColumns";
import { ScreenFailed, ScreenLoading } from "../components/ListStates";
import { Screen, ScreenHeader, Section, cardClass } from "../components/Screen";
import { WhatHelps } from "../components/WhatHelps";
import { flagLabel, kcal } from "../lib/format";
import { LATE_EATING_FROM } from "../lib/nights";

const at = (date: string) => new Date(`${date}T12:00:00`);
const weekday = (date: string) => at(date).toLocaleDateString(undefined, { weekday: "short" });
const dayOfMonth = (date: string) => at(date).getDate();
const shortDate = (date: string) => at(date).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
const fullDate = (date: string) => at(date).toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
/** "6h 30m". */
const slept = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(Math.round(minutes % 60)).padStart(2, "0")}m`;
const average = (values: (number | null)[]) => {
  const known = values.filter((v): v is number => v !== null);
  return known.length ? known.reduce((a, b) => a + b, 0) / known.length : null;
};

const SHORT_SLEEP_MINUTES = 7 * 60;
const ateLate = (day: HistoryDay) => day.lastMealAt !== null && day.lastMealAt >= LATE_EATING_FROM;
const hasData = (day: HistoryDay) => day.focusScore !== null || day.caloriesEaten > 0 || day.sleepMinutes !== null;

const columns = "grid grid-cols-[4rem_3.5rem_4.875rem_4.375rem_4.375rem_4.75rem_minmax(0,1fr)] px-3.5";

/**
 * The past week: a day picker, the chosen day's four numbers, three aligned
 * single-series charts (no dual axis: focus, calories and sleep have different
 * scales), what could help, and a table with every value.
 */
export function History() {
  const history = useHistory(7);
  const [chosen, setChosen] = useState<number | null>(null);

  const days = history.data?.days ?? [];
  const selected = chosen ?? (days.length ? days.length - 1 : null);
  const day: HistoryDay | undefined = selected === null ? undefined : days[selected];
  const first = days[0];
  const last = days.at(-1);

  const calorieScale = Math.ceil(Math.max(2800, ...days.map((d) => d.caloriesEaten), ...days.map((d) => d.calorieTarget)) / 400) * 400;
  const target = last?.calorieTarget;
  const initials = days.map((d) => weekday(d.date).charAt(0));
  const focusAverage = average(days.map((d) => d.focusScore));
  const sleepAverage = average(days.map((d) => d.sleepMinutes));

  return (
    <Screen>
      <ScreenHeader
        title="This week"
        {...(first && last ? { detail: `${shortDate(first.date)} – ${shortDate(last.date)}` } : {})}
        back={{ href: "/", label: "Back to Today" }}
      />

      {history.isPending && <ScreenLoading label="Loading this week" heights={[3.25, 9.375, 11.875, 11.875]} />}
      {history.isError && (
        <ScreenFailed title="Couldn't load this week" onRetry={() => history.refetch()}>
          Check your connection and try again.
        </ScreenFailed>
      )}

      {day && selected !== null && (
        <>
          <div role="group" aria-label="Choose a day" className="grid grid-cols-7 gap-1 px-4 pt-3.5">
            {days.map((d, i) => (
              <button
                key={d.date}
                type="button"
                aria-pressed={selected === i}
                aria-label={fullDate(d.date)}
                onClick={() => setChosen(i)}
                className={`flex h-14 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-option ${selected === i ? "bg-synapse text-on-accent" : "bg-paper text-ink hover:bg-synapse-soft"}`}
              >
                <span className="text-3xs font-semibold opacity-80">{weekday(d.date)}</span>
                <span className="text-base font-extrabold">{dayOfMonth(d.date)}</span>
              </button>
            ))}
          </div>

          <section aria-live="polite" aria-label="Selected day" className={`${cardClass} mt-3 p-4`}>
            <div className="flex items-center justify-between gap-2">
              <h2 className="m-0 text-md font-bold">{fullDate(day.date)}</h2>
              {selected === days.length - 1 && (
                <span className="flex h-6 shrink-0 items-center rounded-pill bg-synapse-soft px-2.5 text-2xs font-bold text-synapse-ink">Today so far</span>
              )}
            </div>
            <dl className="m-0 mt-3 grid grid-cols-2 gap-x-3 gap-y-3.5">
              <Cell label="Focus Score" value={day.focusScore === null ? "–" : String(day.focusScore)} of={day.focusScore === null ? undefined : "100"} />
              <Cell label="Calories" value={kcal(day.caloriesEaten)} of={kcal(day.calorieTarget)} tone={day.caloriesEaten > day.calorieTarget ? "text-beet" : ""} />
              <Cell
                label="Sleep"
                value={day.sleepMinutes === null ? "–" : slept(day.sleepMinutes)}
                tone={day.sleepMinutes !== null && day.sleepMinutes < SHORT_SLEEP_MINUTES ? "text-glucose-ink" : ""}
              />
              <Cell label="Last meal" value={day.lastMealAt ?? "–"} tone={ateLate(day) ? "text-glucose-ink" : ""} />
            </dl>
          </section>

          <DayColumns
            title="Focus Score"
            {...(focusAverage === null ? {} : { note: `Average ${Math.round(focusAverage)}` })}
            max={100}
            values={days.map((d) => d.focusScore)}
            days={initials}
            format={String}
            selected={selected}
            onSelect={setChosen}
          />
          <DayColumns
            title="Calories"
            note="Against your target"
            max={calorieScale}
            values={days.map((d) => (hasData(d) ? d.caloriesEaten : null))}
            days={initials}
            format={kcal}
            {...(target ? { reference: { value: target, label: `${kcal(target)} target` } } : {})}
            selected={selected}
            onSelect={setChosen}
          />
          <DayColumns
            title="Sleep"
            {...(sleepAverage === null ? {} : { note: `Average ${slept(sleepAverage)}` })}
            max={600}
            values={days.map((d) => d.sleepMinutes)}
            days={initials}
            format={slept}
            reference={{ value: 480, label: "8 h" }}
            selected={selected}
            onSelect={setChosen}
          />

          <WhatHelps daysLogged={days.filter(hasData).length} />

          <Section title="Every day" kind="title" className="[&>h2]:pt-[1.625rem]">
            <div className={`${cardClass} overflow-x-auto`}>
              <table className="block min-w-[37.5rem] text-left text-xs">
                <thead className="block">
                  <tr className={`${columns} border-b border-rule py-2.5 text-3xs font-bold text-ink-soft`}>
                    <th scope="col" className="font-bold">Day</th>
                    <th scope="col" className="font-bold">Focus</th>
                    <th scope="col" className="font-bold">Calories</th>
                    <th scope="col" className="font-bold">Protein</th>
                    <th scope="col" className="font-bold">Sleep</th>
                    <th scope="col" className="font-bold">Last meal</th>
                    <th scope="col" className="font-bold">Feeling</th>
                  </tr>
                </thead>
                <tbody className="block">
                  {days.map((d, i) => (
                    <tr
                      key={d.date}
                      onClick={() => setChosen(i)}
                      className={`${columns} min-h-11 cursor-pointer items-center border-t border-rule first:border-t-0 ${selected === i ? "bg-synapse-soft" : ""}`}
                    >
                      <th scope="row" className="font-bold">
                        {weekday(d.date)} {dayOfMonth(d.date)}
                      </th>
                      <td className="font-bold">{d.focusScore ?? "–"}</td>
                      <td>{hasData(d) ? kcal(d.caloriesEaten) : "–"}</td>
                      <td>{hasData(d) ? `${Math.round(d.proteinG)} g` : "–"}</td>
                      <td>{d.sleepMinutes === null ? "–" : slept(d.sleepMinutes)}</td>
                      <td className={ateLate(d) ? "text-glucose-ink" : ""}>{d.lastMealAt ?? "–"}</td>
                      <td className="text-ink-soft">{d.flags.map((f) => flagLabel[f]).join(", ") || "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </Screen>
  );
}

/** One of the chosen day's numbers; `of` is what it is out of ("74 / 100"). */
function Cell({ label, value, of, tone = "" }: { label: string; value: string; of?: string | undefined; tone?: string }) {
  return (
    <div>
      <dt className="text-2xs font-semibold text-ink-soft">{label}</dt>
      <dd className={`m-0 mt-0.5 text-xl font-extrabold tracking-[-0.015em] tabular-nums ${tone}`}>
        {value}
        {of && <span className="text-xs font-semibold text-ink-soft"> / {of}</span>}
      </dd>
    </div>
  );
}
