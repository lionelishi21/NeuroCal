"use client";

import Link from "next/link";
import { useState } from "react";
import { useHistory } from "../api/queries";
import { Button } from "../components/Button";
import { NightBands } from "../components/NightBands";
import { Readout } from "../components/Readout";
import { LogScreenTimeSheet } from "../features/log-screen-time/LogScreenTimeSheet";
import { LogSleepSheet } from "../features/log-sleep/LogSleepSheet";
import { formatClock, hoursAndMinutes } from "../lib/format";
import { type Night, ateLate, averageSleep, eveningInsights, nightsFrom, usualBedtime } from "../lib/nights";

const NIGHTS = 7;
const weekday = (date: string, style: "short" | "long") => new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: style });

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
  const lastNight = nights.at(-1);
  const hasSleep = nights.some((n) => n.sleepMinutes !== null);
  const average = averageSleep(nights);
  const bedtime = usualBedtime(nights);
  const lateDinners = nights.filter(ateLate).length;
  const insights = eveningInsights(nights);
  const nightName = (night: Night, style: "short" | "long") =>
    night === lastNight ? "Last night" : style === "short" ? weekday(night.evening, "short") : `${weekday(night.evening, "long")} night`;

  return (
    <>
      <main className="relative mx-auto w-full max-w-3xl px-4 pt-6 pb-16 sm:px-8 lg:pt-12">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-72 bg-[radial-gradient(36rem_14rem_at_30%_0%,var(--glow),transparent_70%)]" />
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="m-0 text-2xl">Sleep and evenings</h1>
          <Link href="/" className="shrink-0 text-sm text-ink-soft underline decoration-rule underline-offset-4 hover:text-ink">
            Back to today
          </Link>
        </div>
        <p className="mt-2 mb-0 max-w-[var(--measure)] text-ink-soft">
          Your last seven nights, with what came before each one: when you last ate and how long you stayed on screens.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button onClick={() => setLoggingSleep(true)}>Log sleep</Button>
          <Button variant="quiet" onClick={() => setLoggingScreens(true)}>
            Log screen time
          </Button>
        </div>

        {history.isPending && <p className="mt-8 text-ink-soft">Loading your nights…</p>}
        {history.isError && (
          <div role="alert" className="mt-8">
            <p className="m-0 text-beet">Your nights didn't load. Check your connection and try again.</p>
            <Button variant="text" className="mt-1 -ml-1" onClick={() => history.refetch()}>
              Try again
            </Button>
          </div>
        )}

        {history.data && !hasSleep && (
          <p className="mt-8 max-w-[var(--measure)] border-t border-rule pt-4 text-ink-soft">
            No sleep logged in the past week. Log last night's sleep and it appears here, next to your last meal of the evening.
          </p>
        )}

        {hasSleep && (
          <>
            <dl aria-label="This week" className="mt-8 mb-0 grid grid-cols-2 gap-x-6 gap-y-3 rounded-card bg-paper p-5 ring-1 ring-rule ring-inset sm:grid-cols-3">
              <Readout value={average === null ? "No data" : hoursAndMinutes(average)} label="Average sleep" swatch="bg-chart-sleep" />
              <Readout value={bedtime ? formatClock(bedtime) : "No data"} label="Usual bedtime" />
              <Readout value={`${lateDinners} of ${nights.length}`} label="Nights you ate after 9pm" swatch="bg-glucose" />
            </dl>

            <section aria-labelledby="nights-title" className="mt-10">
              <h2 id="nights-title" className="mt-0 mb-4 text-xl">
                Night by night
              </h2>
              <NightBands nights={nights} label={(night) => (night === lastNight ? "Last" : weekday(night.evening, "short"))} />
            </section>

            <section aria-labelledby="insights-title" className="mt-12">
              <h2 id="insights-title" className="mt-0 mb-3 text-xl">
                What your evenings did
              </h2>
              <ul className="m-0 max-w-[var(--measure)] list-none p-0">
                {insights.map((text) => (
                  <li key={text} className="border-t border-rule py-3.5 text-ink last:border-b">
                    {text}
                  </li>
                ))}
              </ul>
              <p className="mt-4 mb-0 text-sm text-ink-soft">
                <Link href="/history#help" className="underline decoration-rule underline-offset-4 hover:text-ink hover:decoration-ink">
                  See what helps
                </Link>
              </p>
            </section>

            <section aria-labelledby="table-title" className="mt-12">
              <h2 id="table-title" className="mt-0 mb-3 text-xl">
                Every night
              </h2>
              <div className="overflow-x-auto rounded-card bg-paper px-4 ring-1 ring-rule ring-inset">
                <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-rule text-ink-soft">
                      <th scope="col" className="py-2 pr-4 font-normal">Night</th>
                      <th scope="col" className="py-2 pr-4 font-normal">Last meal</th>
                      <th scope="col" className="py-2 pr-4 text-right font-normal">Screens after 10pm</th>
                      <th scope="col" className="py-2 pr-4 font-normal">Bedtime</th>
                      <th scope="col" className="py-2 pr-4 font-normal">Woke</th>
                      <th scope="col" className="py-2 pr-4 text-right font-normal">Sleep</th>
                      <th scope="col" className="py-2 text-right font-normal">Focus next day</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...nights].reverse().map((n) => (
                      <tr key={n.morning} className="border-b border-rule last:border-b-0">
                        <th scope="row" className="py-2.5 pr-4 font-normal text-ink">{nightName(n, "long")}</th>
                        <td className={`py-2.5 pr-4 ${ateLate(n) ? "font-semibold text-glucose-ink" : ""}`}>
                          {n.lastMealAt ? formatClock(n.lastMealAt) : "–"}
                        </td>
                        <td className="py-2.5 pr-4 text-right tabular-nums">
                          {n.lateScreenMinutes === null ? "–" : n.lateScreenMinutes === 0 ? "None" : `${n.lateScreenMinutes} min`}
                        </td>
                        <td className="py-2.5 pr-4">{n.bedtime ? formatClock(n.bedtime) : "–"}</td>
                        <td className="py-2.5 pr-4">{n.wakeTime ? formatClock(n.wakeTime) : "–"}</td>
                        <td className="py-2.5 pr-4 text-right tabular-nums">{n.sleepMinutes === null ? "–" : hoursAndMinutes(n.sleepMinutes)}</td>
                        <td className="py-2.5 text-right tabular-nums">{n.focusScore ?? "–"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>

      <LogSleepSheet open={loggingSleep} onOpenChange={setLoggingSleep} />
      <LogScreenTimeSheet open={loggingScreens} onOpenChange={setLoggingScreens} />
    </>
  );
}
