"use client";

import { setupWorker } from "msw/browser";
import { useEffect, useState, type ReactNode } from "react";
import { createHandlers } from "./handlers";

/** Starts the MSW mock API in the browser, then renders the app. Browser-only: load with ssr: false. */
export default function MockGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setupWorker(...createHandlers())
      .start({ onUnhandledFrame: "bypass", quiet: true })
      .then(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  return ready ? children : null;
}
