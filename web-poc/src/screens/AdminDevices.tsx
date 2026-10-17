"use client";

import type { DeviceCandidate } from "@neurocal/contracts";
import { useState } from "react";
import { RequestFailed } from "../api/client";
import { useAdminDevices, useReviewDevice, useScanDevices } from "../api/queries";
import { AdminShell } from "../components/AdminShell";
import { Button } from "../components/Button";
import { ScreenFailed, ScreenLoading } from "../components/ListStates";
import { Section, cardClass } from "../components/Screen";
import { useToast } from "../components/Toast";

const problem = (error: unknown, fallback: string) => (error instanceof RequestFailed ? error.message : fallback);

/** Fields on cards take the page colour, as on the Products screen. */
const field =
  "block w-full rounded-option border-[1.5px] border-rule bg-mist px-3.5 text-md text-ink placeholder:text-ink-faint focus:border-synapse focus:shadow-[0_0_0_3px_var(--focus-ring)] focus:outline-none";
const fieldLabel = "text-xs font-bold";
const fieldError = "text-2xs font-semibold text-beet";

/** Each category in the colour of the swap it makes easy. */
const TONE: Record<DeviceCandidate["tag"], string> = {
  "kitchen:air-fryer": "bg-glucose-soft text-glucose-ink",
  "kitchen:water-filter": "bg-ion-soft text-ion-ink",
  "kitchen:ice-cream-maker": "bg-synapse-soft text-synapse-ink",
  "kitchen:blender": "bg-chlorophyll-soft text-chlorophyll",
};

/**
 * Kitchen devices for admins: once a month each category the shopping review can suggest is searched,
 * and new devices wait here. An approved one becomes a product the shopping review can suggest.
 */
export function AdminDevices() {
  const list = useAdminDevices();
  const scan = useScanDevices();
  const toast = useToast();
  const forbidden = list.error instanceof RequestFailed && list.error.status === 403;
  const devices = list.data?.devices ?? [];
  const pending = devices.filter((d) => d.status === "pending");
  const reviewed = devices.filter((d) => d.status !== "pending");

  return (
    <AdminShell title="Devices" detail="Kitchen devices the shopping review can suggest. New ones wait here until you approve them.">
      <div className="-mx-4 max-w-[48rem] sm:-mx-5">
        {list.isPending && <ScreenLoading label="Loading devices" heights={[16, 12, 12]} />}
        {forbidden && (
          <p role="alert" className="m-4 rounded-hero border border-rule bg-paper px-5 py-6 text-md">
            This page is for admins. Ask an admin to add you.
          </p>
        )}
        {list.isError && !forbidden && (
          <ScreenFailed title="Couldn't load devices" onRetry={() => list.refetch()}>
            Check your connection and try again.
          </ScreenFailed>
        )}

        {list.data && (
          <>
            <div className="mx-4 mt-[1.125rem] flex flex-wrap items-center gap-3">
              {list.data.canScan ? (
                <>
                  <Button
                    variant="soft"
                    className="h-10 px-3.5 text-xs"
                    disabled={scan.isPending}
                    onClick={() =>
                      scan.mutate(undefined, {
                        onSuccess: ({ added }) => toast(added ? `${added} new ${added === 1 ? "device" : "devices"} found` : "No new devices"),
                      })
                    }
                  >
                    {scan.isPending ? "Looking… (up to a minute)" : "Look for new devices"}
                  </Button>
                  <span className="text-xs text-ink-soft">Air fryers, water filters, ice cream makers and blenders are searched on the 2nd of each month.</span>
                </>
              ) : (
                <span className="text-xs text-ink-soft">Add TAVILY_API_KEY to the app secret to look for new devices each month.</span>
              )}
              {scan.isError && <span className={fieldError}>{problem(scan.error, "Couldn't look for new devices.")}</span>}
            </div>

            <Section title={`Waiting for review${pending.length ? ` (${pending.length})` : ""}`} kind="title" className="[&>h2]:pt-5">
              {pending.length === 0 ? (
                <p className="mx-4 mt-0 mb-0 rounded-card border-[1.5px] border-dashed border-rule-strong p-[1.125rem] text-md text-ink-soft">
                  Nothing to review. New devices appear here after the monthly search.
                </p>
              ) : (
                <ul aria-label="Devices to review" className="m-0 flex list-none flex-col gap-3 px-4 p-0">
                  {pending.map((device) => (
                    <DeviceCard key={device.id} device={device} />
                  ))}
                </ul>
              )}
            </Section>

            {reviewed.length > 0 && (
              <Section title="Reviewed" kind="title" className="[&>h2]:pt-6">
                <ul aria-label="Reviewed devices" className="m-0 flex list-none flex-col gap-2 px-4 p-0">
                  {reviewed.map((d) => (
                    <li key={d.id} className={`${cardClass} flex flex-wrap items-baseline justify-between gap-2 px-4 py-3`}>
                      <a href={d.url} target="_blank" rel="noopener noreferrer" className="min-w-0 text-md font-bold text-ink">
                        {d.name}
                      </a>
                      <span className={`text-xs font-bold ${d.status === "approved" ? "text-chlorophyll" : "text-ink-soft"}`}>
                        {d.status === "approved" ? "Added to products" : "Dismissed"}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}
          </>
        )}
      </div>
    </AdminShell>
  );
}

function DeviceCard({ device }: { device: DeviceCandidate }) {
  const review = useReviewDevice();
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(device.name);
  const [description, setDescription] = useState(device.description);

  const approve = () =>
    review.mutate(
      { id: device.id, review: { decision: "approve", ...(editing ? { name, description } : {}) } },
      { onSuccess: () => toast("Added to products") },
    );
  const dismiss = () => review.mutate({ id: device.id, review: { decision: "dismiss" } }, { onSuccess: () => toast("Dismissed") });

  return (
    <li className={`${cardClass} flex flex-col gap-3 p-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        {editing ? (
          <label className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className={fieldLabel}>Name</span>
            <input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} className={`${field} h-11`} />
          </label>
        ) : (
          <div className="min-w-0 flex-1">
            <h3 className="m-0 text-lg leading-snug font-extrabold">{device.name}</h3>
            <p className="m-0 text-xs text-ink-soft">By {device.maker}</p>
          </div>
        )}
        <span className={`shrink-0 rounded-pill px-2.5 py-1 text-2xs font-bold ${TONE[device.tag]}`}>{device.category}</span>
      </div>
      {editing ? (
        <label className="flex flex-col gap-1.5">
          <span className={fieldLabel}>What it is</span>
          <textarea value={description} maxLength={600} rows={3} onChange={(e) => setDescription(e.target.value)} className={`${field} resize-y py-3`} />
        </label>
      ) : (
        <p className="m-0 text-md leading-normal text-pretty text-ink-soft">{device.description}</p>
      )}
      <a href={device.url} target="_blank" rel="noopener noreferrer" className="self-start text-sm font-bold">
        Open the product page
      </a>
      <p className="m-0 text-2xs text-ink-soft">Check the page before approving. It's added without an affiliate label; change that on Products.</p>
      {review.isError && (
        <p role="alert" className={`m-0 ${fieldError}`}>
          {problem(review.error, "That didn't save. Try again.")}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button className="h-11 px-5 text-sm" disabled={review.isPending} onClick={approve}>
          {review.isPending ? "Saving…" : editing ? "Approve with edits" : "Approve"}
        </Button>
        <Button variant="soft" className="h-11 px-4 text-sm" disabled={review.isPending} onClick={() => setEditing(!editing)}>
          {editing ? "Cancel edits" : "Edit"}
        </Button>
        <Button variant="quiet" className="h-11 px-4 text-sm" disabled={review.isPending} onClick={dismiss}>
          Dismiss
        </Button>
      </div>
    </li>
  );
}
