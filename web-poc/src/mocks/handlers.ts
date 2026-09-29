import { HttpResponse, delay, http } from "msw";
import { CreateCheckInRequest, CreateMealRequest, UpdateProfileRequest } from "@neurocal/contracts";
import { createDb } from "./db";
import { todayIso } from "../lib/format";

const invalid = (message: string) => HttpResponse.json({ code: "invalid_request", message }, { status: 400 });

export function createHandlers(base = "/api", db = createDb(), latency = 350) {
  const url = (path: string) => `${base}${path}`;
  const dateParam = (request: Request) => new URL(request.url).searchParams.get("date") ?? todayIso();

  return [
    http.get(url("/me"), async () => {
      await delay(latency);
      return HttpResponse.json(db.profile());
    }),
    http.put(url("/me/profile"), async ({ request }) => {
      const body = UpdateProfileRequest.safeParse(await request.json());
      if (!body.success) return invalid("Profile update is not valid.");
      return HttpResponse.json(db.updateProfile(body.data));
    }),
    http.get(url("/bio-state"), async ({ request }) => {
      await delay(latency);
      return HttpResponse.json(db.bioState(dateParam(request)));
    }),
    http.get(url("/meals"), async ({ request }) => {
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
    http.get(url("/recommendations/next"), async () => {
      await delay(latency * 2);
      return HttpResponse.json(db.recommendations());
    }),
  ];
}
