import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";

type Tone = "done" | "problem";
interface ToastMessage {
  id: number;
  text: string;
  tone: Tone;
}

const ToastContext = createContext<(text: string, tone?: Tone) => void>(() => {});

export const useToast = () => useContext(ToastContext);

/** One message at a time, announced politely, gone after four seconds. */
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
        className="pointer-events-none fixed inset-x-0 bottom-28 z-[60] flex justify-center px-4 lg:bottom-8"
      >
        {message && (
          <p
            key={message.id}
            className={`m-0 rounded-pill px-5 py-2.5 text-sm font-medium shadow-float ${
              message.tone === "problem" ? "bg-beet text-on-accent" : "bg-ink text-mist"
            }`}
            style={{ animation: "toast-in var(--duration-sheet) var(--ease-settle)" }}
          >
            {message.text}
          </p>
        )}
      </div>
    </ToastContext.Provider>
  );
}
