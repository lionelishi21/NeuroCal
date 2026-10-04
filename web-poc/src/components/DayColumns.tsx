"use client";

interface Props {
  title: string;
  /** Top of the scale; the only tick besides the baseline. */
  max: number;
  maxLabel: string;
  values: (number | null)[];
  /** Tailwind background class for the columns, e.g. "bg-chart-focus". */
  colorClass: string;
  /** Optional reference line (e.g. the calorie target) with its label. */
  reference?: { value: number; label: string };
  active: number | null;
  onActive: (index: number | null) => void;
}

/**
 * One single-series column chart in the History stack. Columns are thin
 * (<= 24px), rounded at the data end and square at the baseline; the grid is a
 * hairline at the top tick and the baseline. The chart is decorative for
 * assistive tech: the readout and the table carry every value.
 */
export function DayColumns({ title, max, maxLabel, values, colorClass, reference, active, onActive }: Props) {
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <figure className="m-0">
      <figcaption className="mb-2 flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold text-ink">{title}</span>
        <span className="text-ink-soft">{maxLabel}</span>
      </figcaption>
      <div aria-hidden className="relative h-28 border-t border-b border-rule">
        {reference && (
          <div className="pointer-events-none absolute inset-x-0 z-10 border-t border-ink-soft" style={{ bottom: pct(reference.value) }}>
            <span className="absolute -top-5 right-0 bg-mist pl-1 text-xs text-ink-soft">{reference.label}</span>
          </div>
        )}
        <div className="absolute inset-0 grid grid-cols-7">
          {values.map((value, i) => (
            <div
              key={i}
              className="relative flex h-full items-end justify-center"
              onPointerEnter={() => onActive(i)}
              onPointerLeave={() => onActive(null)}
            >
              {value === null ? (
                <span className="mb-1 text-xs text-ink-soft">–</span>
              ) : (
                <span
                  className={`block w-[min(24px,55%)] rounded-t-[4px] transition-opacity duration-150 ${colorClass} ${
                    active !== null && active !== i ? "opacity-35" : ""
                  }`}
                  style={{ height: pct(value), minHeight: value > 0 ? 2 : 0 }}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </figure>
  );
}
