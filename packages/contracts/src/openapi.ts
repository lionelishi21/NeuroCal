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
  analyzeMeal: {
    summary: "Propose food items from a meal photo",
    description: "Send the `photoKey` of an uploaded photo as JSON, or the photo itself as multipart. Nothing is saved. A photo that can't be read is a normal 200 response with `problem` set.",
    multipart: { photo: "The meal photo (JPEG, PNG, WebP or HEIC)." },
  },
  createMeal: { summary: "Log a confirmed meal", status: 201 },
  listMeals: { summary: "List a day's meals, earliest first", query: dateQuery },
  deleteMeal: { summary: "Remove a meal", status: 204, params: { id: "The meal's id." } },
  nextRecommendations: { summary: "Suggest recipes for the current bio-state" },
  getFocusScore: { summary: "Get a day's Focus Score with its inputs and explanation", query: dateQuery },
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
