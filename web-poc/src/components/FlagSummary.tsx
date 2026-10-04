import type { CognitiveFlag } from "@neurocal/contracts";
import { flagLabel } from "../lib/format";

/** The latest check-in, in the synapse colour that marks everything cognitive. */
export function FlagSummary({ flags }: { flags: CognitiveFlag[] }) {
  if (flags.length === 0) {
    return <p className="m-0 text-sm text-ink-soft">No check-in yet today.</p>;
  }
  return (
    <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <span className="text-ink-soft">Feeling</span>
      {flags.map((flag) => (
        <span key={flag} className="inline-flex items-center gap-1.5 text-ink">
          <span aria-hidden className="size-2 rounded-pill bg-synapse" />
          {flagLabel[flag]}
        </span>
      ))}
    </p>
  );
}
