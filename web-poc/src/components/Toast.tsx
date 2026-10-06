"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

/** done: it happened. info: for your information. problem: it did not happen. */
type Tone = "done" | "info" | "problem";
interface ToastMessage {
  id: number;
  text: string;
  tone: Tone;
}

const ToastContext = createContext<(text: string, tone?: Tone) => void>(() => {});

export const useToast = () => useContext(ToastContext);

const MARK: Record<Tone, { dot: string; icon: string }> = {
  done: { dot: "bg-ion", icon: "✓" },
  info: { dot: "bg-ink-faint", icon: "i" },
  problem: { dot: "bg-signal-problem", icon: "!" },
};

/** One message at a time at the top of the screen, announced politely, gone after four seconds. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<ToastMessage | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback((text: string, tone: Tone = "done") => {
    setMessage({ id: Date.now(), text, tone });
  }, []);

  useEffect(() => {
    if (!message) return;
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMessage(null), 4000);
    return () => window.clearTimeout(timer.current);
  }, [message]);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[60] flex justify-center px-4"
      >
        {message && (
          <p
            key={message.id}
            className="m-0 flex min-h-[3.25rem] w-full max-w-[32rem] items-center gap-2.5 rounded-control bg-toast px-4 py-2 text-sm font-bold text-on-toast shadow-toast"
            style={{ animation: "toast-in var(--duration-sheet) var(--ease-settle)" }}
          >
            <span aria-hidden className={`grid size-[1.375rem] shrink-0 place-items-center rounded-full text-2xs font-extrabold text-on-signal ${MARK[message.tone].dot}`}>
              {MARK[message.tone].icon}
            </span>
            {message.text}
          </p>
        )}
      </div>
    </ToastContext.Provider>
  );
}
