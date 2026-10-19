import { z } from "zod";
import * as contracts from "./index";
import { endpoints } from "./index";

/**
 * The OpenAPI 3.1 description of the API, built from the Zod schemas so the
 * Flutter app can generate a typed Dart client from the same source of truth
 * as the backend and the web app. `npm run openapi` writes it to openapi.json.
 *
 * JSON Schema can't express `.refine()` rules (e.g. "sleep must end after it
 * starts"); those are only enforced by the API and stated in descriptions here.
 */

/** What `endpoints` doesn't carry: a summary, query parameters and the success status. */
interface OperationDoc {
  summary: string;
  description?: string;
  /** Status of the successful response; 200 when omitted. */
  status?: 201 | 204;
  query?: Record<string, { description: string; schema: Record<string, unknown> }>;
  /** Path parameter descriptions, by name. */
  params?: Record<string, string>;
  /** The request can also be a multipart form with these file fields. */
  multipart?: Record<string, string>;
  /** No sign-in needed: the operation overrides the document's default security. */
  public?: boolean;
}

const dateQuery = {
  date: {
    description: "Calendar day in the user's time zone, e.g. 2026-09-29. Defaults to today.",
    schema: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
  },
};

/** One entry per endpoint: adding an endpoint without documenting it is a type error. */
const operations: Record<keyof typeof endpoints, OperationDoc> = {
  getMe: { summary: "Get the profile and targets", description: "404 until the profile has been set up." },
  updateProfile: {
    summary: "Create or update the profile",
    description: "The first save creates the profile and needs displayName, dietaryPreference, dailyCalorieTarget and macroTargets. Later saves can be partial.",
  },
  getBioState: { summary: "Get a day's intake against its targets", query: dateQuery },
  createCheckIn: { summary: "Record how the user feels", status: 201 },
  createPhotoUpload: {
    summary: "Get a short-lived URL to upload a meal photo to",
    description: "PUT the photo's bytes to `uploadUrl` with exactly the returned `headers`, then pass `photoKey` to POST /meals/analyze. The photo must be an image of at most 8 MB, and the bytes sent must match `sizeBytes`.",
  },
  logWeight: { summary: "Log a weigh-in", description: "One per day in the profile's time zone; logging the same day again replaces it. Kilograms." },
  getWeights: {
    summary: "Weigh-ins with the trend and goal progress",
    description: "The trend is an exponential moving average that evens out day-to-day water swings; goal progress and the projected date are read from it, not from single weigh-ins.",
    query: { days: { description: "How many days back, 1–730. Defaults to 90.", schema: { type: "integer", minimum: 1, maximum: 730 } } },
  },
  deleteWeight: { summary: "Remove a weigh-in", status: 204, params: { date: "The weigh-in's day, YYYY-MM-DD." } },
  getSubscription: {
    summary: "Your subscription",
    description: "As last reported by RevenueCat. Without access it asks RevenueCat directly once, so a purchase made seconds ago already counts. When the paywall is on, photo and label reading and recipe suggestions answer 402 `subscription_required` without access.",
  },
  addBrainCheck: {
    summary: "Save a Brain speed check",
    description: "A 2-minute reaction-time test after the Psychomotor Vigilance Task: send each reaction in milliseconds and the number of taps before the light. The API scores it (0–100) from the median, lapses (500 ms or more) and false starts. A self-check for comparing your own days, not a medical test.",
  },
  logExercise: {
    summary: "Log exercise",
    status: 201,
    description: "Calories are burned above resting (MET − 1) × kg × hours, from the latest weigh-in, or 70 kg without one.",
  },
  getExercises: { summary: "Get a day's exercise with its totals", query: dateQuery },
  deleteExercise: { summary: "Remove logged exercise", status: 204, params: { id: "The exercise's id." } },
  getEnvironment: {
    summary: "A day's environment",
    description: "The day's mean US AQI for the town you set (Open-Meteo), your environment check (morning daylight, a dark and quiet bedroom, filtered water), and the Focus Score's environment input.",
    query: dateQuery,
  },
  setEnvironmentLocation: { summary: "Set the town for air quality", description: "A town or postcode, looked up once and stored rounded to about 10 km. Null clears it." },
  saveEnvironmentCheck: { summary: "Answer the day's environment check", description: "Items not sent keep their answer. Default date: today." },
  getLevel: {
    summary: "Your biohacking level",
    description: "Levels 1 (Aware) to 5 (Upgraded) from habits kept over the last 28 days: logging, food quality, evening rhythm and fasting, sleep, stress and Brain speed, then movement. Each level needs every one below it. Each habit says how close it is.",
  },
  getPantry: { summary: "What's in your kitchen" },
  getMealPlan: { summary: "Your latest meal plan", description: "404 until a plan has been made." },
  createMealPlan: {
    summary: "Make a meal plan",
    description: "1 to 3 days of meals sized to your calorie and macro targets, using your pantry first and fitting your fasting plan (one meal for OMAD, two for 16:8, else three). Meals come from Claude (schema-checked); calories use USDA catalog values where ingredients match. The shopping list combines everything not in your pantry. Replaces the last plan.",
    status: 201,
  },
  analyzeRecipe: {
    summary: "Work out a recipe's nutrition",
    description: "Ingredients are read (Claude, schema-checked) and converted to grams. Those that match the food catalog use its USDA FoodData Central values scaled by weight; the rest use estimates, and each ingredient says which. Per serving, with the dish graded by its most processed ingredient. Nothing is saved.",
  },
  getAdminKnowledge: { summary: "Videos and techniques for review", description: "Admins only. Newest first, each video with the techniques taken from its transcript and their review status." },
  addKnowledgeSource: {
    summary: "Add a video or episode",
    description: "Admins only. With a transcript, techniques are taken from it at once (Claude, schema-checked); without one, it waits in the list. Transcripts aren't stored.",
    status: 201,
  },
  addKnowledgeTranscript: { summary: "Add a transcript to a video in the list", description: "Admins only. Takes techniques from it for review.", params: { id: "The video's id." } },
  reviewTechnique: {
    summary: "Approve or reject a technique",
    description: "Admins only. Approving adds it to the catalog as a routine (optionally edited), tagged by pillar and linked to the moment in the video; it is then matched to people's weak points.",
    params: { id: "The technique's id." },
  },
  syncKnowledge: { summary: "Check watched channels for new videos now", description: "Admins only. Needs YOUTUBE_API_KEY; titles and links only." },
  getMarkers: {
    summary: "Health markers",
    description: "Each marker with readings in the last 400 days: the latest reading, the change against the reading closest to 90 days earlier, whether that went the healthier way, and up to 12 recent points. References are general adult ranges in plain words, never a diagnosis.",
  },
  recordMarkers: {
    summary: "Record health marker readings",
    description: "From the app (typed in) or imported from Health Connect / Apple Health. A reading with the same marker, time and source is kept once, so imports can be sent again. Values outside each marker's plausible range are refused.",
  },
  deleteMarker: { summary: "Delete a health marker reading", params: { id: "The reading's id." } },
  getHealthspan: {
    summary: "This week's healthspan habits",
    description: "Monday to today in the user's time zone: easy cardio minutes, strength and hard sessions, protein days, the ultra-processed share, a steady wake time and morning daylight, each against its weekly target. Health conditions can leave a habit out (skipped, with the reason).",
  },
  getAdminDevices: {
    summary: "Kitchen devices found by the monthly scout",
    description: "Admins only. Each kitchen category the shopping review can suggest (air fryer, water filter, ice cream maker, blender) is searched once a month; devices found wait here as pending.",
  },
  reviewDevice: {
    summary: "Approve or dismiss a device",
    description: "Admins only. Approving adds it as a product (optionally edited), tagged for its category, so the shopping review can suggest it. Not an affiliate link; change that on the product afterwards.",
    params: { id: "The device's id." },
  },
  scanDevices: { summary: "Look for new devices now", description: "Admins only. Needs TAVILY_API_KEY. Only links from the search results are kept." },
  reviewShoppingList: {
    summary: "Review a shopping list",
    description: "Send the list as JSON `text`, or a photo of a written list, receipt or shopping app as multipart `photo`. Each item is graded (whole, processed, ultra-processed) and marked keep, swap (with a cleaner choice) or limit. Kitchen devices are suggested only when the list shows a swap they make easy, from enabled catalog products. Nothing is saved.",
    multipart: { photo: "A photo of the list (JPEG, PNG or WebP)." },
  },
  addPantryItems: { summary: "Add items to your pantry", description: "Names already there, ignoring case and plurals, are skipped. Returns the whole pantry." },
  deletePantryItem: { summary: "Remove a pantry item", status: 204, params: { id: "The item's id." } },
  pantryRecipes: {
    summary: "Suggest recipes from your pantry",
    description: "Up to three recipes built mostly from your pantry, sized to the calories and macros left today and your dietary preference. Needs at least three items. Each ingredient says whether it's already in your pantry. Nothing is saved.",
  },
  getBrainChecks: {
    summary: "Your Brain speed checks",
    description: "Newest first, with your usual score: the median of the checks before the latest, once there are three.",
    query: { days: { description: "How many days back, 1–365. Defaults to 30.", schema: { type: "integer", minimum: 1, maximum: 365 } } },
  },
  getStack: {
    summary: "Your supplement stack",
    description: "Each supplement with today's tick and days of the bottle left, plus checks no single label can show: daily totals across products against adult upper limits, the same nutrient in several products, and caffeine taken in the evening.",
  },
  addStackItem: { summary: "Add a supplement to your stack", description: "Usually straight from a label scan. At most 30 supplements." },
  updateStackItem: { summary: "Change servings, timing or the bottle size", params: { id: "The stack item's id." } },
  deleteStackItem: { summary: "Remove a supplement from your stack", status: 204, params: { id: "The stack item's id." } },
  setStackTaken: { summary: "Tick a supplement as taken today", params: { id: "The stack item's id." } },
  getFasting: {
    summary: "Where you are in your fast",
    description: "Worked out from logged meals: a fast runs from the last meal, and the eating window opens with the first meal after a full fast. The protocol comes from the bio-profile; people who answered the weight goal's safety question get 12:12 at most.",
  },
  scanFood: {
    summary: "Read a food package's label",
    description: "1–4 photos of the same package (nutrition panel, ingredients, dates), as uploaded photoKeys or multipart `photo` fields. NeuroCal grades the ingredient list (NOVA: whole, processed, ultra-processed, naming the industrial ingredients) and flags added sugar, sodium and best-before dates. Nothing is saved.",
  },
  lookupBarcode: {
    summary: "Look up a barcode",
    description: "From Open Food Facts (Open Database License: credit it where the data shows), graded the same way as a label scan. 404 when the barcode isn't in the database: photograph the label instead.",
    params: { code: "The barcode's 8 to 14 digits." },
  },
  listFoods: {
    summary: "List the food catalog",
    description: "About 100 everyday and brain-friendly foods, per serving, with the goals and diets each suits. Nutrition comes from USDA FoodData Central (`fdcId`). Small enough to fetch once and search on the device.",
  },
  analyzeSupplement: {
    summary: "Read a supplement label from 1–4 photos",
    description: "Photos of the same bottle from different sides are read as one label, so a label that wraps around the bottle comes out whole. Upload each photo as for meals (POST /uploads/meal-photo) and pass the photoKeys, or send them as multipart/form-data, one `photo` field per photo. Returns what the label says, flags such as proprietary blends, doses above upper limits, missing third-party testing and expiry, and a close own-brand alternative when there is one. It reports the label only and is not a safety or quality verdict. Nothing is saved.",
  },
  analyzeMeal: {
    summary: "Propose food items from a meal photo",
    description: "Send the `photoKey` of an uploaded photo as JSON, or the photo itself as multipart. Nothing is saved. A photo that can't be read is a normal 200 response with `problem` set.",
    multipart: { photo: "The meal photo (JPEG, PNG, WebP or HEIC)." },
  },
  createMeal: { summary: "Log a confirmed meal", status: 201 },
  listMeals: { summary: "List a day's meals, earliest first", query: dateQuery },
  deleteAccount: {
    summary: "Delete your account",
    status: 204,
    description: "Removes the profile, meals, check-ins, scores, imported sleep and screen time, meal photos, any waitlist entry for the email, and the sign-in. It cannot be undone.",
  },
  deleteMeal: { summary: "Remove a meal", status: 204, params: { id: "The meal's id." } },
  nextRecommendations: { summary: "Suggest recipes for the current bio-state" },
  getFocusScore: { summary: "Get a day's Focus Score with its inputs and explanation", query: dateQuery },
  getToday: {
    summary: "Get everything the Today screen shows in one call",
    description: "Without `date`: today, with suggestions, fasting, the supplement stack and Brain speed. With a past `date`: that day's score, calories and meals only. An extra that fails is left out rather than failing the call.",
    query: dateQuery,
  },
  getHistory: {
    summary: "Get the last N days, oldest first",
    query: { days: { description: "How many days, ending today. Defaults to 7.", schema: { type: "integer", minimum: 1, maximum: 31 } } },
  },
  getProtocols: { summary: "Suggest protocols and products for the week's weak points" },
  listAdminProducts: { summary: "List every product for the admin screen", description: "Admins only; anyone else gets 403." },
  createAdminProduct: {
    summary: "Add a product from the admin screen",
    description: "Admins only. An affiliate or own-brand product needs a link.",
    status: 201,
  },
  updateAdminProduct: {
    summary: "Change a product's link, affiliate label or on/off state",
    description: "Admins only. Send only the fields to change; `url: null` goes back to the catalog's link.",
    params: { id: "The product's id." },
  },
  deleteAdminProduct: {
    summary: "Remove a product added from the admin screen",
    description: "Admins only. Catalog products can't be removed, only turned off.",
    status: 204,
    params: { id: "The product's id." },
  },
  ingestSleep: {
    summary: "Store sleep sessions",
    description: "A session replaces any stored session from the same source that overlaps it. Sleep must end after it starts, last at most 24 hours and not end in the future.",
  },
  ingestScreenTime: {
    summary: "Store screen-time samples",
    description: "Samples upsert on source and windowStart. Minutes can't exceed the window length.",
  },
  getAdminWaitlist: { summary: "See who is on the waitlist", description: "Admins only; anyone else gets 403. Counts leave out people who unsubscribed; entries are newest first, at most 500." },
  joinWaitlist: {
    summary: "Ask to be emailed when the app is ready",
    description: "Public: no sign-in. Answers the same way whether or not the address was already on the list.",
    status: 201,
    public: true,
  },
  leaveWaitlist: {
    summary: "Leave the waitlist",
    description: "Public: no sign-in. Takes the token from the unsubscribe link in a waitlist email; an unknown token is answered the same way.",
    public: true,
  },
};

const REF_PREFIX = "#/components/schemas/";

/**
 * Every exported object, enum and list schema becomes a named component, so
 * generated clients get named types. Plain strings (Id, IsoDate, IsoDateTime)
 * stay inline: a named alias for a string only adds noise to a client.
 */
function namedSchemas() {
  const registry = z.registry<{ id: string }>();
  for (const [name, value] of Object.entries(contracts)) {
    if (value instanceof z.ZodType && !(value instanceof z.ZodString) && !(value instanceof z.ZodISODateTime)) {
      registry.add(value, { id: name });
    }
  }
  return registry;
}

const SUCCESS_TEXT = { 200: "OK", 201: "Created", 204: "Done; no content" } as const;

export function buildOpenApi() {
  const registry = namedSchemas();
  const { schemas } = z.toJSONSchema(registry, {
    uri: (id) => `${REF_PREFIX}${id}`,
    // "input" leaves objects open to extra properties, so a client built today tolerates fields added later.
    io: "input",
    override: ({ jsonSchema }) => {
      // Zod bounds every integer at JavaScript's safe range; that isn't part of the contract.
      if (jsonSchema.maximum === Number.MAX_SAFE_INTEGER) delete jsonSchema.maximum;
      if (jsonSchema.minimum === Number.MIN_SAFE_INTEGER) delete jsonSchema.minimum;
      // `format: date-time` already says it; Zod's validation regex is unreadable in a spec.
      if (jsonSchema.format === "date-time") delete jsonSchema.pattern;
    },
  });
  // Inside an OpenAPI document the component key is the identity; drop JSON Schema's own headers.
  for (const schema of Object.values(schemas)) {
    delete schema.$schema;
    delete schema.$id;
  }

  const ref = (schema: z.ZodType) => {
    const id = registry.get(schema)?.id;
    if (!id) throw new Error("Endpoint schemas must be exported from index.ts so they get a name.");
    return { $ref: `${REF_PREFIX}${id}` };
  };
  const json = (schema: z.ZodType) => ({ "application/json": { schema: ref(schema) } });

  const paths: Record<string, Record<string, unknown>> = {};
  for (const [operationId, endpoint] of Object.entries(endpoints) as [keyof typeof endpoints, (typeof endpoints)[keyof typeof endpoints]][]) {
    const doc = operations[operationId];
    const status = doc.status ?? 200;
    const pathParams = [...endpoint.path.matchAll(/:(\w+)/g)].map((m) => m[1]!);

    const parameters = [
      ...pathParams.map((name) => ({ name, in: "path", required: true, description: doc.params?.[name] ?? name, schema: { type: "string" } })),
      ...Object.entries(doc.query ?? {}).map(([name, q]) => ({ name, in: "query", required: false, description: q.description, schema: q.schema })),
    ];

    const multipart = doc.multipart && {
      "multipart/form-data": {
        schema: {
          type: "object",
          required: Object.keys(doc.multipart),
          properties: Object.fromEntries(
            Object.entries(doc.multipart).map(([field, description]) => [field, { type: "string", format: "binary", description }]),
          ),
        },
      },
    };
    const requestBody =
      "body" in endpoint || multipart
        ? { required: true, content: { ...("body" in endpoint ? json(endpoint.body) : {}), ...multipart } }
        : undefined;

    const path = endpoint.path.replace(/:(\w+)/g, "{$1}");
    (paths[path] ??= {})[endpoint.method.toLowerCase()] = {
      operationId,
      summary: doc.summary,
      ...(doc.description ? { description: doc.description } : {}),
      ...(parameters.length ? { parameters } : {}),
      ...(requestBody ? { requestBody } : {}),
      ...(doc.public ? { security: [] } : {}),
      responses: {
        [status]: {
          description: SUCCESS_TEXT[status],
          ...("response" in endpoint ? { content: json(endpoint.response) } : {}),
        },
        default: { $ref: "#/components/responses/Error" },
      },
    };
  }

  return {
    openapi: "3.1.0",
    info: {
      title: "NeuroCal API",
      version: "0.1.0",
      description: "Generated from packages/contracts (Zod). Do not edit by hand: change the contract and run `npm run openapi`.",
    },
    // Deployed stages get their own URL from the CDK stack output; clients set it at build time.
    servers: [{ url: "http://localhost:4000", description: "Local backend (`npm run dev` in backend)" }],
    security: [{ cognitoIdToken: [] }],
    paths,
    components: {
      securitySchemes: {
        cognitoIdToken: { type: "http", scheme: "bearer", bearerFormat: "JWT", description: "The Cognito ID token of the signed-in user." },
      },
      responses: {
        Error: {
          description: "Any failure. `message` is written for the user and can be shown as is.",
          content: json(contracts.ApiError),
        },
      },
      schemas,
    },
  };
}
