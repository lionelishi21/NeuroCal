import type { ReactNode } from "react";

/** Nothing here yet: one line on what goes here, then the action that fills it. */
export function EmptyState({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-control border-[1.5px] border-dashed border-rule-strong p-3.5">
      <p className="m-0 text-sm font-bold">{title}</p>
      <p className="m-0 text-xs leading-[1.4] text-ink-soft">{children}</p>
      {action}
    </div>
  );
}

const WIDTHS = ["w-4/5", "w-3/5", "w-[70%]"];

/** Placeholder lines while a list loads. */
export function LoadingLines({ label, lines = 3 }: { label: string; lines?: number }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-2 py-0.5">
      {Array.from({ length: lines }, (_, i) => (
        <span
          key={i}
          className={`skeleton h-3.5 rounded-pill bg-track ${WIDTHS[i % WIDTHS.length]}`}
          style={{ animation: `pulse 1.2s ease-in-out ${i * 0.15}s infinite` }}
        />
      ))}
    </div>
  );
}

/** A list that didn't load: what failed, that nothing is lost, one retry. */
export function LoadFailed({ title, children, onRetry }: { title: string; children: ReactNode; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-start gap-2">
      <p className="m-0 flex items-center gap-2 text-sm font-bold">
        <span aria-hidden className="grid size-[1.375rem] place-items-center rounded-full bg-beet-soft text-xs font-extrabold text-beet">
          !
        </span>
        {title}
      </p>
      <p className="m-0 text-xs leading-[1.4] text-ink-soft">{children}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="h-9 cursor-pointer rounded-pill bg-synapse px-3.5 text-xs font-bold text-on-accent hover:brightness-110">
          Try again
        </button>
      )}
    </div>
  );
}

/** A whole screen's worth of placeholder blocks; `heights` are the blocks it stands in for, in rem. */
export function ScreenLoading({ label, heights }: { label: string; heights: number[] }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-3 p-4">
      {heights.map((height, i) => (
        <span key={i} className="skeleton rounded-card bg-track" style={{ height: `${height}rem`, animation: `pulse 1.2s ease-in-out ${i * 0.15}s infinite` }} />
      ))}
    </div>
  );
}

const bigButton = "mt-2 inline-flex h-12 cursor-pointer items-center rounded-pill bg-synapse px-[1.375rem] text-md font-bold text-on-accent hover:brightness-110";

/** A screen that didn't load. */
export function ScreenFailed({ title, children, onRetry }: { title: string; children: ReactNode; onRetry: () => void }) {
  return (
    <div role="alert" className="m-4 flex flex-col items-start gap-2 rounded-hero border border-rule bg-paper px-5 py-6">
      <span aria-hidden className="grid size-11 place-items-center rounded-full bg-beet-soft text-xl font-extrabold text-beet">
        !
      </span>
      <p className="m-0 mt-1 text-xl font-extrabold">{title}</p>
      <p className="m-0 text-md text-ink-soft">{children}</p>
      <button type="button" onClick={onRetry} className={bigButton}>
        Try again
      </button>
    </div>
  );
}

/** A screen with nothing to show yet: what will appear, and the action that starts it. */
export function ScreenEmpty({ title, children, action, onAction }: { title: string; children: ReactNode; action?: string; onAction?: () => void }) {
  return (
    <div className="m-4 flex flex-col items-start gap-2 rounded-hero border-[1.5px] border-dashed border-rule-strong px-5 py-6">
      <p className="m-0 text-xl font-extrabold">{title}</p>
      <p className="m-0 text-md text-pretty text-ink-soft">{children}</p>
      {action && (
        <button type="button" onClick={onAction} className={bigButton}>
          {action}
        </button>
      )}
    </div>
  );
}
