/** A value with its label underneath; `swatch` ties it to a chart series. Use inside a <dl>. */
export function Readout({ value, label, swatch }: { value: string; label: string; swatch?: string }) {
  return (
    // Source order is dt → dd (valid HTML); the value reads first visually.
    <div className="flex flex-col-reverse">
      <dt className="m-0 flex items-center gap-1.5 text-sm text-ink-soft">
        {swatch && <span aria-hidden className={`h-0.5 w-3 rounded-pill ${swatch}`} />}
        {label}
      </dt>
      <dd className="m-0 text-xl font-semibold text-ink tabular-nums">{value}</dd>
    </div>
  );
}
