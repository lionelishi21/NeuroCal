import { HttpResponse, delay, http } from "msw";
import {
  type AdminProduct,
  AnalyzeMealRequest,
  CreateAdminProductRequest,
  CreateCheckInRequest,
  CreateMealRequest,
  CreatePhotoUploadRequest,
  IngestScreenTimeRequest,
  IngestSleepRequest,
  JoinWaitlistRequest,
  LeaveWaitlistRequest,
  UpdateAdminProductRequest,
  UpdateProfileRequest,
} from "@neurocal/contracts";
import { MOCK_PRODUCTS, createDb } from "./db";
import { todayIso } from "../lib/format";

const invalid = (message: string) => HttpResponse.json({ code: "invalid_request", message }, { status: 400 });
const noProfile = () => HttpResponse.json({ code: "not_found", message: "Set up your profile first." }, { status: 404 });

export function createHandlers(base = "/api", db = createDb(), latency = 350) {
  const url = (path: string) => `${base}${path}`;
  // The mock user is an admin. Products start from what the mock suggests, plus two partner brands.
  const catalogUrls = new Map<string, string | undefined>();
  const adminProducts: AdminProduct[] = [
    ...MOCK_PRODUCTS.map(({ match: _, ...p }) => ({ ...p, tags: [], enabled: true, managedBy: "catalog" as const })),
    { id: "truedark-evening-glasses", name: "TrueDark evening glasses", description: "Glasses with amber or red lenses that block blue and green light, worn before bed.", url: "https://truedark.com/", affiliate: true, ownBrand: false, supplement: false, tags: ["sleep", "late-night screens"], enabled: true, managedBy: "catalog" },
    { id: "lmnt-electrolytes", name: "LMNT electrolyte drink mix", description: "A sugar-free sodium, potassium and magnesium drink mix.", url: "https://drinklmnt.com/", affiliate: false, ownBrand: false, supplement: true, tags: ["energy"], enabled: true, managedBy: "catalog" },
  ];
  for (const p of adminProducts) catalogUrls.set(p.id, p.url);
  let adminCount = 0;
  const noProduct = () => HttpResponse.json({ code: "not_found", message: "That product no longer exists." }, { status: 404 });
  let uploadCount = 0;
  const uploaded = new Set<string>();
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
    http.post(url("/uploads/meal-photo"), async ({ request }) => {
      const body = CreatePhotoUploadRequest.safeParse(await request.json());
      if (!body.success) return invalid("The photo must be an image of at most 8 MB.");
      await delay(latency);
      const photoKey = `uploads/u1/${++uploadCount}`;
      return HttpResponse.json(
        {
          photoKey,
          // Stands in for the presigned S3 URL; the PUT handler below receives the bytes.
          uploadUrl: new URL(url(`/_uploads/${uploadCount}`), globalThis.location?.origin ?? "http://localhost").href,
          headers: { "content-type": body.data.mediaType },
          expiresAt: new Date(Date.now() + 5 * 60_000).toISOString(),
        },
        { status: 201 },
      );
    }),
    http.put(url("/_uploads/:id"), async ({ params }) => {
      await delay(latency);
      uploaded.add(`uploads/u1/${String(params.id)}`);
      return new HttpResponse(null, { status: 200 });
    }),
    http.post(url("/meals/analyze"), async ({ request }) => {
      if (request.headers.get("content-type")?.startsWith("application/json")) {
        const body = AnalyzeMealRequest.safeParse(await request.json());
        if (!body.success || !uploaded.has(body.data.photoKey)) {
          return HttpResponse.json({ code: "not_found", message: "That photo isn't there. Choose it again." }, { status: 404 });
        }
        await delay(latency * 4);
        return HttpResponse.json(db.analyze(body.data.photoKey));
      }
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
    http.get(url("/admin/products"), async () => {
      await delay(latency);
      return HttpResponse.json({ products: [...adminProducts].sort((a, b) => a.name.localeCompare(b.name)) });
    }),
    http.post(url("/admin/products"), async ({ request }) => {
      const body = CreateAdminProductRequest.safeParse(await request.json());
      if (!body.success) return invalid("A product needs a name, a description and an https link.");
      if ((body.data.affiliate || body.data.ownBrand) && !body.data.url) return invalid("An affiliate or own-brand product needs a link.");
      await delay(latency);
      const { url: link, ...rest } = body.data;
      const product: AdminProduct = { ...rest, ...(link ? { url: link } : {}), id: `admin-${++adminCount}`, enabled: true, managedBy: "admin" };
      adminProducts.push(product);
      return HttpResponse.json(product, { status: 201 });
    }),
    http.put(url("/admin/products/:id"), async ({ params, request }) => {
      const body = UpdateAdminProductRequest.safeParse(await request.json());
      if (!body.success) return invalid("The link must start with https://.");
      const index = adminProducts.findIndex((p) => p.id === params.id);
      if (index < 0) return noProduct();
      await delay(latency);
      const { url: _url, catalogUrl: _catalogUrl, ...current } = adminProducts[index]!;
      const original = catalogUrls.get(current.id);
      // undefined keeps the current link, null goes back to the catalog's, a string replaces it.
      const link = body.data.url === undefined ? _url : (body.data.url ?? original);
      const next: AdminProduct = {
        ...current,
        ...(body.data.affiliate === undefined ? {} : { affiliate: body.data.affiliate }),
        ...(body.data.enabled === undefined ? {} : { enabled: body.data.enabled }),
        ...(link ? { url: link } : {}),
        ...(original && link !== original ? { catalogUrl: original } : {}),
      };
      adminProducts[index] = next;
      return HttpResponse.json(next);
    }),
    http.delete(url("/admin/products/:id"), async ({ params }) => {
      const index = adminProducts.findIndex((p) => p.id === params.id && p.managedBy === "admin");
      if (index < 0) return noProduct();
      await delay(latency);
      adminProducts.splice(index, 1);
      return new HttpResponse(null, { status: 204 });
    }),
    http.get(url("/recommendations/protocols"), async () => {
      if (!db.profile()) return noProfile();
      await delay(latency);
      return HttpResponse.json(db.protocols());
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
    // Public on the real API too: the landing page's visitors have no account.
    http.post(url("/waitlist"), async ({ request }) => {
      const body = JoinWaitlistRequest.safeParse(await request.json());
      if (!body.success) return invalid("Enter a valid email address.");
      await delay(latency);
      return HttpResponse.json({ status: "joined" }, { status: 201 });
    }),
    http.post(url("/waitlist/unsubscribe"), async ({ request }) => {
      const body = LeaveWaitlistRequest.safeParse(await request.json());
      if (!body.success) return invalid("That unsubscribe link isn't complete.");
      await delay(latency);
      return HttpResponse.json({ status: "unsubscribed" });
    }),
    http.get(url("/recommendations/next"), async () => {
      if (!db.profile()) return noProfile();
      await delay(latency * 2);
      return HttpResponse.json(db.recommendations());
    }),
  ];
}
