import { AXIS_HOURS, AXIS_START_HOUR, LATE_SCREEN_FROM, type Night, hoursIntoEvening } from "../lib/nights";

const pct = (hours: number) => `${(Math.min(AXIS_HOURS, Math.max(0, hours)) / AXIS_HOURS) * 100}%`;

/** Axis ticks every three hours; the ones marked `wide` only show from the sm breakpoint. */
const ticks = [0, 3, 6, 9, 12, 15, 18].map((offset) => ({
  offset,
  label: new Date(2000, 0, 1, (AXIS_START_HOUR + offset) % 24).toLocaleTimeString(undefined, { hour: "numeric" }),
  wide: offset % 6 !== 0,
}));

const compact = (minutes: number) => `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;

interface Props {
  nights: Night[];
  /** Row label for a night, e.g. "Mon". */
  label: (night: Night) => string;
}

/**
 * The Sleep screen's chart: every night on one clock axis from 6pm to noon.
 * The band is sleep, the dot is the last meal, the thin line is screen time
 * after 10pm (its length is the minutes logged; it always starts at 10pm). The
 * heavier vertical line is 9pm, where late eating starts to count. Decorative
 * for assistive tech: the table carries every value.
 */
export function NightBands({ nights, label }: Props) {
  return (
    <figure className="m-0">
      <div aria-hidden className="grid grid-cols-[2.75rem_1fr_3.25rem] items-center gap-x-3 text-xs text-ink-soft">
        <span />
        <div className="relative h-5">
          {ticks.map(({ offset, label: text, wide }) => (
            <span
              key={offset}
              className={`absolute top-0 whitespace-nowrap ${wide ? "hidden sm:block" : ""} ${
                offset === 0 ? "" : offset === AXIS_HOURS ? "-translate-x-full" : "-translate-x-1/2"
              }`}
              style={{ left: pct(offset) }}
            >
              {text}
            </span>
          ))}
        </div>
        <span />

        {nights.map((night) => {
          const bed = night.bedtime === null ? null : hoursIntoEvening(night.bedtime);
          const wake = night.wakeTime === null ? null : hoursIntoEvening(night.wakeTime);
          const meal = night.lastMealAt === null ? null : hoursIntoEvening(night.lastMealAt);
          const screens = night.lateScreenMinutes ?? 0;
          return (
            <div key={night.morning} className="col-span-full grid grid-cols-subgrid items-center border-t border-rule">
              <span className="text-ink">{label(night)}</span>
              <div className="relative h-9">
                {ticks.map(({ offset }) => (
                  <span
                    key={offset}
                    className={`absolute inset-y-0 border-l ${offset === 3 ? "border-ink-soft" : "border-rule"}`}
                    style={{ left: pct(offset) }}
                  />
                ))}
                {bed !== null && wake !== null && (
                  <span
                    className="absolute inset-y-2.5 rounded-pill bg-sleep"
                    // A bedtime before 6pm falls off the axis; start the band at its edge.
                    style={{ left: pct(bed > wake ? 0 : bed), right: `calc(100% - ${pct(wake)})` }}
                  />
                )}
                {screens > 0 && (
                  <span
                    className="absolute bottom-0.5 h-[3px] rounded-pill bg-synapse"
                    style={{ left: pct(hoursIntoEvening(LATE_SCREEN_FROM)), width: pct(screens / 60) }}
                  />
                )}
                {meal !== null && meal <= AXIS_HOURS / 2 && (
                  <span
                    className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-glucose ring-2 ring-mist"
                    style={{ left: pct(meal) }}
                  />
                )}
              </div>
              <span className="text-right tabular-nums">{night.sleepMinutes === null ? "–" : compact(night.sleepMinutes)}</span>
            </div>
          );
        })}
        <span className="col-span-full border-t border-rule" />
      </div>

      <figcaption className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-soft">
        <span className="flex items-center gap-2">
          <span aria-hidden className="h-2 w-5 rounded-pill bg-sleep" />
          Asleep
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden className="size-2.5 rounded-full bg-glucose" />
          Last meal
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden className="h-[3px] w-5 rounded-pill bg-synapse" />
          Screens after 10pm
        </span>
        <span className="flex items-center gap-2">
          <span aria-hidden className="h-3 border-l border-ink-soft" />
          9pm, when eating counts as late
        </span>
      </figcaption>
    </figure>
  );
}
