import { CreateMealRequest } from "@neurocal/contracts";
import { z } from "zod";

/**
 * Meals logged while offline, kept on the device until they can be sent.
 * Each entry belongs to the account that logged it, so a queue left behind by
 * one person is never sent as someone else.
 */
const QueuedMeal = z.object({ id: z.string(), owner: z.string(), meal: CreateMealRequest });
export type QueuedMeal = z.infer<typeof QueuedMeal>;

const KEY = "neurocal-meal-queue";
const listeners = new Set<() => void>();
/** Used when storage is blocked (private windows): the queue then lasts until the page is closed. */
let memory: QueuedMeal[] = [];
let snapshot: QueuedMeal[] = [];
let loaded = false;

function load(): QueuedMeal[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = z.array(QueuedMeal).safeParse(raw ? JSON.parse(raw) : []);
    return parsed.success ? parsed.data : [];
  } catch {
    return memory;
  }
}

function store(next: QueuedMeal[]) {
  memory = next;
  snapshot = next;
  loaded = true;
  try {
    if (next.length) window.localStorage.setItem(KEY, JSON.stringify(next));
    else window.localStorage.removeItem(KEY);
  } catch {
    // memory only
  }
  listeners.forEach((notify) => notify());
}

/** Every queued meal, oldest first. The same array is returned until the queue changes. */
export function queuedMeals(): QueuedMeal[] {
  if (!loaded) {
    snapshot = load();
    loaded = true;
  }
  return snapshot;
}

export function enqueueMeal(owner: string, meal: CreateMealRequest): QueuedMeal {
  const entry = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, owner, meal };
  store([...queuedMeals(), entry]);
  return entry;
}

export function dequeueMeal(id: string) {
  store(queuedMeals().filter((entry) => entry.id !== id));
}

export function subscribeToMealQueue(notify: () => void) {
  listeners.add(notify);
  return () => void listeners.delete(notify);
}

/** For tests: forget what was read so the next call reads storage again. */
export function resetMealQueue() {
  loaded = false;
  memory = [];
  snapshot = [];
}
