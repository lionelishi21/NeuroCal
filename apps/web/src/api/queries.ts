import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import {
  AnalyzeMealResponse,
  BioState,
  CheckIn,
  type CreateCheckInRequest,
  type CreateMealRequest,
  Meal,
  NextRecommendationsResponse,
  Profile,
} from "@neurocal/contracts";
import { request } from "./client";
import { todayIso } from "../lib/format";

export const keys = {
  me: ["me"] as const,
  bioState: (date: string) => ["bio-state", date] as const,
  meals: (date: string) => ["meals", date] as const,
  recommendations: ["recommendations", "next"] as const,
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

export function useAnalyzeMeal() {
  return useMutation({
    mutationFn: (photo: File) => {
      const form = new FormData();
      form.append("photo", photo);
      return request("/meals/analyze", AnalyzeMealResponse, { method: "POST", body: form });
    },
  });
}

/** Anything that changes intake or flags invalidates the day and the suggestions. */
function useInvalidateDay() {
  const client = useQueryClient();
  return () =>
    Promise.all([
      client.invalidateQueries({ queryKey: ["bio-state"] }),
      client.invalidateQueries({ queryKey: ["meals"] }),
      client.invalidateQueries({ queryKey: keys.recommendations }),
    ]);
}

export function useCreateMeal() {
  const invalidate = useInvalidateDay();
  return useMutation({
    mutationFn: (meal: CreateMealRequest) =>
      request("/meals", Meal, { method: "POST", body: JSON.stringify(meal) }),
    onSuccess: invalidate,
  });
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
