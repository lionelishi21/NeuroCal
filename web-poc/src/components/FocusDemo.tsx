"use client";

import { useId, useState } from "react";
import { type Evening, type Part, WEIGHTS, biggestDrag, clock, parts, score, sleepMinutes } from "../lib/focusDemo";
import { flagLabel } from "../lib/format";

/** Where the demo starts: a late dinner, some screens, seven hours of sleep. */
const START: Evening = { dinner: 21.75, bedtime: 23.5, wake: 6.5, screens: 30, highGlycemicShare: 0.25, flags: ["low_focus"] };
const FEELINGS = ["sharp", "calm", "low_focus", "brain_fog", "wired", "stressed"] as const;

const PART_NAME: Record<Part, string> = { sleep: "Sleep", timing: "Evening timing", glycemic: "Glycemic load", stress: "Stress" };
const PART_FILL: Record<Part, string> = { sleep: "bg-synapse", timing: "bg-ion", glycemic: "bg-glucose", stress: "bg-chlorophyll-bar" };

const hoursAndMinutes = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;

/** What the biggest drag is, in the visitor's own numbers, and what fixing it would do. */
function verdict(evening: Evening, total: number): string {
  const drag = biggestDrag(parts(evening));
  if (!drag) return "Nothing is dragging tomorrow down. Keep this rhythm.";
  const better = Math.min(100, total + drag.points);
  switch (drag.part) {
    case "sleep":
      return `${hoursAndMinutes(sleepMinutes(evening))} of sleep is the biggest drag: ${drag.points} points. Eight hours would make it ${better}.`;
    case "timing":
      return evening.dinner > 21
        ? `Dinner at ${clock(evening.dinner)}${evening.screens ? " and late screens are" : " is"} the biggest drag: ${drag.points} points. Finish by 21:00, screens off by 22:00, and it is ${better}.`
        : `${evening.screens} minutes of screens after 22:00 is the biggest drag: ${drag.points} points. Without them it is ${better}.`;
    case "glycemic":
      return `High-glycemic food is the biggest drag: ${drag.points} points. Swap it for slow carbs and it is ${better}.`;
    case "stress":
      return `How you felt is the biggest drag: ${drag.points} points. A calmer day would make it ${better}.`;
  }
}

/**
 * The landing page's working demo: an evening on a 24-hour dial that the visitor can change,
 * with tomorrow's Focus Score, its four inputs and the biggest drag recomputed by the app's
 * own formula (lib/focusDemo.ts).
 */
export function FocusDemo() {
  const [evening, setEvening] = useState(START);
  const set = (patch: Partial<Evening>) => setEvening((current) => ({ ...current, ...patch }));
  const values = parts(evening);
  const total = score(values);
  // Bedtime runs past midnight, so the slider counts hours from 18:00.
  const bedFromSix = (((evening.bedtime - 18) % 24) + 24) % 24;

  return (
    <div className="grid items-center gap-8 rounded-[2rem] border border-rule bg-paper p-6 sm:p-10 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:gap-14 lg:p-14">
      <div>
        <DayDial evening={evening} score={total} />
        <p aria-live="polite" className="mt-5 mb-0 text-md leading-[1.45] font-bold text-pretty">
          {verdict(evening, total)}
        </p>
      </div>

      <div>
        <p className="m-0 text-sm font-bold text-ion-ink">Try it</p>
        <h3 className="mt-2 mb-0 text-2xl leading-[1.1] font-extrabold tracking-[-0.03em] text-balance sm:text-figure">Change tonight. See tomorrow morning.</h3>
        <p className="mt-3 mb-0 max-w-[32rem] text-base leading-[1.55] text-pretty text-ink-soft">This is the formula the app uses, not an illustration. Move anything and the score is worked out again.</p>

        <div className="mt-5 flex flex-col gap-1">
          <Dial label="Dinner" value={clock(evening.dinner)} min={18} max={23.5} step={0.25} at={evening.dinner} onChange={(dinner) => set({ dinner })} />
          <Dial
            label="Bedtime"
            value={`${clock(evening.bedtime)}, ${hoursAndMinutes(sleepMinutes(evening))} asleep`}
            min={3.5}
            max={8}
            step={0.25}
            at={bedFromSix}
            onChange={(hours) => set({ bedtime: (18 + hours) % 24 })}
          />
          <Dial label="Screens after 22:00" value={evening.screens ? `${evening.screens} min` : "None"} min={0} max={120} step={5} at={evening.screens} onChange={(screens) => set({ screens })} />
          <Dial
            label="High-glycemic food"
            value={`${Math.round(evening.highGlycemicShare * 100)}% of the day's calories`}
            min={0}
            max={100}
            step={5}
            at={Math.round(evening.highGlycemicShare * 100)}
            onChange={(percent) => set({ highGlycemicShare: percent / 100 })}
          />
        </div>

        <fieldset className="m-0 mt-3 min-w-0 border-0 p-0">
          <legend className="mb-2.5 p-0 text-sm font-bold">How you felt</legend>
          <div className="flex flex-wrap gap-2">
            {FEELINGS.map((flag) => {
              const on = evening.flags.includes(flag);
              return (
                <button
                  key={flag}
                  type="button"
                  aria-pressed={on}
                  onClick={() => set({ flags: on ? evening.flags.filter((f) => f !== flag) : [...evening.flags, flag] })}
                  className={`h-11 cursor-pointer rounded-pill border-[1.5px] px-4 text-md font-bold ${on ? "border-synapse bg-synapse text-on-accent" : "border-rule-strong bg-paper text-ink hover:border-ink-soft"}`}
                >
                  {flagLabel[flag]}
                </button>
              );
            })}
          </div>
        </fieldset>

        <dl className="m-0 mt-7 grid gap-x-8 gap-y-3.5 border-t border-rule pt-5 sm:grid-cols-2">
          {(Object.keys(WEIGHTS) as Part[]).map((part) => (
            <div key={part}>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-sm font-bold">
                  {PART_NAME[part]} <span className="font-semibold text-ink-soft">{WEIGHTS[part] * 100}%</span>
                </dt>
                <dd className="m-0 text-sm font-bold tabular-nums">{Math.round(values[part] * 100)}</dd>
              </div>
              <span aria-hidden className="mt-1.5 block h-1.5 rounded-pill bg-track">
                <span className={`block h-full rounded-pill transition-[width] duration-[var(--duration-select)] ${PART_FILL[part]}`} style={{ width: `${values[part] * 100}%` }} />
              </span>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

/** One slider of the demo: its name, its value in words, and a full-width track. */
function Dial({ label, value, min, max, step, at, onChange }: { label: string; value: string; min: number; max: number; step: number; at: number; onChange: (value: number) => void }) {
  const id = useId();
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-bold">
          {label}
        </label>
        <output htmlFor={id} className="text-right text-sm font-semibold text-ink-soft tabular-nums">
          {value}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={at}
        aria-valuetext={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="block h-11 w-full cursor-pointer accent-[var(--synapse)]"
      />
    </div>
  );
}

const SIZE = 360;
const CENTER = SIZE / 2;
const point = (hours: number, radius: number) => {
  const angle = (hours / 24) * 2 * Math.PI - Math.PI / 2;
  // Rounded, so the server and the browser write the same numbers into the SVG.
  const round = (n: number) => Math.round(n * 100) / 100;
  return [round(CENTER + radius * Math.cos(angle)), round(CENTER + radius * Math.sin(angle))] as const;
};
/** A clockwise arc from one clock time to another, wrapping past midnight. */
function arc(from: number, to: number, radius: number): string {
  const span = (((to - from) % 24) + 24) % 24;
  const [x1, y1] = point(from, radius);
  const [x2, y2] = point(from + span, radius);
  return `M ${x1} ${y1} A ${radius} ${radius} 0 ${span > 12 ? 1 : 0} 1 ${x2} ${y2}`;
}

/**
 * The evening on a 24-hour dial, midnight at the top: the thick arc is sleep, the dot is dinner
 * (with an amber arc back to 21:00 when it is late), the thin teal arc is screens after 22:00.
 * Decorative for assistive tech: the sliders and the sentence under it carry every value.
 */
function DayDial({ evening, score: total }: { evening: Evening; score: number }) {
  const [dinnerX, dinnerY] = point(evening.dinner, 120);
  return (
    <figure className="relative m-0 mx-auto aspect-square w-full max-w-[22rem]">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden className="size-full">
        {Array.from({ length: 24 }, (_, hour) => {
          const [x1, y1] = point(hour, hour % 6 === 0 ? 158 : 163);
          const [x2, y2] = point(hour, 169);
          return <line key={hour} x1={x1} y1={y1} x2={x2} y2={y2} stroke={hour % 6 === 0 ? "var(--ink-soft)" : "var(--rule-strong)"} strokeWidth={hour % 6 === 0 ? 2 : 1.5} strokeLinecap="round" />;
        })}
        {[0, 6, 12, 18].map((hour) => {
          const [x, y] = point(hour, 145);
          return (
            <text key={hour} x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize="11" fontWeight="700" fill="var(--ink-soft)">
              {String(hour).padStart(2, "0")}
            </text>
          );
        })}
        <circle cx={CENTER} cy={CENTER} r="120" fill="none" stroke="var(--track)" strokeWidth="20" />
        <path d={arc(evening.bedtime, evening.wake, 120)} fill="none" stroke="var(--synapse)" strokeWidth="20" strokeLinecap="round" />
        {evening.dinner > 21 && <path d={arc(21, evening.dinner, 98)} fill="none" stroke="var(--glucose)" strokeWidth="5" strokeLinecap="round" />}
        {evening.screens > 0 && <path d={arc(22, 22 + evening.screens / 60, 88)} fill="none" stroke="var(--ion)" strokeWidth="5" strokeLinecap="round" />}
        <circle cx={dinnerX} cy={dinnerY} r="9" fill="var(--glucose)" stroke="var(--paper)" strokeWidth="3.5" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-display leading-none font-extrabold tracking-[-0.04em] tabular-nums">{total}</span>
        <span className="mt-1 text-2xs font-semibold text-ink-soft">tomorrow's Focus Score</span>
      </div>
      <figcaption className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1 text-2xs text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-4 rounded-pill bg-synapse" />
          Asleep
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-2.5 rounded-full bg-glucose" />
          Dinner
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-1 w-4 rounded-pill bg-ion" />
          Screens after 22:00
        </span>
      </figcaption>
    </figure>
  );
}
