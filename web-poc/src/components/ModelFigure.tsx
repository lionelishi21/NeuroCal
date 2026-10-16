/**
 * Figure 1 of the NeuroCal Biohacking Model (docs/NCBM.md), from the Claude Design figure: seven
 * pillars feed the signals, the signals make the Focus Score, two outcomes check it, and the loop turns
 * the weakest signals into a next action. Left to right on wide screens, top to bottom on phones.
 */

type Pillar = {
  name: string;
  detail: string;
  /** The signal it feeds, with its weight; "planned" ones are designed but not in the score yet. */
  signal: { name: string; tag: string; planned?: boolean } | null;
};

const PILLARS: Pillar[] = [
  { name: "Fuel", detail: "Meals, macros, glycemic load, how processed (NOVA)", signal: { name: "Glycemic load", tag: "15%" } },
  { name: "Rhythm", detail: "Last meal, late screens, fasting window, morning light", signal: { name: "Evening timing", tag: "20%" } },
  { name: "Recovery", detail: "Sleep length and depth", signal: { name: "Sleep", tag: "30%" } },
  { name: "Mind", detail: "Check-ins: stressed, foggy, sharp, calm", signal: { name: "Stress", tag: "15%" } },
  { name: "Movement", detail: "Exercise, steps, calf and circulation work", signal: { name: "Movement", tag: "10%" } },
  { name: "Environment", detail: "The air where you live, daylight, a dark and quiet bedroom, filtered water", signal: { name: "Environment", tag: "10%" } },
  { name: "Supplements", detail: "What you take, checked across the whole stack", signal: null },
];

const ACTIONS = ["What to eat", "A routine", "A product or device"];

/** A short arrow; dashed for what isn't in the score yet. Points down on phones when `turn` is set. */
function Arrow({ dashed = false, turn = false, className = "text-ink-faint" }: { dashed?: boolean; turn?: boolean; className?: string }) {
  return (
    <svg
      viewBox="0 0 32 12"
      aria-hidden
      className={`h-3 w-8 shrink-0 ${turn ? "rotate-90 lg:rotate-0" : ""} ${className}`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M1 6h27" strokeDasharray={dashed ? "4 4" : undefined} />
      <path d="M24 2l5 4-5 4" />
    </svg>
  );
}

export function ModelFigure() {
  return (
    <figure className="m-0 flex flex-col gap-8">
      <div className="flex flex-col items-stretch gap-6 lg:flex-row lg:items-center lg:gap-5">
        {/* Pillars and the signal each one feeds. */}
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0 lg:flex-[1.55_1_0]" aria-label="Seven pillars and the signals they feed">
          {PILLARS.map((p) => (
            <li key={p.name} className="grid grid-cols-[minmax(0,1.3fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-3">
              <div className="flex min-h-[4.75rem] flex-col justify-center gap-0.5 rounded-card border border-rule bg-paper px-4 py-3">
                <span className="text-md font-extrabold">{p.name}</span>
                <span className="text-xs leading-snug text-pretty text-ink-soft">{p.detail}</span>
              </div>
              <Arrow dashed={!p.signal || p.signal.planned} />
              {p.signal ? (
                <div
                  className={`flex min-h-12 flex-wrap items-center justify-between gap-x-2 rounded-control px-3.5 py-2 ${
                    p.signal.planned
                      ? "border-2 border-dashed border-synapse-faint text-ink-soft"
                      : "bg-synapse-soft text-synapse-ink"
                  }`}
                >
                  <span className="text-sm font-extrabold">{p.signal.name}</span>
                  <span className="text-xs font-bold">{p.signal.tag}</span>
                </div>
              ) : (
                <p className="m-0 text-xs leading-snug font-bold text-ink-soft">Safety checks, not scored</p>
              )}
            </li>
          ))}
        </ul>

        <div className="flex justify-center">
          <Arrow turn className="text-synapse-ink" />
        </div>

        {/* The score: the one thing every pillar adds up to. */}
        <div className="flex justify-center lg:flex-[0_0_auto]">
          <div className="flex size-52 flex-col items-center justify-center gap-0.5 rounded-full bg-linear-[145deg] from-promo to-promo-deep text-on-promo shadow-action">
            <span className="text-sm font-bold text-on-promo-soft">Focus Score</span>
            <span className="font-figure text-figure leading-none font-extrabold tracking-[-0.03em]">0–100</span>
            <span className="text-sm font-semibold text-on-promo-soft">against your own usual</span>
          </div>
        </div>

        <div className="flex justify-center">
          <Arrow turn className="text-synapse-ink" />
        </div>

        <div className="flex flex-col gap-4 lg:flex-[1.2_1_0]">
          {/* What checks the score against reality. */}
          <section className="flex flex-col gap-2.5 rounded-hero bg-ion-soft p-5" aria-label="Outcomes">
            <h3 className="m-0 text-sm font-bold text-ion-ink">Outcomes check the score</h3>
            <div className="rounded-control bg-paper px-4 py-3">
              <p className="m-0 text-md font-extrabold">Brain speed check</p>
              <p className="m-0 text-xs text-ink-soft">A 2-minute reaction test. After two weeks it tunes the weights to you.</p>
            </div>
            <div className="rounded-control bg-paper px-4 py-3">
              <p className="m-0 text-md font-extrabold">Weight trend</p>
              <p className="m-0 text-xs text-ink-soft">Smoothed, so daily water swings don't count</p>
            </div>
          </section>

          {/* The loop: dark in both themes, like the figure. */}
          <section className="night flex flex-col gap-3 rounded-hero border border-rule bg-mist p-5 text-ink" aria-label="The loop">
            <h3 className="m-0 text-sm font-bold text-synapse-ink">The loop</h3>
            <div className="rounded-control bg-paper px-4 py-3">
              <p className="m-0 text-md font-extrabold">Weakest signals this week</p>
              <p className="m-0 text-xs text-ink-soft">Any signal under 0.75, matched to routines and products</p>
            </div>
            <div className="flex justify-center">
              <Arrow className="rotate-90 text-synapse-ink" />
            </div>
            <div className="flex flex-col gap-2.5 rounded-control bg-synapse-soft px-4 py-3">
              <p className="m-0 text-md font-extrabold">Next action</p>
              <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                {ACTIONS.map((a) => (
                  <li key={a} className="flex h-8 items-center rounded-pill bg-paper px-3 text-sm font-semibold">
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      </div>

      <figcaption className="flex flex-wrap items-center gap-x-7 gap-y-2 border-t border-rule pt-4 text-sm text-ink-soft">
        <span className="flex items-center gap-2.5">
          <Arrow className="text-synapse-ink" />
          In today's score
        </span>
        <span className="flex items-center gap-2.5">
          <Arrow dashed className="text-synapse-ink" />
          Designed, not in the score yet
        </span>
        <span className="lg:ml-auto">Scores are fixed formulas. AI explains them and never sets them.</span>
      </figcaption>
    </figure>
  );
}
