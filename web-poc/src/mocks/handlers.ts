import { HttpResponse, delay, http } from "msw";
import {
  CreateCheckInRequest,
  CreateMealRequest,
  IngestScreenTimeRequest,
  IngestSleepRequest,
  UpdateProfileRequest,
} from "@neurocal/contracts";
import { createDb } from "./db";
import { todayIso } from "../lib/format";

const invalid = (message: string) => HttpResponse.json({ code: "invalid_request", message }, { status: 400 });
const noProfile = () => HttpResponse.json({ code: "not_found", message: "Set up your profile first." }, { status: 404 });

export function createHandlers(base = "/api", db = createDb(), latency = 350) {
  const url = (path: string) => `${base}${path}`;
  const dateParam = (request: Request) => new URL(request.url).searchParams.get("date") ?? todayIso();

  return [
    http.get(url("/me"), async () => {
      await delay(latency);
      return db.profile() ? HttpResponse.json(db.profile()) : noProfile();
    }),
    http.put(url("/me/profile"), async ({ request }) => {
      const body = UpdateProfileRequest.safeParse(await request.json());
      if (!body.success) return invalid("Profile update is not valid.");
      await delay(latency);
      const result = db.updateProfile(body.data);
      return "missing" in result
        ? invalid(`To set up your profile, also send: ${result.missing.join(", ")}.`)
        : HttpResponse.json(result);
    }),
    http.get(url("/bio-state"), async ({ request }) => {
      if (!db.profile()) return noProfile();
      await delay(latency);
      return HttpResponse.json(db.bioState(dateParam(request)));
    }),
    http.get(url("/meals"), async ({ request }) => {
      if (!db.profile()) return noProfile();
      await delay(latency);
      return HttpResponse.json(db.mealsOn(dateParam(request)));
    }),
    http.post(url("/meals/analyze"), async ({ request }) => {
      const form = await request.formData();
      const photo = form.get("photo");
      // Not `instanceof File`: in tests the File comes from jsdom, not Node.
      if (!photo || typeof photo === "string") return invalid("Attach a photo of the meal.");
      await delay(latency * 4);
      return HttpResponse.json(db.analyze(photo.name));
    }),
    http.post(url("/meals"), async ({ request }) => {
      const body = CreateMealRequest.safeParse(await request.json());
      if (!body.success) return invalid("A meal needs at least one item.");
      await delay(latency);
      return HttpResponse.json(db.addMeal(body.data), { status: 201 });
    }),
    http.delete(url("/meals/:id"), async ({ params }) => {
      await delay(latency);
      return db.deleteMeal(String(params.id))
        ? new HttpResponse(null, { status: 204 })
        : HttpResponse.json({ code: "not_found", message: "That meal no longer exists." }, { status: 404 });
    }),
    http.post(url("/check-ins"), async ({ request }) => {
      const body = CreateCheckInRequest.safeParse(await request.json());
      if (!body.success) return invalid("Pick at least one way you feel.");
      await delay(latency);
      return HttpResponse.json(db.addCheckIn(body.data), { status: 201 });
    }),
    http.get(url("/history"), async ({ request }) => {
      if (!db.profile()) return noProfile();
      const days = Number(new URL(request.url).searchParams.get("days") ?? 7);
      if (!Number.isInteger(days) || days < 1 || days > 31) return invalid("Ask for between 1 and 31 days.");
      await delay(latency);
      return HttpResponse.json({ days: db.history(days) });
    }),
    http.get(url("/focus-score"), async ({ request }) => {
      if (!db.profile()) return noProfile();
      await delay(latency);
      return HttpResponse.json(db.focusScore(dateParam(request)));
    }),
    http.post(url("/telemetry/sleep"), async ({ request }) => {
      const body = IngestSleepRequest.safeParse(await request.json());
      if (!body.success) return invalid(body.error.issues[0]?.message ?? "That sleep entry isn't valid.");
      await delay(latency);
      return HttpResponse.json({ accepted: db.addSleep(body.data.sessions) });
    }),
    http.post(url("/telemetry/screen-time"), async ({ request }) => {
      const body = IngestScreenTimeRequest.safeParse(await request.json());
      if (!body.success) return invalid("That screen-time entry isn't valid.");
      return HttpResponse.json({ accepted: db.addScreenTime(body.data.samples) });
    }),
    http.get(url("/recommendations/next"), async () => {
      if (!db.profile()) return noProfile();
      await delay(latency * 2);
      return HttpResponse.json(db.recommendations());
    }),
  ];
}
