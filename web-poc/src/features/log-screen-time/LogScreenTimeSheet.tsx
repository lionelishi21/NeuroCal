"use client";

import { useId, useState } from "react";
import { useLogScreenTime } from "../../api/queries";
import { Button } from "../../components/Button";
import { fieldClass } from "../../components/fields";
import { Sheet } from "../../components/Sheet";
import { useToast } from "../../components/Toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 10pm to 4am: the window the Focus Score reads (ARCHITECTURE §6.8). */
const WINDOW_MINUTES = 360;

/** Last night's late-screen window: yesterday 22:00 to today 04:00, local time. */
export function lateScreenWindow(now = new Date()) {
  const start = new Date(now);
  start.setDate(start.getDate() - 1);
  start.setHours(22, 0, 0, 0);
  return { start, end: new Date(start.getTime() + WINDOW_MINUTES * 60_000) };
}

const quickPicks = [0, 15, 30, 60, 90];

export function LogScreenTimeSheet({ open, onOpenChange }: Props) {
  const minutesId = useId();
  const [minutes, setMinutes] = useState(30);
  const logScreenTime = useLogScreenTime();
  const toast = useToast();
  const valid = Number.isInteger(minutes) && minutes >= 0 && minutes <= WINDOW_MINUTES;

  const close = (next: boolean) => {
    if (!next) logScreenTime.reset();
    onOpenChange(next);
  };

  const save = () => {
    const { start, end } = lateScreenWindow();
    // Same source and window start as an earlier entry, so a correction replaces it.
    logScreenTime.mutate([{ windowStart: start.toISOString(), windowEnd: end.toISOString(), minutes, source: "manual" }], {
      onSuccess: () => {
        toast("Screen time logged");
        close(false);
      },
    });
  };

  return (
    <Sheet
      open={open}
      onOpenChange={close}
      title="Log screen time"
      description="How long were you on your phone, laptop or TV after 10pm last night?"
    >
      <label htmlFor={minutesId} className="block text-sm text-ink-soft">
        Minutes after 10pm
        <input
          id={minutesId}
          type="number"
          inputMode="numeric"
          min={0}
          max={WINDOW_MINUTES}
          step={5}
          value={Number.isNaN(minutes) ? "" : minutes}
          onChange={(e) => setMinutes(e.target.valueAsNumber)}
          className={`${fieldClass} tabular-nums`}
        />
      </label>
      <div role="group" aria-label="Common amounts" className="mt-3 flex flex-wrap gap-2">
        {quickPicks.map((pick) => (
          <button
            key={pick}
            type="button"
            aria-pressed={minutes === pick}
            onClick={() => setMinutes(pick)}
            className={`cursor-pointer rounded-pill px-3.5 py-2 text-sm ring-1 ring-inset ${
              minutes === pick ? "bg-synapse text-on-accent ring-synapse" : "bg-paper text-ink ring-rule hover:ring-ink-soft"
            }`}
          >
            {pick === 0 ? "None" : `${pick} min`}
          </button>
        ))}
      </div>

      <p aria-live="polite" className={`mt-4 mb-0 text-sm ${valid ? "text-ink-soft" : "text-beet"}`}>
        {valid ? "Logging again for the same night replaces the earlier entry." : "Enter a whole number of minutes between 0 and 360."}
      </p>

      {logScreenTime.isError && (
        <p role="alert" className="mt-4 mb-0 text-sm text-beet">
          Screen time didn't save. Check your connection and try again.
        </p>
      )}
      <Button className="mt-6 w-full" onClick={save} disabled={!valid || logScreenTime.isPending}>
        {logScreenTime.isPending ? "Logging…" : "Log screen time"}
      </Button>
    </Sheet>
  );
}
