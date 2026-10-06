import type { ReactNode } from "react";

/** What went wrong, then how to fix it, on the soft error fill. */
export function ErrorPanel({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div role="alert" className="mt-4 flex flex-col gap-0.5 rounded-option bg-beet-soft px-3.5 py-3 text-sm font-medium text-beet">
      <span className="font-bold">{title}</span>
      {children && <span>{children}</span>}
      {action}
    </div>
  );
}
