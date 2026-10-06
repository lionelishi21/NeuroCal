"use client";

import { useState } from "react";
import { useHistory } from "../api/queries";
import { Button } from "../components/Button";
import { ScreenEmpty, ScreenFailed, ScreenLoading } from "../components/ListStates";
import { NightBands } from "../components/NightBands";
import { ActionBar, Screen, ScreenHeader, Section, cardClass } from "../components/Screen";
import { LogScreenTimeSheet } from "../features/log-screen-time/LogScreenTimeSheet";
import { LogSleepSheet } from "../features/log-sleep/LogSleepSheet";
import { type Night, ateLate, averageSleep, eveningInsights, nightsFrom, usualBedtime } from "../lib/nights";

const NIGHTS = 7;
/** Under this, a night's sleep is marked as short. */
const SHORT_SLEEP_MINUTES = 7 * 60;
const weekday = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: "short" });
/** "6h 30m": the table has six columns on a phone. */
const compact = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(Math.round(minutes % 60)).padStart(2, "0")}m`;

const columns = "grid grid-cols-[3.375rem_repeat(5,minmax(0,1fr))] gap-1 px-3";

/**
 * Sleep and evenings for the past week: each night on one clock axis (sleep,
 * the last meal, late screens), what the evenings did to sleep in plain
 * sentences, and a table with every value. A night is an evening plus the
 * morning after, so it reads eight days of history for seven nights.
 */
export function Sleep() {
  const history = useHistory(NIGHTS + 1);
  const [loggingSleep, setLoggingSleep] = useState(false);
  const [loggingScreens, setLoggingScreens] = useState(false);

  const nights = history.data ? nightsFrom(history.data.days) : [];
  const hasSleep = nights.some((n) => n.sleepMinutes !== null);
  const average = averageSleep(nights);
  const bedtime = usualBedtime(nights);
  const lateDinners = nights.filter(ateLate).length;
  const insights = eveningInsights(nights);
  const label = (night: Night) => weekday(night.evening);

  return (
    <>
      <Screen actions>
        <ScreenHeader title="Sleep and evenings" detail={`Last ${NIGHTS} nights`} back={{ href: "/", label: "Back to Today" }} />

        {history.isPending && <ScreenLoading label="Loading your nights" heights={[5.25, 18.75, 7.5]} />}
        {history.isError && (
          <ScreenFailed title="Couldn't load your nights" onRetry={() => history.refetch()}>
            Check your connection and try again.
          </ScreenFailed>
        )}
        {history.data && !hasSleep && (
          <ScreenEmpty title="No sleep logged yet" action="Log sleep" onAction={() => setLoggingSleep(true)}>
            Log last night and we'll put your sleep, last meal and late screens on one clock, so patterns are easy to spot.
          </ScreenEmpty>
        )}

        {hasSleep && (
          <>
            <dl aria-label="This week" className="m-0 grid grid-cols-3 gap-2 px-4 pt-3.5">
              <Figure value={average === null ? "No data" : compact(average)} label="Average sleep" />
              <Figure value={bedtime ?? "No data"} label="Usual bedtime" />
              <Figure value={`${lateDinners} of ${nights.length}`} label="Nights eaten after 9pm" watch={lateDinners > 2} />
            </dl>

            <section aria-labelledby="clock-title" className={`${cardClass} mt-3 px-3.5 pt-4 pb-3.5`}>
              <h2 id="clock-title" className="m-0 mb-2 text-md font-bold">
                Your nights on one clock
              </h2>
              <NightBands nights={nights} label={label} />
            </section>

            {insights.length > 0 && (
              <Section title="What we noticed" kind="title">
                <ul className={`${cardClass} m-0 list-none overflow-hidden p-0`}>
                  {insights.map((text) => (
                    <li key={text} className="border-t border-rule px-4 py-3.5 text-md text-pretty first:border-t-0">
                      {text}
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            <Section title="Every night" kind="title">
              <table className={`${cardClass} block w-auto overflow-hidden text-left text-xs`}>
                <thead className="block">
                  <tr className={`${columns} border-b border-rule py-2.5 text-3xs font-bold text-ink-soft`}>
                    <th scope="col" className="font-bold">Night</th>
                    <th scope="col" className="font-bold">Bed</th>
                    <th scope="col" className="font-bold">Woke</th>
                    <th scope="col" className="font-bold">Slept</th>
                    <th scope="col" className="font-bold">Ate</th>
                    <th scope="col" className="font-bold">Screens</th>
                  </tr>
                </thead>
                <tbody className="block">
                  {nights.map((n) => (
                    <tr key={n.morning} className={`${columns} min-h-11 items-center border-t border-rule first:border-t-0`}>
                      <th scope="row" className="font-bold">{label(n)}</th>
                      <td>{n.bedtime ?? "–"}</td>
                      <td>{n.wakeTime ?? "–"}</td>
                      <td className={`font-bold ${n.sleepMinutes !== null && n.sleepMinutes < SHORT_SLEEP_MINUTES ? "text-glucose-ink" : ""}`}>
                        {n.sleepMinutes === null ? "–" : compact(n.sleepMinutes)}
                      </td>
                      <td className={ateLate(n) ? "text-glucose-ink" : ""}>{n.lastMealAt ?? "–"}</td>
                      <td>{n.lateScreenMinutes === null ? "–" : n.lateScreenMinutes === 0 ? "None" : `${n.lateScreenMinutes} min`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Section>
          </>
        )}
      </Screen>

      <ActionBar>
        <Button className="flex-1 px-2 text-base" onClick={() => setLoggingSleep(true)}>
          Log sleep
        </Button>
        <Button variant="quiet" className="h-14 flex-1 bg-paper px-2 text-base" onClick={() => setLoggingScreens(true)}>
          Log screen time
        </Button>
      </ActionBar>

      <LogSleepSheet open={loggingSleep} onOpenChange={setLoggingSleep} />
      <LogScreenTimeSheet open={loggingScreens} onOpenChange={setLoggingScreens} />
    </>
  );
}

/** One of the week's three headline numbers. `watch` marks one worth a second look. */
function Figure({ value, label, watch = false }: { value: string; label: string; watch?: boolean }) {
  return (
    // Source order is dt → dd (valid HTML); the value reads first visually.
    <div className="flex flex-col-reverse justify-end rounded-[1.125rem] border border-rule bg-paper p-3">
      <dt className="mt-0.5 text-2xs leading-[1.3] text-ink-soft">{label}</dt>
      <dd className={`m-0 text-xl font-extrabold tracking-[-0.02em] tabular-nums ${watch ? "text-glucose-ink" : ""}`}>{value}</dd>
    </div>
  );
}
