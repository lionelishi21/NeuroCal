"use client";

import { useId, useState } from "react";
import { CognitiveFlag } from "@neurocal/contracts";
import { useCreateCheckIn } from "../../api/queries";
import { Button } from "../../components/Button";
import { Sheet, SheetNote, sheetAction } from "../../components/Sheet";
import { useToast } from "../../components/Toast";
import { flagLabel, nowWithOffset } from "../../lib/format";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NOTE_MAX = 280;

export function CheckInSheet({ open, onOpenChange }: Props) {
  const noteId = useId();
  const [flags, setFlags] = useState<CognitiveFlag[]>([]);
  const [note, setNote] = useState("");
  const checkIn = useCreateCheckIn();
  const toast = useToast();

  const toggle = (flag: CognitiveFlag) =>
    setFlags((current) => (current.includes(flag) ? current.filter((f) => f !== flag) : [...current, flag]));

  const close = (next: boolean) => {
    if (!next) {
      setFlags([]);
      setNote("");
      checkIn.reset();
    }
    onOpenChange(next);
  };

  const save = () =>
    checkIn.mutate(
      { at: nowWithOffset(), flags, ...(note.trim() ? { note: note.trim() } : {}) },
      {
        onSuccess: () => {
          toast("Check-in saved");
          close(false);
        },
      },
    );

  return (
    <Sheet open={open} onOpenChange={close} title="Check in">
      <fieldset className="m-0 flex min-w-0 flex-col gap-3.5 border-0 p-0">
        <legend className="mb-3.5 p-0 text-sm text-ink-soft">How do you feel right now? Pick any.</legend>
        <div className="flex flex-wrap gap-2">
          {CognitiveFlag.options.map((flag) => {
            const on = flags.includes(flag);
            return (
              <button
                key={flag}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(flag)}
                className={`h-11 cursor-pointer rounded-pill border-[1.5px] px-4 text-md font-bold transition-colors duration-150 ${
                  on ? "border-synapse bg-synapse text-on-accent" : "border-rule-strong bg-paper text-ink hover:border-ink-soft"
                }`}
              >
                {flagLabel[flag]}
              </button>
            );
          })}
        </div>
      </fieldset>
      <label htmlFor={noteId} className="flex flex-col gap-1.5 text-sm font-bold">
        <span>
          Note <span className="font-normal text-ink-soft">(optional)</span>
        </span>
        <textarea
          id={noteId}
          rows={3}
          maxLength={NOTE_MAX}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Rough meeting, skipped lunch"
          className="resize-none rounded-option border-[1.5px] border-rule bg-mist px-3.5 py-3 text-md font-normal text-ink placeholder:text-ink-faint focus:border-synapse focus:outline-none"
        />
      </label>
      {checkIn.isError && (
        <SheetNote tone="problem" lead="Couldn't save your check-in." alert>
          Check your connection and try again.
        </SheetNote>
      )}
      <Button className={sheetAction} onClick={save} disabled={flags.length === 0 || checkIn.isPending}>
        {checkIn.isPending ? "Saving…" : "Save check-in"}
      </Button>
    </Sheet>
  );
}
