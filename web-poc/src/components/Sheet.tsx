"use client";

import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
}

/** Bottom sheet on phones, anchored panel on larger screens. The app's only floating surface. */
export function Sheet({ open, onOpenChange, title, description, children }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className="fixed inset-0 z-40 bg-ink/35"
          style={{ animation: "scrim-in var(--duration-sheet) var(--ease-settle)" }}
        />
        <Dialog.Content
          className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] w-full max-w-[34rem] flex-col rounded-t-sheet bg-paper shadow-float focus:outline-none"
          style={{ animation: "sheet-in var(--duration-sheet) var(--ease-settle)" }}
          {...(description ? {} : { "aria-describedby": undefined })}
        >
          <div aria-hidden className="mx-auto mt-3 h-1 w-10 rounded-pill bg-rule" />
          <div className="flex items-start justify-between gap-4 px-6 pt-4">
            <div>
              <Dialog.Title className="m-0 text-xl font-semibold">{title}</Dialog.Title>
              {description && (
                <Dialog.Description className="mt-1 mb-0 text-sm text-ink-soft">{description}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="rounded-pill px-2 py-1 text-sm text-ink-soft hover:text-ink">Close</Dialog.Close>
          </div>
          <div className="overflow-y-auto px-6 pt-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
