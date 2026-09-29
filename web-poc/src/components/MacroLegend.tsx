import type { Macros } from "@neurocal/contracts";

interface Props {
  eaten: Macros;
  targets: Macros;
}

const rows = [
  { key: "proteinG", label: "Protein", color: "bg-chlorophyll" },
  { key: "carbsG", label: "Carbs", color: "bg-glucose" },
  { key: "fatG", label: "Fat", color: "bg-oil" },
] as const;

/** Reads the dial's inner arcs back as text, outermost first. */
export function MacroLegend({ eaten, targets }: Props) {
  return (
    <dl className="m-0 grid w-full max-w-[20rem] grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1.5 text-sm">
      {rows.map((row) => (
        <div key={row.key} className="contents">
          <span aria-hidden className={`h-1.5 w-5 rounded-pill ${row.color}`} />
          <dt className="text-ink">{row.label}</dt>
          <dd className="m-0 text-ink-soft tabular-nums">
            {Math.round(eaten[row.key])} of {targets[row.key]} g
          </dd>
        </div>
      ))}
    </dl>
  );
}
