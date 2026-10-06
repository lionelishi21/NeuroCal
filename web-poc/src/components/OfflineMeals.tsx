"use client";

import { useEffect } from "react";
import { useFlushMealQueue, useQueuedMeals } from "../api/queries";
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
    <div role="status" className="mx-4 mb-2.5 flex items-center gap-3 rounded-control bg-glucose-soft py-3 pr-3 pl-3.5">
      <svg viewBox="0 0 24 24" aria-hidden className="size-5 shrink-0 text-glucose-ink" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M3 3l18 18M8.5 8.6A6 6 0 0 0 6 13.5 4 4 0 0 0 7 21.4h10M17.8 14A4 4 0 0 0 16 7a6 6 0 0 0-5-1" />
      </svg>
      <p className="m-0 min-w-0 flex-1 text-xs leading-[1.4]">
        <b className="font-bold">{waiting === 1 ? "1 meal saved on this device." : `${waiting} meals saved on this device.`}</b> {waiting === 1 ? "It'll" : "They'll"} count once{" "}
        {waiting === 1 ? "it uploads" : "they upload"}.
      </p>
      <button type="button" onClick={tryNow} className="h-10 shrink-0 cursor-pointer rounded-pill bg-paper px-3.5 text-xs font-bold whitespace-nowrap text-ink hover:brightness-95">
        Try now
      </button>
    </div>
  );
}
