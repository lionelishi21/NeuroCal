"use client";

interface Props {
  title: string;
  /** Said beside the title, e.g. "Average 65". */
  note?: string;
  /** Top of the scale. */
  max: number;
  values: (number | null)[];
  /** One short label per column for the day axis, e.g. "F". */
  days: string[];
  /** The selected column's value, as shown above it. */
  format: (value: number) => string;
  /** Optional reference line (e.g. the calorie target) with its label. */
  reference?: { value: number; label: string };
  selected: number | null;
  onSelect: (index: number) => void;
}

/**
 * One single-series column chart in the This week stack. The selected day is
 * the full-strength column with its value above it; the rest are the quieter
 * tint, and a day without data is a stub on the baseline. Decorative for
 * assistive tech: the day picker, the readout and the table carry every value.
 */
export function DayColumns({ title, note, max, values, days, format, reference, selected, onSelect }: Props) {
  const pct = (v: number) => `${Math.min(100, (v / max) * 100)}%`;
  return (
    <figure className="mx-4 mt-3 mb-0 rounded-card border border-rule bg-paper px-4 pt-4 pb-3">
      <figcaption className="flex items-baseline justify-between gap-2">
        <span className="text-md font-bold">{title}</span>
        {note && <span className="text-2xs text-ink-soft">{note}</span>}
      </figcaption>
      <div aria-hidden className="relative mt-3.5 grid h-[7.5rem] grid-cols-7 items-end gap-2 border-b border-rule">
        {values.map((value, i) => (
          <div key={i} className="flex h-full cursor-pointer flex-col items-center justify-end" onClick={() => onSelect(i)}>
            {selected === i && value !== null && <span className="mb-[3px] text-3xs font-bold whitespace-nowrap">{format(value)}</span>}
            <span
              className={`w-full max-w-[1.875rem] rounded-t-[7px] rounded-b-[2px] ${value === null ? "bg-track" : selected === i ? "bg-synapse" : "bg-synapse-faint"}`}
              style={{ height: value === null ? 4 : pct(value), minHeight: 4 }}
            />
          </div>
        ))}
        {reference && (
          <div className="pointer-events-none absolute inset-x-0 border-t-[1.5px] border-dashed border-ink-faint" style={{ bottom: pct(reference.value) }}>
            <span className="absolute -top-[1.125rem] right-0 bg-paper pl-1 text-3xs font-bold text-ink-soft">{reference.label}</span>
          </div>
        )}
      </div>
      <div aria-hidden className="mt-1.5 grid grid-cols-7 gap-2">
        {days.map((day, i) => (
          <span key={i} className="text-center text-3xs font-semibold text-ink-soft">
            {day}
          </span>
        ))}
      </div>
    </figure>
  );
}
