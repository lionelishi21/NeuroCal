"use client";

import { useState } from "react";
import { CognitiveFlag } from "@neurocal/contracts";
import { useCreateCheckIn } from "../../api/queries";
import { Button } from "../../components/Button";
import { Sheet } from "../../components/Sheet";
import { useToast } from "../../components/Toast";
import { flagLabel, nowWithOffset } from "../../lib/format";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CheckInSheet({ open, onOpenChange }: Props) {
  const [flags, setFlags] = useState<CognitiveFlag[]>([]);
  const checkIn = useCreateCheckIn();
  const toast = useToast();

  const toggle = (flag: CognitiveFlag) =>
    setFlags((current) => (current.includes(flag) ? current.filter((f) => f !== flag) : [...current, flag]));

  const close = (next: boolean) => {
    if (!next) {
      setFlags([]);
      checkIn.reset();
    }
    onOpenChange(next);
  };

  const save = () =>
    checkIn.mutate(
      { at: nowWithOffset(), flags },
      {
        onSuccess: () => {
          toast("Check-in saved");
          close(false);
        },
      },
    );

  return (
    <Sheet
      open={open}
      onOpenChange={close}
      title="Check in"
      description="How is your head right now? Suggestions adjust to what you pick."
    >
      <fieldset className="m-0 border-0 p-0">
        <legend className="sr-only">How you feel</legend>
        <div className="flex flex-wrap gap-2">
          {CognitiveFlag.options.map((flag) => {
            const on = flags.includes(flag);
            return (
              <button
                key={flag}
                type="button"
                aria-pressed={on}
                onClick={() => toggle(flag)}
                className={`rounded-pill px-4 py-2.5 text-base ring-1 ring-inset transition-colors duration-150 ${
                  on ? "bg-synapse text-on-accent ring-synapse" : "bg-mist text-ink ring-rule hover:ring-ink-soft"
                }`}
              >
                {flagLabel[flag]}
              </button>
            );
          })}
        </div>
      </fieldset>
      {checkIn.isError && (
        <p role="alert" className="mt-4 mb-0 text-sm text-beet">
          The check-in didn't save. Check your connection and try again.
        </p>
      )}
      <Button className="mt-6 w-full" onClick={save} disabled={flags.length === 0 || checkIn.isPending}>
        {checkIn.isPending ? "Saving…" : "Save check-in"}
      </Button>
    </Sheet>
  );
}
