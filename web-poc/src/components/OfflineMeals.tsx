"use client";

import { useEffect } from "react";
import { useFlushMealQueue, useQueuedMeals } from "../api/queries";
import { Button } from "./Button";
import { useToast } from "./Toast";

/** Sends queued meals when the app starts and whenever the connection returns. Renders nothing. */
export function OfflineMealSync() {
  const flush = useFlushMealQueue();
  const toast = useToast();
  const waiting = useQueuedMeals().length > 0;

  useEffect(() => {
    if (!waiting) return;
    const send = () =>
      void flush().then(({ logged }) => {
        if (logged) toast(logged === 1 ? "Meal logged" : `${logged} meals logged`);
      });
    send();
    window.addEventListener("online", send);
    return () => window.removeEventListener("online", send);
  }, [waiting, flush, toast]);

  return null;
}

/** Today's note about meals saved offline, with a way to send them now. */
export function QueuedMealsNotice() {
  const waiting = useQueuedMeals().length;
  const flush = useFlushMealQueue();
  const toast = useToast();
  if (!waiting) return null;

  const tryNow = async () => {
    const { logged } = await flush();
    if (logged) toast(logged === 1 ? "Meal logged" : `${logged} meals logged`);
    else toast("Still offline. Your meals are safe on this device.", "problem");
  };

  return (
    <p role="status" className="mt-0 mb-3 flex flex-wrap items-baseline gap-x-3 rounded-card bg-paper px-4 py-3 text-sm text-ink ring-1 ring-rule ring-inset">
      <span>
        {waiting === 1 ? "1 meal is" : `${waiting} meals are`} saved on this device and will be logged when you're back online.
      </span>
      <Button variant="text" className="-ml-1 text-sm" onClick={tryNow}>
        Try now
      </Button>
    </p>
  );
}
