"use client";

import { useId, useState } from "react";
import { useLogScreenTime } from "../../api/queries";
import { Button } from "../../components/Button";
import { Sheet, SheetNote, sheetAction } from "../../components/Sheet";
import { useToast } from "../../components/Toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 22:00 to 04:00: the window the Focus Score reads (ARCHITECTURE §6.8). */
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
  // Kept as typed, so the field can be emptied on the way to another number.
  const [typed, setTyped] = useState("30");
  const logScreenTime = useLogScreenTime();
  const toast = useToast();
  const minutes = typed === "" ? Number.NaN : Number(typed);
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
    <Sheet open={open} onOpenChange={close} title="Log screen time">
      <p className="m-0 text-sm text-ink-soft">Minutes on screens after 22:00 last night.</p>
      <div role="group" aria-label="Common amounts" className="grid grid-cols-5 gap-1.5">
        {quickPicks.map((pick) => (
          <button
            key={pick}
            type="button"
            aria-pressed={minutes === pick}
            aria-label={pick === 0 ? "None" : `${pick} minutes`}
            onClick={() => setTyped(String(pick))}
            className={`h-12 cursor-pointer rounded-option border-[1.5px] text-md font-bold ${
              minutes === pick ? "border-synapse bg-synapse text-on-accent" : "border-rule-strong bg-paper text-ink hover:border-ink-soft"
            }`}
          >
            {pick === 0 ? "None" : pick}
          </button>
        ))}
      </div>
      <label htmlFor={minutesId} className={`flex h-14 items-center gap-2.5 rounded-control bg-mist px-4 ${valid ? "" : "ring-[1.5px] ring-beet ring-inset"}`}>
        <input
          id={minutesId}
          inputMode="numeric"
          aria-label="Minutes"
          aria-invalid={!valid}
          value={typed}
          onChange={(e) => setTyped(e.target.value.replace(/\D/g, "").slice(0, 3))}
          className="w-20 border-0 bg-transparent text-xl font-extrabold text-ink tabular-nums focus:outline-none"
        />
        <span className="text-md text-ink-soft">minutes</span>
      </label>

      {!valid && (
        <p aria-live="polite" className="m-0 text-xs font-semibold text-beet">
          Enter a whole number of minutes between 0 and 360.
        </p>
      )}
      {logScreenTime.isError && (
        <SheetNote tone="problem" lead="Couldn't save your screen time." alert>
          Check your connection and try again.
        </SheetNote>
      )}
      <Button className={sheetAction} onClick={save} disabled={!valid || logScreenTime.isPending}>
        {logScreenTime.isPending ? "Logging…" : "Log screen time"}
      </Button>
    </Sheet>
  );
}
