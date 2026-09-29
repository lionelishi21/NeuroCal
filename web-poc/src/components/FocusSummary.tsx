import type { FocusScore } from "@neurocal/contracts";
import { Button } from "./Button";

const rows: { key: keyof FocusScore["components"]; label: string; hint: string }[] = [
  { key: "sleep", label: "Sleep", hint: "last night" },
  { key: "timing", label: "Evening timing", hint: "late food and screens" },
  { key: "glycemic", label: "Glycemic load", hint: "yesterday's food" },
  { key: "stress", label: "Stress", hint: "recent check-ins" },
];

interface Props {
  focus: FocusScore;
  onLogSleep: () => void;
}

/**
 * Today's Focus Score as a ledger of its inputs. The number is the summary;
 * the rows show what it is made of; the synapse rule marks AI-written text.
 */
export function FocusSummary({ focus, onLogSleep }: Props) {
  const hasScore = focus.score !== null;
  return (
    <div className="border-t border-rule pt-4">
      <p className="m-0 flex items-baseline gap-2">
        {hasScore ? (
          <>
            <span className="text-2xl font-semibold text-synapse">{focus.score}</span>
            <span className="text-sm text-ink-soft">out of 100</span>
          </>
        ) : (
          <span className="text-lg font-semibold text-ink">No score yet</span>
        )}
      </p>

      <dl className="mt-4 mb-0 grid max-w-[var(--measure)] grid-cols-[minmax(0,1fr)_4.5rem] gap-x-4 gap-y-2.5 text-sm">
        {rows.map(({ key, label, hint }) => {
          const value = focus.components[key];
          return (
            <div key={key} className="contents">
              <dt className="min-w-0">
                <span className="text-ink">{label}</span> <span className="text-ink-soft">({hint})</span>
                <span aria-hidden className="mt-1 block h-1 rounded-pill bg-rule">
                  {value !== null && (
                    <span className="block h-full rounded-pill bg-synapse" style={{ width: `${Math.round(value * 100)}%` }} />
                  )}
                </span>
              </dt>
              <dd className={`m-0 self-center text-right tabular-nums ${value === null ? "text-ink-soft" : "text-ink"}`}>
                {value === null ? "No data" : `${Math.round(value * 100)}%`}
              </dd>
            </div>
          );
        })}
      </dl>

      <p className={`mt-4 mb-0 max-w-[var(--measure)] text-base ${hasScore ? "border-l-2 border-synapse pl-4" : "text-ink-soft"}`}>
        {focus.explanation}
      </p>

      <Button variant="text" className="mt-2 -ml-1 text-sm" onClick={onLogSleep}>
        {focus.components.sleep === null ? "Log last night's sleep" : "Log sleep"}
      </Button>
    </div>
  );
}
