"use client";

import type {
  AdminFunnel as Funnel,
  AdminFunnelWeek,
} from "@neurocal/contracts";
import { useAdminFunnel } from "../api/queries";
import { AdminCard, AdminShell, Stat } from "../components/AdminShell";
import { EmptyState, LoadFailed, LoadingLines } from "../components/ListStates";

type Counts = Funnel["total"];

/** The funnel's steps, in order. */
export const STEPS: { key: keyof Counts; label: string }[] = [
  { key: "signedUp", label: "Signed up" },
  { key: "onboarded", label: "Finished onboarding" },
  { key: "subscribed", label: "Started a trial or bought" },
  { key: "paid", label: "Paid" },
];

/** A share as a whole percent, or a dash when there is nothing to divide by. */
export const percent = (part: number, whole: number) =>
  whole > 0 ? `${Math.round((part / whole) * 100)}%` : "–";

const weekOf = (iso: string) =>
  new Date(`${iso}T00:00:00Z`).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

/** The steps as bars against sign-ups, each with its count and how many of the step before made it. */
export function FunnelBars({ counts }: { counts: Counts }) {
  return (
    <ol className="m-0 flex list-none flex-col gap-4 p-0">
      {STEPS.map((step, i) => {
        const value = counts[step.key];
        const before = i > 0 ? counts[STEPS[i - 1]!.key] : undefined;
        const width = counts.signedUp > 0 ? (value / counts.signedUp) * 100 : 0;
        return (
          <li key={step.key}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="font-bold">{step.label}</span>
              <span className="text-ink-soft tabular-nums">
                <span className="font-extrabold text-ink">{value}</span>
                {before !== undefined && ` · ${percent(value, before)}`}
              </span>
            </div>
            <div
              className="h-3 rounded-r-[4px] bg-track"
              title={`${step.label}: ${value} (${percent(value, counts.signedUp)} of sign-ups)`}
            >
              <div
                className="h-full rounded-r-[4px] bg-synapse"
                style={{ width: `${width}%`, minWidth: value > 0 ? 4 : 0 }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** Each week's sign-ups and how far they have got, newest first. */
function WeekTable({ weeks }: { weeks: AdminFunnelWeek[] }) {
  return (
    <div className="-mx-5 overflow-x-auto sm:-mx-6">
      <table className="w-full min-w-[38rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-rule text-xs text-ink-soft">
            <th scope="col" className="px-5 py-2 font-bold sm:px-6">
              Week of
            </th>
            {STEPS.map((s) => (
              <th
                key={s.key}
                scope="col"
                className="px-3 py-2 text-right font-bold"
              >
                {s.label}
              </th>
            ))}
            <th scope="col" className="px-5 py-2 text-right font-bold sm:px-6">
              Sign-up to paid
            </th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((w, i) => (
            <tr
              key={w.weekStart}
              className="border-b border-rule last:border-b-0"
            >
              <th
                scope="row"
                className="px-5 py-3 text-left font-bold whitespace-nowrap sm:px-6"
              >
                {weekOf(w.weekStart)}
                {i < 2 && (
                  <span className="ml-2 rounded-pill bg-track px-2 py-0.5 text-2xs font-bold text-ink-soft">
                    Trials running
                  </span>
                )}
              </th>
              {STEPS.map((s) => (
                <td
                  key={s.key}
                  className={`px-3 py-3 text-right tabular-nums ${w[s.key] ? "" : "text-ink-faint"}`}
                >
                  {w[s.key]}
                </td>
              ))}
              <td className="px-5 py-3 text-right text-ink-soft tabular-nums sm:px-6">
                {percent(w.paid, w.signedUp)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Sign-ups and how many go on to onboard, start a trial and pay, by week. */
export function AdminFunnel() {
  const funnel = useAdminFunnel();
  const data = funnel.data;

  return (
    <AdminShell
      title="Funnel"
      detail="Who signs up in the app, and how many go on to finish onboarding, start a trial and pay. Last twelve weeks."
    >
      {funnel.isPending && (
        <AdminCard>
          <LoadingLines label="Loading the funnel" lines={5} />
        </AdminCard>
      )}
      {funnel.isError && (
        <AdminCard>
          <LoadFailed
            title="Couldn't load the funnel"
            onRetry={() => funnel.refetch()}
          >
            Check your connection and try again.
          </LoadFailed>
        </AdminCard>
      )}
      {data && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat
              label="Signed up"
              value={data.total.signedUp}
              note="Last twelve weeks"
            />
            <Stat
              label="Finished onboarding"
              value={percent(data.total.onboarded, data.total.signedUp)}
              note={`${data.total.onboarded} people`}
            />
            <Stat
              label="Started a trial or bought"
              value={percent(data.total.subscribed, data.total.onboarded)}
              note="Of those who onboarded"
            />
            <Stat
              label="Paid"
              value={percent(data.total.paid, data.total.subscribed)}
              note="Of trials and purchases"
            />
          </div>
          {data.total.signedUp === 0 ? (
            <AdminCard>
              <EmptyState title="No sign-ups yet">
                Accounts created in the app show up here, by the week they
                signed up.
              </EmptyState>
            </AdminCard>
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
              <AdminCard title="Last twelve weeks" className="self-start">
                <FunnelBars counts={data.total} />
                <p className="mt-5 mb-0 text-xs text-pretty text-ink-soft">
                  Percentages are of the step before. Monthly buyers skip the
                  trial and count as started. Installs and paywall views
                  aren&rsquo;t here: they come from PostHog once its key is in
                  the app.
                </p>
              </AdminCard>
              <AdminCard title="By week">
                <WeekTable weeks={data.weeks} />
                <p className="mt-4 mb-0 text-xs text-pretty text-ink-soft">
                  Each row follows the people who signed up that week. Trials
                  last 14 days, so the newest two weeks still have payments to
                  come.
                </p>
              </AdminCard>
            </div>
          )}
        </div>
      )}
    </AdminShell>
  );
}
