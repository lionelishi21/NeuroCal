import { BioStateDial } from "../components/BioStateDial";
import { Button } from "../components/Button";
import { FlagSummary } from "../components/FlagSummary";
import { MacroLegend } from "../components/MacroLegend";

const targets = { proteinG: 130, carbsG: 240, fatG: 75 };
const states = [
  { name: "Morning", eaten: 440, macros: { proteinG: 13, carbsG: 67, fatG: 15 } },
  { name: "Afternoon", eaten: 1050, macros: { proteinG: 47, carbsG: 135, fatG: 36 } },
  { name: "Over budget", eaten: 2480, macros: { proteinG: 140, carbsG: 290, fatG: 92 } },
];

/** Component states side by side, for design review and screenshots. Not linked from the app. */
export function Lab() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
      <h1 className="mt-0 text-2xl">Component lab</h1>
      <section aria-labelledby="dial" className="mt-8">
        <h2 id="dial" className="text-xl">
          Bio-state dial
        </h2>
        <div className="grid gap-10 sm:grid-cols-3">
          {states.map((s) => (
            <div key={s.name} className="flex flex-col gap-4">
              <h3 className="m-0 text-base text-ink-soft">{s.name}</h3>
              <BioStateDial calorieTarget={2200} caloriesEaten={s.eaten} macrosEaten={s.macros} macroTargets={targets} />
              <MacroLegend eaten={s.macros} targets={targets} />
            </div>
          ))}
        </div>
      </section>
      <section aria-labelledby="controls" className="mt-12">
        <h2 id="controls" className="text-xl">
          Controls
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <Button>Log a meal</Button>
          <Button variant="quiet">Check in</Button>
          <Button variant="text">Remove</Button>
          <Button disabled>Saving…</Button>
        </div>
        <div className="mt-6 flex flex-col gap-2">
          <FlagSummary flags={["low_focus", "low_energy"]} />
          <FlagSummary flags={[]} />
        </div>
      </section>
    </main>
  );
}
