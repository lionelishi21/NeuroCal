import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";
import { z } from "zod";
import {
  AdminProduct,
  AdminProductList,
  AnalyzeMealResponse,
  type CreateAdminProductRequest,
  type UpdateAdminProductRequest,
  BioState,
  CheckIn,
  FocusScore,
  HistoryResponse,
  type JoinWaitlistRequest,
  JoinWaitlistResponse,
  LeaveWaitlistResponse,
  ProtocolsResponse,
  IngestResponse,
  type IngestScreenTimeRequest,
  type IngestSleepRequest,
  type UpdateProfileRequest,
  type CreateCheckInRequest,
  type CreateMealRequest,
  Meal,
  NextRecommendationsResponse,
  PhotoUpload,
  Profile,
} from "@neurocal/contracts";
import { RequestFailed, request } from "./client";
import { useOptionalAuth } from "../auth/AuthProvider";
import { type QueuedMeal, dequeueMeal, enqueueMeal, queuedMeals, subscribeToMealQueue } from "../lib/mealQueue";
import { todayIso } from "../lib/format";

export const keys = {
  me: ["me"] as const,
  bioState: (date: string) => ["bio-state", date] as const,
  meals: (date: string) => ["meals", date] as const,
  recommendations: ["recommendations", "next"] as const,
  focusScore: (date: string) => ["focus-score", date] as const,
  history: (days: number) => ["history", days] as const,
  protocols: ["recommendations", "protocols"] as const,
  adminProducts: ["admin", "products"] as const,
};

export function useProfile() {
  return useQuery({ queryKey: keys.me, queryFn: () => request("/me", Profile) });
}

export function useBioState(date = todayIso()) {
  return useQuery({
    queryKey: keys.bioState(date),
    queryFn: () => request(`/bio-state?date=${date}`, BioState),
  });
}

export function useMeals(date = todayIso()) {
  return useQuery({
    queryKey: keys.meals(date),
    queryFn: () => request(`/meals?date=${date}`, z.array(Meal)),
  });
}

export function useNextRecommendations() {
  return useQuery({
    queryKey: keys.recommendations,
    queryFn: () => request("/recommendations/next", NextRecommendationsResponse),
  });
}

export function useFocusScore(date = todayIso()) {
  return useQuery({
    queryKey: keys.focusScore(date),
    queryFn: () => request(`/focus-score?date=${date}`, FocusScore),
  });
}

export function useHistory(days = 7) {
  return useQuery({
    queryKey: keys.history(days),
    queryFn: () => request(`/history?days=${days}`, HistoryResponse),
  });
}

export function useProtocols() {
  return useQuery({
    queryKey: keys.protocols,
    queryFn: () => request("/recommendations/protocols", ProtocolsResponse),
    staleTime: 5 * 60_000,
  });
}

/**
 * Photo → proposed items, in three steps: ask the API where to upload, PUT the
 * photo straight to storage (so it never passes through the API), then analyze
 * it by key (ARCHITECTURE §9).
 */
export function useAnalyzeMeal() {
  return useMutation({
    mutationFn: async (photo: File) => {
      const upload = await request("/uploads/meal-photo", PhotoUpload, {
        method: "POST",
        // Some cameras hand over a file with no type; the picker only offers images.
        body: JSON.stringify({ mediaType: photo.type || "image/jpeg", sizeBytes: photo.size }),
      });
      // Not `request`: this goes to storage, not the API, and must carry no auth header.
      const put = await fetch(upload.uploadUrl, { method: "PUT", headers: upload.headers, body: photo });
      if (!put.ok) throw new Error(`Photo upload failed with ${put.status}`);
      return request("/meals/analyze", AnalyzeMealResponse, { method: "POST", body: JSON.stringify({ photoKey: upload.photoKey }) });
    },
  });
}

/** Anything that changes intake or flags invalidates the day and the suggestions. */
function useInvalidateDay() {
  const client = useQueryClient();
  return useCallback(
    () =>
      Promise.all([
        client.invalidateQueries({ queryKey: ["bio-state"] }),
        client.invalidateQueries({ queryKey: ["meals"] }),
        client.invalidateQueries({ queryKey: keys.recommendations }),
        client.invalidateQueries({ queryKey: ["focus-score"] }),
        client.invalidateQueries({ queryKey: ["history"] }),
      ]),
    [client],
  );
}

const postMeal = (meal: CreateMealRequest) => request("/meals", Meal, { method: "POST", body: JSON.stringify(meal) });

/** Whose queue this is: the signed-in email, or "" where there is no sign-in (unit tests). */
function useQueueOwner() {
  return useOptionalAuth()?.user?.email ?? "";
}

/**
 * Logs a meal. If the API can't be reached at all (no response, as opposed to
 * an error response), the meal is kept on the device and the result is
 * "queued"; OfflineMealSync sends it once the connection is back.
 */
export function useCreateMeal() {
  const invalidate = useInvalidateDay();
  const owner = useQueueOwner();
  return useMutation({
    // Run even when the browser reports offline, so the meal reaches the queue instead of pausing.
    networkMode: "always",
    mutationFn: async (logged: CreateMealRequest): Promise<Meal | "queued"> => {
      // One key for this meal, kept through the queue: if the request arrived but its answer was
      // lost, sending it again returns the meal already saved instead of logging a second one.
      const meal = { ...logged, clientKey: logged.clientKey ?? globalThis.crypto.randomUUID() };
      try {
        return await postMeal(meal);
      } catch (error) {
        if (error instanceof RequestFailed) throw error;
        enqueueMeal(owner, meal);
        return "queued";
      }
    },
    onSuccess: (result) => (result === "queued" ? undefined : invalidate()),
  });
}

/** The signed-in person's meals waiting to be sent, oldest first. */
export function useQueuedMeals(): QueuedMeal[] {
  const owner = useQueueOwner();
  const all = useSyncExternalStore(subscribeToMealQueue, queuedMeals, () => EMPTY_QUEUE);
  return all.some((entry) => entry.owner !== owner) ? all.filter((entry) => entry.owner === owner) : all;
}
const EMPTY_QUEUE: QueuedMeal[] = [];

let flushing: Promise<{ logged: number }> | null = null;

/**
 * Sends the queue in order and stops at the first meal that gets no response.
 * A meal the API rejects (a 4xx) is dropped so it can't block the ones behind it.
 * If a response is lost after the API saved the meal, that meal is sent twice:
 * POST /meals has no idempotency key yet.
 */
export function useFlushMealQueue() {
  const invalidate = useInvalidateDay();
  const owner = useQueueOwner();
  return useCallback(() => {
    flushing ??= (async () => {
      let logged = 0;
      for (const entry of queuedMeals().filter((e) => e.owner === owner)) {
        try {
          await postMeal(entry.meal);
          logged++;
        } catch (error) {
          const rejected = error instanceof RequestFailed && error.status >= 400 && error.status < 500 && error.status !== 401;
          if (!rejected) break;
        }
        dequeueMeal(entry.id);
      }
      if (logged) await invalidate();
      return { logged };
    })().finally(() => {
      flushing = null;
    });
    return flushing;
  }, [invalidate, owner]);
}

export function useDeleteMeal() {
  const invalidate = useInvalidateDay();
  return useMutation({
    mutationFn: (id: string) => request(`/meals/${id}`, z.undefined(), { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

export function useCreateCheckIn() {
  const invalidate = useInvalidateDay();
  return useMutation({
    mutationFn: (checkIn: CreateCheckInRequest) =>
      request("/check-ins", CheckIn, { method: "POST", body: JSON.stringify(checkIn) }),
    onSuccess: invalidate,
  });
}

export function useLogSleep() {
  const invalidate = useInvalidateDay();
  return useMutation({
    mutationFn: (sessions: IngestSleepRequest["sessions"]) =>
      request("/telemetry/sleep", IngestResponse, { method: "POST", body: JSON.stringify({ sessions }) }),
    onSuccess: invalidate,
  });
}

export function useLogScreenTime() {
  const invalidate = useInvalidateDay();
  return useMutation({
    mutationFn: (samples: IngestScreenTimeRequest["samples"]) =>
      request("/telemetry/screen-time", IngestResponse, { method: "POST", body: JSON.stringify({ samples }) }),
    onSuccess: invalidate,
  });
}

export function useUpdateProfile() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateProfileRequest) =>
      request("/me/profile", Profile, { method: "PUT", body: JSON.stringify(patch) }),
    onSuccess: (profile) => {
      client.setQueryData(keys.me, profile);
      // Targets and time zone change every derived number.
      return client.invalidateQueries({ predicate: (q) => q.queryKey[0] !== "me" });
    },
  });
}

/** Every product, for the admin screen. Fails with 403 for anyone who isn't an admin, so it is never retried. */
/** Every product, for admins; the API answers 403 to everyone else. Pass `false` to hold the request back. */
export function useAdminProducts(enabled = true) {
  return useQuery({
    queryKey: keys.adminProducts,
    queryFn: () => request("/admin/products", AdminProductList),
    enabled,
    retry: false,
    staleTime: 60_000,
  });
}

/** Product edits change what "What could help" suggests, so both lists refresh. */
function useInvalidateProducts() {
  const client = useQueryClient();
  return () => Promise.all([client.invalidateQueries({ queryKey: keys.adminProducts }), client.invalidateQueries({ queryKey: keys.protocols })]);
}

export function useUpdateAdminProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: ({ id, ...settings }: UpdateAdminProductRequest & { id: string }) =>
      request(`/admin/products/${encodeURIComponent(id)}`, AdminProduct, { method: "PUT", body: JSON.stringify(settings) }),
    onSuccess: invalidate,
  });
}

export function useCreateAdminProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: (product: CreateAdminProductRequest) => request("/admin/products", AdminProduct, { method: "POST", body: JSON.stringify(product) }),
    onSuccess: invalidate,
  });
}

export function useDeleteAdminProduct() {
  const invalidate = useInvalidateProducts();
  return useMutation({
    mutationFn: (id: string) => request(`/admin/products/${encodeURIComponent(id)}`, z.undefined(), { method: "DELETE" }),
    onSuccess: invalidate,
  });
}

/** Joins the list of people to email when the mobile app is ready. Public: works signed out. */
export function useJoinWaitlist() {
  return useMutation({
    mutationFn: (entry: JoinWaitlistRequest) => request("/waitlist", JoinWaitlistResponse, { method: "POST", body: JSON.stringify(entry) }),
  });
}

/** Leaves that list, with the token from an email's unsubscribe link. */
export function useLeaveWaitlist() {
  return useMutation({
    mutationFn: (token: string) => request("/waitlist/unsubscribe", LeaveWaitlistResponse, { method: "POST", body: JSON.stringify({ token }) }),
  });
}
