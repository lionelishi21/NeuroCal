"use client";

import { useState } from "react";
import { DayColumns } from "./DayColumns";

/** A sample week for the landing page: the This week screen with made-up numbers, never the visitor's own. */
const DAYS = [
  { short: "Fri", day: 26, full: "Friday 26 September", focus: 62, kcal: 2310, sleep: 384, lastMeal: "21:50" },
  { short: "Sat", day: 27, full: "Saturday 27 September", focus: 70, kcal: 1980, sleep: 468, lastMeal: "20:30" },
  { short: "Sun", day: 28, full: "Sunday 28 September", focus: 58, kcal: 2480, sleep: 354, lastMeal: "23:10" },
  { short: "Mon", day: 29, full: "Monday 29 September", focus: 66, kcal: 2150, sleep: 426, lastMeal: "20:05" },
  { short: "Tue", day: 30, full: "Tuesday 30 September", focus: 71, kcal: 2050, sleep: 444, lastMeal: "19:40" },
  { short: "Wed", day: 1, full: "Wednesday 1 October", focus: 55, kcal: 2390, sleep: 372, lastMeal: "22:40" },
  { short: "Thu", day: 2, full: "Thursday 2 October", focus: 74, kcal: 1240, sleep: 432, lastMeal: "13:05" },
] as const;
const TARGET = 2200;

const slept = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(Math.round(minutes % 60)).padStart(2, "0")}m`;
const thousands = (n: number) => n.toLocaleString("en-GB");
const average = (values: readonly number[]) => values.reduce((a, b) => a + b, 0) / values.length;

/**
 * The This week screen, working, on the landing page: pick a day and its four numbers and the
 * three charts follow, exactly as they do in the app.
 */
export function WeekShowcase() {
  const [selected, setSelected] = useState(DAYS.length - 1);
  const day = DAYS[selected]!;
  const initials = DAYS.map((d) => d.short.charAt(0));
  const cells = [
    { label: "Focus Score", value: String(day.focus), of: "100", tone: "" },
    { label: "Calories", value: thousands(day.kcal), of: thousands(TARGET), tone: day.kcal > TARGET ? "text-beet" : "" },
    { label: "Sleep", value: slept(day.sleep), of: undefined, tone: day.sleep < 420 ? "text-glucose-ink" : "" },
    { label: "Last meal", value: day.lastMeal, of: undefined, tone: day.lastMeal >= "21:00" ? "text-glucose-ink" : "" },
  ];

  return (
    <div className="w-full max-w-[27.5rem] rounded-sheet border border-rule bg-mist p-4 sm:p-5">
      <div role="group" aria-label="Choose a day of the sample week" className="grid grid-cols-7 gap-1">
        {DAYS.map((d, i) => (
          <button
            key={d.full}
            type="button"
            aria-pressed={selected === i}
            aria-label={d.full}
            onClick={() => setSelected(i)}
            className={`flex h-14 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-option ${selected === i ? "bg-synapse text-on-accent" : "bg-paper text-ink hover:bg-synapse-soft"}`}
          >
            <span className="text-3xs font-semibold opacity-80">{d.short}</span>
            <span className="text-base font-extrabold">{d.day}</span>
          </button>
        ))}
      </div>

      <div aria-live="polite" className="mt-3 rounded-card border border-rule bg-paper p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="m-0 text-md font-bold">{day.full}</p>
          {selected === DAYS.length - 1 && <span className="flex h-6 shrink-0 items-center rounded-pill bg-synapse-soft px-2.5 text-2xs font-bold text-synapse-ink">Today so far</span>}
        </div>
        <dl className="m-0 mt-3 grid grid-cols-2 gap-x-3 gap-y-3.5">
          {cells.map((cell) => (
            <div key={cell.label}>
              <dt className="text-2xs font-semibold text-ink-soft">{cell.label}</dt>
              <dd className={`m-0 mt-0.5 text-xl font-extrabold tracking-[-0.015em] tabular-nums ${cell.tone}`}>
                {cell.value}
                {cell.of && <span className="text-xs font-semibold text-ink-soft"> / {cell.of}</span>}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* The charts carry the app's own side margins; cancel them inside this frame. */}
      <div className="-mx-4">
        <DayColumns
          title="Focus Score"
          note={`Average ${Math.round(average(DAYS.map((d) => d.focus)))}`}
          max={100}
          values={DAYS.map((d) => d.focus)}
          days={initials}
          format={String}
          selected={selected}
          onSelect={setSelected}
        />
        <DayColumns
          title="Calories"
          note="Against your target"
          max={2800}
          values={DAYS.map((d) => d.kcal)}
          days={initials}
          format={thousands}
          reference={{ value: TARGET, label: `${thousands(TARGET)} target` }}
          selected={selected}
          onSelect={setSelected}
        />
        <DayColumns
          title="Sleep"
          note={`Average ${slept(average(DAYS.map((d) => d.sleep)))}`}
          max={600}
          values={DAYS.map((d) => d.sleep)}
          days={initials}
          format={slept}
          reference={{ value: 480, label: "8 h" }}
          selected={selected}
          onSelect={setSelected}
        />
      </div>
    </div>
  );
}
