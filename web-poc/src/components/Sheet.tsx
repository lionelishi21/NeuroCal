"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: ReactNode;
}

/** Bottom sheet on phones, anchored panel on larger screens. The app's only floating surface. */
export function Sheet({ open, onOpenChange, title, children }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-scrim" style={{ animation: "scrim-in var(--duration-sheet) var(--ease-settle)" }} />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[90dvh] w-full max-w-[34rem] flex-col rounded-t-sheet bg-paper shadow-float focus:outline-none"
          style={{ animation: "sheet-in var(--duration-sheet) var(--ease-settle)" }}
        >
          <div aria-hidden className="mx-auto mt-2 h-[5px] w-10 shrink-0 rounded-pill bg-rule-strong" />
          <div className="flex shrink-0 items-center justify-between gap-2 pt-3.5 pr-2.5 pl-5">
            <Dialog.Title className="m-0 text-xl font-extrabold tracking-[-0.015em]">{title}</Dialog.Title>
            <Dialog.Close aria-label="Close" className="grid size-11 cursor-pointer place-items-center rounded-full text-ink-soft hover:bg-track">
              <svg viewBox="0 0 24 24" aria-hidden className="size-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </Dialog.Close>
          </div>
          <div className="flex flex-col gap-3.5 overflow-y-auto px-5 pt-3.5 pb-[max(1.75rem,env(safe-area-inset-bottom))] [scrollbar-width:none]">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const TONES = {
  problem: { fill: "bg-beet-soft", lead: "text-beet" },
  watch: { fill: "bg-glucose-soft", lead: "text-glucose-ink" },
} as const;

/** A note inside a sheet: a bold lead that names it, then one or two plain sentences. */
export function SheetNote({ tone, lead, children, alert = false }: { tone: keyof typeof TONES; lead: string; children: ReactNode; alert?: boolean }) {
  return (
    <p {...(alert ? { role: "alert" } : {})} className={`m-0 rounded-option px-3.5 py-3 text-xs leading-[1.45] ${TONES[tone].fill}`}>
      <b className={`font-extrabold ${TONES[tone].lead}`}>{lead} </b>
      {children}
    </p>
  );
}

/** The sheet's one main action. */
export const sheetAction = "w-full text-base";
