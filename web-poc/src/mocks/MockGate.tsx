"use client";

import { setupWorker } from "msw/browser";
import { useEffect, useState, type ReactNode } from "react";
import { createHandlers } from "./handlers";

/**
 * One worker per page load. React StrictMode runs effects twice in development,
 * and MSW throws if it is started twice, so the start promise is shared.
 */
let started: Promise<unknown> | null = null;
const startWorker = () => (started ??= setupWorker(...createHandlers()).start({ onUnhandledFrame: "bypass", quiet: true }));

/** Starts the MSW mock API in the browser, then renders the app. Browser-only: load with ssr: false. */
export default function MockGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    startWorker().then(() => !cancelled && setReady(true));
    return () => {
      cancelled = true;
    };
  }, []);

  return ready ? children : null;
}
