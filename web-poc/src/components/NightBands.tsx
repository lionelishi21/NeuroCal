import { AXIS_HOURS, AXIS_START_HOUR, LATE_EATING_FROM, LATE_SCREEN_FROM, type Night, hoursIntoEvening } from "../lib/nights";

const pct = (hours: number) => `${(Math.min(AXIS_HOURS, Math.max(0, hours)) / AXIS_HOURS) * 100}%`;

/** Axis ticks every three hours, as two-digit hours ("18", "21", "00" …). */
const ticks = [0, 3, 6, 9, 12, 15, 18].map((offset) => ({ offset, label: String((AXIS_START_HOUR + offset) % 24).padStart(2, "0") }));

interface Props {
  nights: Night[];
  /** Row label for a night, e.g. "Mon". */
  label: (night: Night) => string;
}

/**
 * The Sleep screen's chart: every night on one clock axis from 18:00 to noon.
 * The bar is sleep, the dot is the last meal, the thin line is screen time
 * after 22:00 (its length is the minutes logged; it always starts at 22:00).
 * The dashed line is 21:00, where late eating starts to count. Decorative
 * for assistive tech: the table carries every value.
 */
export function NightBands({ nights, label }: Props) {
  return (
    <figure className="m-0">
      <figcaption className="flex flex-wrap gap-x-3.5 gap-y-1.5 text-2xs text-ink-soft">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2 w-4 rounded-pill bg-synapse" />
          Asleep
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="size-[0.5625rem] rounded-full bg-glucose ring-1 ring-glucose ring-offset-2 ring-offset-paper" />
          Last meal
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-1 w-4 rounded-pill bg-ion" />
          Screens after {LATE_SCREEN_FROM}
        </span>
      </figcaption>

      <div aria-hidden className="mt-3.5 grid grid-cols-[2.125rem_minmax(0,1fr)] gap-x-1.5">
        <span />
        <div className="relative h-4 text-[0.625rem] font-semibold text-ink-faint">
          {ticks.map(({ offset, label: text }) => (
            <span
              key={offset}
              className={`absolute ${offset === 0 ? "" : offset === AXIS_HOURS ? "-translate-x-full" : "-translate-x-1/2"}`}
              style={{ left: pct(offset) }}
            >
              {text}
            </span>
          ))}
        </div>

        <div className="flex flex-col">
          {nights.map((night) => (
            <span key={night.morning} className="flex h-[2.125rem] items-center text-2xs font-bold">
              {label(night)}
            </span>
          ))}
        </div>
        <div className="relative">
          {ticks.map(({ offset }) => (
            <span key={offset} className="absolute inset-y-0 border-l border-rule" style={{ left: pct(offset) }} />
          ))}
          <span className="absolute -top-1 bottom-0 z-[2] border-l-[1.5px] border-dashed border-glucose" style={{ left: pct(hoursIntoEvening(LATE_EATING_FROM)) }}>
            <span className="absolute -bottom-[1.125rem] -left-3.5 text-[0.625rem] font-bold text-glucose-ink">{LATE_EATING_FROM}</span>
          </span>
          {nights.map((night) => {
            const bed = night.bedtime === null ? null : hoursIntoEvening(night.bedtime);
            const wake = night.wakeTime === null ? null : hoursIntoEvening(night.wakeTime);
            const meal = night.lastMealAt === null ? null : hoursIntoEvening(night.lastMealAt);
            const screens = night.lateScreenMinutes ?? 0;
            return (
              <div key={night.morning} className="relative h-[2.125rem]">
                {bed !== null && wake !== null && (
                  <span
                    className="absolute top-[0.5625rem] h-3 rounded-pill bg-synapse"
                    // A bedtime before 18:00 falls off the axis; start the bar at its edge.
                    style={{ left: pct(bed > wake ? 0 : bed), right: `calc(100% - ${pct(wake)})` }}
                  />
                )}
                {screens > 0 && (
                  <span className="absolute top-[1.5625rem] h-1 rounded-pill bg-ion" style={{ left: pct(hoursIntoEvening(LATE_SCREEN_FROM)), width: pct(screens / 60) }} />
                )}
                {meal !== null && meal <= AXIS_HOURS / 2 && (
                  <span className="absolute top-2.5 z-[3] size-2.5 -translate-x-1/2 rounded-full border-2 border-paper bg-glucose" style={{ left: pct(meal) }} />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <div aria-hidden className="h-4" />
    </figure>
  );
}
