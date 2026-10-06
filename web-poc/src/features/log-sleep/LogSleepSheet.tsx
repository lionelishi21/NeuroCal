"use client";

import { useId, useState } from "react";
import { useLogSleep } from "../../api/queries";
import { Button } from "../../components/Button";
import { Sheet, SheetNote, sheetAction } from "../../components/Sheet";
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

/** "7h 55m". */
const duration = (minutes: number) => `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, "0")}m`;
const clock = (date: Date) => `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;

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

  const field = "h-14 w-full min-w-0 rounded-control border-[1.5px] bg-mist px-3.5 text-xl font-bold text-ink tabular-nums focus:border-synapse focus:outline-none";

  return (
    <Sheet open={open} onOpenChange={close} title="Log sleep">
      <div className="grid grid-cols-2 gap-2.5">
        <label htmlFor={bedId} className="flex flex-col gap-1.5 text-sm font-bold">
          Went to bed
          <input id={bedId} type="time" value={bedtime} onChange={(e) => setBedtime(e.target.value)} className={`${field} border-rule`} />
        </label>
        <label htmlFor={wakeId} className="flex flex-col gap-1.5 text-sm font-bold">
          Woke up
          <input id={wakeId} type="time" value={wakeTime} onChange={(e) => setWakeTime(e.target.value)} aria-invalid={inFuture} className={`${field} ${inFuture ? "border-beet" : "border-rule"}`} />
        </label>
      </div>

      <div aria-live="polite">
        {inFuture ? (
          <SheetNote tone="problem" lead="That wake-up time hasn't happened yet.">
            It's {clock(new Date())} now. Pick a time from this morning.
          </SheetNote>
        ) : (
          <p className="m-0 flex items-center justify-between rounded-control bg-synapse-soft px-4 py-3.5 text-synapse-ink">
            <span className="text-sm font-semibold">You slept</span>
            <span className="text-xl font-extrabold tabular-nums">{duration(span.minutes)}</span>
          </p>
        )}
      </div>

      {logSleep.isError && (
        <SheetNote tone="problem" lead="Couldn't save your sleep." alert>
          Check your connection and try again.
        </SheetNote>
      )}
      <Button className={sheetAction} onClick={save} disabled={inFuture || logSleep.isPending}>
        {logSleep.isPending ? "Logging…" : "Log sleep"}
      </Button>
    </Sheet>
  );
}
