"use client";

import { useId, useState } from "react";
import { useLogSleep } from "../../api/queries";
import { Button } from "../../components/Button";
import { Sheet } from "../../components/Sheet";
import { useToast } from "../../components/Toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** "HH:MM" today, or yesterday when the bedtime is later than the wake time. */
export function sleepWindow(bedtime: string, wakeTime: string, now = new Date()) {
  const [bh, bm] = bedtime.split(":").map(Number);
  const [wh, wm] = wakeTime.split(":").map(Number);
  const end = new Date(now);
  end.setHours(wh ?? 0, wm ?? 0, 0, 0);
  const start = new Date(end);
  start.setHours(bh ?? 0, bm ?? 0, 0, 0);
  if (start >= end) start.setDate(start.getDate() - 1);
  return { start, end, minutes: Math.round((end.getTime() - start.getTime()) / 60_000) };
}

const duration = (minutes: number) => `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")} min`;

export function LogSleepSheet({ open, onOpenChange }: Props) {
  const bedId = useId();
  const wakeId = useId();
  const [bedtime, setBedtime] = useState("23:00");
  const [wakeTime, setWakeTime] = useState("07:00");
  const logSleep = useLogSleep();
  const toast = useToast();

  const span = sleepWindow(bedtime, wakeTime);
  const inFuture = span.end.getTime() > Date.now() + 5 * 60_000;

  const close = (next: boolean) => {
    if (!next) logSleep.reset();
    onOpenChange(next);
  };

  const save = () =>
    logSleep.mutate([{ start: span.start.toISOString(), end: span.end.toISOString(), source: "manual" }], {
      onSuccess: () => {
        toast("Sleep logged");
        close(false);
      },
    });

  const field = "mt-1 w-full rounded-control bg-mist px-3 py-2.5 text-lg text-ink ring-1 ring-rule ring-inset tabular-nums focus:outline-none focus-visible:ring-2 focus-visible:ring-synapse";

  return (
    <Sheet open={open} onOpenChange={close} title="Log sleep" description="When did you go to bed and wake up? It feeds today's Focus Score.">
      <div className="grid grid-cols-2 gap-4">
        <label htmlFor={bedId} className="text-sm text-ink-soft">
          Went to bed
          <input id={bedId} type="time" value={bedtime} onChange={(e) => setBedtime(e.target.value)} className={field} />
        </label>
        <label htmlFor={wakeId} className="text-sm text-ink-soft">
          Woke up
          <input id={wakeId} type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} className={field} />
        </label>
      </div>

      <p aria-live="polite" className="mt-4 mb-0 text-base">
        {inFuture ? (
          <span className="text-beet">That wake-up time hasn't happened yet today.</span>
        ) : (
          <>
            <span className="font-semibold tabular-nums">{duration(span.minutes)}</span>{" "}
            <span className="text-ink-soft">of sleep</span>
          </>
        )}
      </p>

      {logSleep.isError && (
        <p role="alert" className="mt-4 mb-0 text-sm text-beet">
          Sleep didn't save. Check your connection and try again.
        </p>
      )}
      <Button className="mt-6 w-full" onClick={save} disabled={inFuture || logSleep.isPending}>
        {logSleep.isPending ? "Logging…" : "Log sleep"}
      </Button>
    </Sheet>
  );
}
