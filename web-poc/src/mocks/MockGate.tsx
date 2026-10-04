"use client";

import { setupWorker } from "msw/browser";
import { useEffect, useState, type ReactNode } from "react";
import { createDb } from "./db";
import { createHandlers } from "./handlers";

/**
 * One worker per page load. React StrictMode runs effects twice in development,
 * and MSW throws if it is started twice, so the start promise is shared.
 */
let started: Promise<unknown> | null = null;
/** Set localStorage "neurocal.mock.newUser" to "1" to start the mock without a profile and see the onboarding. */
function startsAsNewUser(): boolean {
  try {
    return window.localStorage.getItem("neurocal.mock.newUser") === "1";
  } catch {
    return false;
  }
}

const startWorker = () =>
  (started ??= setupWorker(...createHandlers("/api", createDb({ newUser: startsAsNewUser() }))).start({ onUnhandledFrame: "bypass", quiet: true }));

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
