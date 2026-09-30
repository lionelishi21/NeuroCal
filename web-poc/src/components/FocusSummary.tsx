import type { FocusScore } from "@neurocal/contracts";
import Link from "next/link";
import { useId } from "react";
import { Button } from "./Button";

/** Each input has the colour of the body system it measures. */
const rows: { key: keyof FocusScore["components"]; label: string; hint: string; color: string }[] = [
  { key: "sleep", label: "Sleep", hint: "last night", color: "var(--sleep)" },
  { key: "timing", label: "Evening timing", hint: "late food and screens", color: "var(--synapse)" },
  { key: "glycemic", label: "Glycemic load", hint: "yesterday's food", color: "var(--glucose)" },
  { key: "stress", label: "Stress", hint: "recent check-ins", color: "var(--chlorophyll)" },
];

const R = 90;
const CIRCUMFERENCE = 2 * Math.PI * R;

interface Props {
  focus: FocusScore;
  onLogSleep: () => void;
}

/**
 * Today's hero: the Focus Score as a glowing ring, the four inputs it is made
 * of underneath, then the AI-written explanation in its own panel.
 */
export function FocusSummary({ focus, onLogSleep }: Props) {
  const gradientId = useId();
  const hasScore = focus.score !== null;
  const filled = hasScore ? (CIRCUMFERENCE * focus.score!) / 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="relative mx-auto grid size-56 place-items-center">
        <span aria-hidden className="absolute inset-4 rounded-full bg-[radial-gradient(circle,var(--glow),transparent_70%)] blur-xl" />
        <svg viewBox="0 0 220 220" aria-hidden className="absolute inset-0 size-full -rotate-90">
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" style={{ stopColor: "var(--synapse)" }} />
              <stop offset="1" style={{ stopColor: "var(--ion)" }} />
            </linearGradient>
          </defs>
          <circle cx="110" cy="110" r={R} fill="none" stroke="var(--rule)" strokeWidth="12" />
          {hasScore && (
            <circle
              cx="110"
              cy="110"
              r={R}
              fill="none"
              stroke={`url(#${gradientId})`}
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
            />
          )}
        </svg>
        <p className="relative m-0 flex flex-col items-center">
          {hasScore ? (
            <>
              <span className="text-figure leading-none font-extrabold tracking-tight text-ink tabular-nums">{focus.score}</span>
              <span className="mt-1 text-sm text-ink-soft">out of 100</span>
            </>
          ) : (
            <span className="max-w-[9rem] text-center text-lg font-semibold text-ink">No score yet</span>
          )}
          <span className="mt-1 text-xs font-semibold tracking-wide text-synapse">Focus Score</span>
        </p>
      </div>

      <dl className="m-0 grid grid-cols-2 gap-x-6 gap-y-4">
        {rows.map(({ key, label, hint, color }) => {
          const value = focus.components[key];
          return (
            <div key={key} className="flex min-w-0 flex-col gap-1.5">
              <dt className="text-sm text-ink-soft">
                <span className="text-ink">{label}</span>
                <span className="block text-xs">{hint}</span>
              </dt>
              <dd className="m-0 flex flex-col gap-1.5">
                <span className={`text-lg font-semibold tabular-nums ${value === null ? "text-ink-soft" : "text-ink"}`}>
                  {value === null ? "No data" : Math.round(value * 100)}
                </span>
                <span aria-hidden className="block h-1 rounded-pill bg-rule">
                  {value !== null && (
                    <span className="block h-full rounded-pill" style={{ width: `${Math.round(value * 100)}%`, background: color }} />
                  )}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>

      <p className={`m-0 rounded-card bg-paper px-4 py-3.5 text-base ring-1 ring-rule ring-inset ${hasScore ? "text-ink" : "text-ink-soft"}`}>
        {focus.explanation}
      </p>

      <p className="-mt-2 mb-0 flex flex-wrap gap-x-5 text-sm">
        <Button variant="text" className="-ml-1" onClick={onLogSleep}>
          {focus.components.sleep === null ? "Log last night's sleep" : "Log sleep"}
        </Button>
        <Link href="/history#help" className="px-1 py-1 text-ink-soft underline decoration-rule underline-offset-4 hover:text-ink hover:decoration-ink">
          See what helps
        </Link>
      </p>
    </div>
  );
}
