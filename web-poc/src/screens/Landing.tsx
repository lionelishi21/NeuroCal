"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { useOptionalAuth } from "../auth/AuthProvider";
import { Logo } from "../components/Logo";
import { type Evening, type Part, WEIGHTS, biggestDrag, clock, parts, score, sleepMinutes } from "../lib/focusDemo";
import { flagLabel } from "../lib/format";
import { clearSessionHint } from "../lib/sessionHint";

const primary = "inline-flex h-14 items-center justify-center rounded-pill bg-synapse px-7 text-lg font-bold text-on-accent no-underline shadow-action hover:brightness-110";

/** Where the demo starts: a late dinner, some screens, seven hours of sleep. */
const START: Evening = { dinner: 21.75, bedtime: 23.5, wake: 6.5, screens: 30, highGlycemicShare: 0.25, flags: ["low_focus"] };
const FEELINGS = ["sharp", "calm", "low_focus", "brain_fog", "wired", "stressed"] as const;

const PART_NAME: Record<Part, string> = { sleep: "Sleep", timing: "Evening timing", glycemic: "Glycemic load", stress: "Stress" };
const PART_FILL: Record<Part, string> = { sleep: "bg-synapse", timing: "bg-ion", glycemic: "bg-glucose", stress: "bg-chlorophyll-bar" };

/** A day in order, by the clock: the page's one real sequence. */
const DAY = [
  { time: "07:10", title: "Your Focus Score is ready", body: "Last night's sleep, how late you ate, yesterday's food and your stress, as one number out of 100, with a sentence on what is moving it." },
  { time: "13:05", title: "Photograph lunch", body: "NeuroCal finds each item, its portion, calories and glycemic load. Untick anything it got wrong, or type an item in." },
  { time: "15:30", title: "Say how you feel", body: "Sharp, foggy, wired, calm: one tap. It changes what gets suggested next." },
  { time: "16:00", title: "See what to eat next", body: "A recipe that fits your diet, the calories you have left and the day you are having, with the reason it fits." },
  { time: "22:00", title: "Close the evening", body: "Log sleep and late screens. Tomorrow morning's score starts here." },
] as const;

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
 * What a signed-out visitor sees at the home page. The page is built around one working thing:
 * an evening on a 24-hour dial that the visitor can change, with tomorrow's Focus Score
 * recomputed by the app's own formula.
 */
export function Landing() {
  const auth = useOptionalAuth();
  // Once we know there is no session, drop the hint that hid this page for returning users.
  useEffect(() => {
    if (auth?.status === "signedOut") clearSessionHint();
  }, [auth?.status]);

  const [evening, setEvening] = useState(START);
  const set = (patch: Partial<Evening>) => setEvening((current) => ({ ...current, ...patch }));
  const values = parts(evening);
  const total = score(values);
  // Bedtime runs past midnight, so the slider counts hours from 18:00.
  const bedFromSix = (((evening.bedtime - 18) % 24) + 24) % 24;

  return (
    <div data-landing className="mx-auto w-full max-w-[76rem] px-5 pb-20 sm:px-8">
      <header className="flex h-16 items-center justify-between">
        <Logo />
        <Link href="/sign-in" className="flex h-11 items-center rounded-pill px-4 text-sm font-bold text-synapse-ink no-underline hover:bg-synapse-soft">
          Sign in
        </Link>
      </header>

      <main>
        <h1 className="m-0 pt-6 text-hero leading-[0.94] font-extrabold tracking-[-0.045em] text-balance lg:pt-10">Eat for how you want to think.</h1>
        <div className="mt-7 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
          <p className="m-0 max-w-[36rem] text-lg leading-[1.5] text-pretty text-ink-soft">
            Photograph your meals. NeuroCal reads them against your sleep and stress, gives you one Focus Score each morning and tells you what to eat next.
          </p>
          <div className="flex shrink-0 flex-col items-start gap-2.5 lg:items-end">
            <Link href="/sign-up" className={primary}>
              Create an account
            </Link>
            <p className="m-0 text-sm text-ink-soft">In your browser today. iPhone and Android apps are on the way.</p>
          </div>
        </div>

        <section aria-labelledby="try-title" className="mt-14 border-t border-rule-strong pt-10 lg:mt-20 lg:pt-14">
          <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)] lg:gap-16">
            <div className="lg:sticky lg:top-8">
              <DayDial evening={evening} score={total} />
              <p aria-live="polite" className="mt-5 mb-0 text-lg leading-[1.4] font-bold text-pretty">
                {verdict(evening, total)}
              </p>
            </div>

            <div>
              <h2 id="try-title" className="m-0 text-2xl leading-[1.1] font-extrabold tracking-[-0.025em]">
                Change tonight. See tomorrow morning.
              </h2>
              <p className="mt-2 mb-0 max-w-[34rem] text-md text-pretty text-ink-soft">This is the formula the app uses, not an illustration. Move anything and the score is worked out again.</p>

              <div className="mt-6 flex flex-col gap-1">
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

              <fieldset className="m-0 mt-4 min-w-0 border-0 p-0">
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

              <dl className="m-0 mt-8 grid gap-x-8 gap-y-3.5 border-t border-rule pt-6 sm:grid-cols-2">
                {(Object.keys(WEIGHTS) as Part[]).map((part) => (
                  <div key={part}>
                    <div className="flex items-baseline justify-between gap-2">
                      <dt className="text-sm font-bold">
                        {PART_NAME[part]} <span className="font-semibold text-ink-soft">{WEIGHTS[part] * 100}% of the score</span>
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
        </section>

        <section aria-labelledby="day-title" className="mt-20 grid gap-8 border-t border-rule-strong pt-10 lg:mt-28 lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)] lg:gap-16 lg:pt-14">
          <h2 id="day-title" className="m-0 text-2xl leading-[1.1] font-extrabold tracking-[-0.025em]">
            A day with NeuroCal
          </h2>
          <ol className="m-0 list-none p-0">
            {DAY.map((step, i) => (
              <li key={step.time} className="grid grid-cols-[3.5rem_minmax(0,1fr)] gap-4">
                <time className="pt-0.5 text-sm font-bold text-synapse-ink tabular-nums">{step.time}</time>
                <div className={`relative border-l pl-6 ${i === DAY.length - 1 ? "border-transparent" : "border-rule-strong pb-8"}`}>
                  <span aria-hidden className="absolute top-1.5 -left-[5px] size-[9px] rounded-full bg-synapse ring-4 ring-mist" />
                  <h3 className="m-0 text-lg font-bold">{step.title}</h3>
                  <p className="mt-1 mb-0 max-w-[36rem] text-md text-pretty text-ink-soft">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <section aria-labelledby="straight-title" className="mt-20 grid gap-8 border-t border-rule-strong pt-10 lg:mt-28 lg:grid-cols-[minmax(0,27rem)_minmax(0,1fr)] lg:gap-16 lg:pt-14">
          <h2 id="straight-title" className="m-0 text-2xl leading-[1.1] font-extrabold tracking-[-0.025em]">
            Three things to know first
          </h2>
          <ul className="m-0 flex max-w-[40rem] list-none flex-col gap-4 p-0 text-md text-pretty">
            <li>
              <b className="font-bold">It is not medical advice.</b> <span className="text-ink-soft">NeuroCal shows patterns in what you log. It does not diagnose or treat anything.</span>
            </li>
            <li>
              <b className="font-bold">Suggestions come from your week.</b> <span className="text-ink-soft">Routines and products are matched to the parts of your score that were weakest.</span>
            </li>
            <li>
              <b className="font-bold">Paid links are labelled.</b>{" "}
              <span className="text-ink-soft">A product we earn a commission on says "Affiliate link". One sold by MitoProof, which is run by the people who make NeuroCal, says "Our brand".</span>
            </li>
          </ul>
        </section>

        <section className="mt-20 border-t border-rule-strong pt-10 lg:mt-28 lg:pt-14">
          <h2 className="m-0 max-w-[16ch] text-3xl leading-[1.02] font-extrabold tracking-[-0.035em] sm:text-display">Start with tonight's sleep.</h2>
          <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/sign-up" className={primary}>
              Create an account
            </Link>
            <p className="m-0 text-md text-ink-soft">Log it tomorrow morning and you have a first score.</p>
          </div>
        </section>
      </main>

      <footer className="mt-16 flex flex-wrap items-center justify-between gap-3 border-t border-rule pt-6 text-sm text-ink-soft">
        <span>NeuroCal</span>
        <span className="flex gap-5">
          <Link href="/intro" className="font-bold text-synapse-ink underline-offset-4 hover:underline">
            Take the tour
          </Link>
          <Link href="/sign-in" className="font-bold text-synapse-ink underline-offset-4 hover:underline">
            Sign in
          </Link>
        </span>
      </footer>
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
    <figure className="relative m-0 mx-auto aspect-square w-full max-w-[27rem]">
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
