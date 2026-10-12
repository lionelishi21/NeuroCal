"use client";

import type { AdminWaitlistEntry } from "@neurocal/contracts";
import { useState } from "react";
import { useAdminWaitlist } from "../api/queries";
import { AdminCard, AdminShell, Stat } from "../components/AdminShell";
import { EmptyState, LoadFailed, LoadingLines } from "../components/ListStates";

const PLATFORM = { iphone: "iPhone", android: "Android" } as const;

export const joinedOn = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

function status(entry: AdminWaitlistEntry) {
  if (entry.unsubscribed)
    return { label: "Unsubscribed", className: "bg-track text-ink-soft" };
  if (!entry.confirmed)
    return { label: "Email not sent", className: "bg-beet-soft text-beet" };
  return {
    label: "On the list",
    className: "bg-synapse-soft text-synapse-ink",
  };
}

/** The waitlist as a table: who, which phone, when, and whether the confirmation email went out. */
export function WaitlistTable({ entries }: { entries: AdminWaitlistEntry[] }) {
  return (
    <div className="-mx-5 overflow-x-auto sm:-mx-6">
      <table className="w-full min-w-[34rem] border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-rule text-xs text-ink-soft">
            <th scope="col" className="px-5 py-2 font-bold sm:px-6">
              Email
            </th>
            <th scope="col" className="px-3 py-2 font-bold">
              Phone
            </th>
            <th scope="col" className="px-3 py-2 font-bold">
              Joined
            </th>
            <th scope="col" className="px-5 py-2 font-bold sm:px-6">
              Status
            </th>
          </tr>
        </thead>
        <tbody>
          {entries.map((entry) => {
            const s = status(entry);
            return (
              <tr
                key={entry.email}
                className="border-b border-rule last:border-b-0"
              >
                <td className="px-5 py-3 font-bold break-all sm:px-6">
                  {entry.email}
                </td>
                <td className="px-3 py-3 text-ink-soft">
                  {entry.platform ? PLATFORM[entry.platform] : "Not given"}
                </td>
                <td className="px-3 py-3 whitespace-nowrap text-ink-soft tabular-nums">
                  {joinedOn(entry.joinedAt)}
                </td>
                <td className="px-5 py-3 sm:px-6">
                  <span
                    className={`inline-block rounded-pill px-2.5 py-0.5 text-2xs font-bold whitespace-nowrap ${s.className}`}
                  >
                    {s.label}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const FILTERS = ["Everyone", "iPhone", "Android", "Unsubscribed"] as const;
type Filter = (typeof FILTERS)[number];
const matches: Record<Filter, (e: AdminWaitlistEntry) => boolean> = {
  Everyone: (e) => !e.unsubscribed,
  iPhone: (e) => !e.unsubscribed && e.platform === "iphone",
  Android: (e) => !e.unsubscribed && e.platform === "android",
  Unsubscribed: (e) => e.unsubscribed,
};

/** Everyone who asked to hear when the app is out, from the landing page's form. */
export function AdminWaitlist() {
  const waitlist = useAdminWaitlist();
  const [filter, setFilter] = useState<Filter>("Everyone");
  const [search, setSearch] = useState("");
  const data = waitlist.data;
  const term = search.trim().toLowerCase();
  const shown = (data?.entries ?? []).filter(
    (e) => matches[filter](e) && (!term || e.email.includes(term)),
  );

  return (
    <AdminShell
      title="Waitlist"
      detail="People who asked, on the landing page, to be emailed when the app is ready."
    >
      {waitlist.isPending && (
        <AdminCard>
          <LoadingLines label="Loading the waitlist" lines={5} />
        </AdminCard>
      )}
      {waitlist.isError && (
        <AdminCard>
          <LoadFailed
            title="Couldn't load the waitlist"
            onRetry={() => waitlist.refetch()}
          >
            Check your connection and try again.
          </LoadFailed>
        </AdminCard>
      )}
      {data && (
        <div className="flex flex-col gap-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="On the list" value={data.total} />
            <Stat label="iPhone" value={data.iphone} />
            <Stat
              label="Android"
              value={data.android}
              note={`${data.total - data.iphone - data.android} didn't say`}
            />
            <Stat label="Unsubscribed" value={data.unsubscribed} />
          </div>
          <AdminCard>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div
                role="group"
                aria-label="Show"
                className="flex flex-wrap gap-1.5"
              >
                {FILTERS.map((f) => (
                  <button
                    key={f}
                    type="button"
                    aria-pressed={filter === f}
                    onClick={() => setFilter(f)}
                    className={`h-9 cursor-pointer rounded-pill border px-3.5 text-xs font-bold ${filter === f ? "border-synapse bg-synapse-soft text-synapse-ink" : "border-rule bg-paper text-ink-soft hover:text-ink"}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <label className="sm:w-72">
                <span className="sr-only">Search by email</span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by email"
                  className="block h-10 w-full rounded-option border-[1.5px] border-rule bg-mist px-3.5 text-sm text-ink placeholder:text-ink-faint focus:border-synapse focus:shadow-[0_0_0_3px_var(--focus-ring)] focus:outline-none"
                />
              </label>
            </div>
            {shown.length > 0 ? (
              <WaitlistTable entries={shown} />
            ) : (
              <EmptyState
                title={data.entries.length ? "No one matches" : "No one yet"}
              >
                {data.entries.length
                  ? "Try another filter or search."
                  : "Sign-ups from the landing page show up here."}
              </EmptyState>
            )}
          </AdminCard>
        </div>
      )}
    </AdminShell>
  );
}
