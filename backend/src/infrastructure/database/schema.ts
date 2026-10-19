/**
 * Drizzle schema for Aurora PostgreSQL + pgvector (ARCHITECTURE §4).
 * Migration 0002 enables the `vector` extension before the catalog tables use it.
 */
import { sql } from "drizzle-orm";
import { EXERCISE_KINDS, INTENSITIES } from "../../domain/exercise";
import { DEVICE_TAGS } from "../../domain/devices";
import { PILLARS } from "../../domain/knowledge";
import type { SupplementIngredient } from "../../domain/supplement";
import type { WeightGoal } from "../../domain/weight";
import { boolean, check, date, index, integer, jsonb, numeric, pgTable, primaryKey, real, smallint, text, timestamp, unique, uuid, varchar, vector } from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

const deletedAt = timestamp("deleted_at", { withTimezone: true });

/** numeric columns come back from pg as strings; read them as numbers. */
const decimal = (name: string, precision: number, scale: number) =>
  numeric(name, { precision, scale, mode: "number" });

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  cognitoSub: text("cognito_sub").notNull().unique(),
  email: text("email").notNull().unique(),
  ...timestamps,
  deletedAt,
});

export const profiles = pgTable(
  "profiles",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    timeZone: text("time_zone").notNull().default("UTC"),
    dietaryPreference: text("dietary_preference").notNull(),
    cognitiveGoals: text("cognitive_goals").array().notNull().default(sql`'{}'::text[]`),
    dailyCalorieTarget: integer("daily_calorie_target").notNull(),
    proteinTargetG: decimal("protein_target_g", 6, 1).notNull(),
    carbsTargetG: decimal("carbs_target_g", 6, 1).notNull(),
    fatTargetG: decimal("fat_target_g", 6, 1).notNull(),
    /** Bio-profile onboarding answers (packages/contracts BioProfile), or null. */
    bioProfile: jsonb("bio_profile").$type<Record<string, string | boolean | string[]>>(),
    /** Weight-loss plan (packages/contracts WeightGoal), or null. */
    weightGoal: jsonb("weight_goal").$type<WeightGoal>(),
    /** Health conditions (domain/conditions.ts), or null when never asked. */
    healthConditions: text("health_conditions").array(),
    ...timestamps,
  },
  (t) => [
    check("profiles_calorie_target_positive", sql`${t.dailyCalorieTarget} > 0`),
    check(
      "profiles_macro_targets_non_negative",
      sql`${t.proteinTargetG} >= 0 and ${t.carbsTargetG} >= 0 and ${t.fatTargetG} >= 0`,
    ),
  ],
);

export const meals = pgTable(
  "meals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    kind: text("kind").notNull(),
    eatenAt: timestamp("eaten_at", { withTimezone: true }).notNull(),
    /** S3 key, never a public URL. */
    photoKey: text("photo_key"),
    /** Made up by the client once per meal, so a retried request can't log it twice. Null from older clients. */
    clientKey: text("client_key"),
    ...timestamps,
    deletedAt,
  },
  (t) => [
    index("meals_user_eaten_at_idx").on(t.userId, t.eatenAt.desc()).where(sql`${t.deletedAt} is null`),
    unique("meals_user_client_key_unique").on(t.userId, t.clientKey),
  ],
);

export const mealItems = pgTable(
  "meal_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    mealId: uuid("meal_id")
      .notNull()
      .references(() => meals.id, { onDelete: "cascade" }),
    position: smallint("position").notNull(),
    name: text("name").notNull(),
    portion: text("portion").notNull(),
    calories: decimal("calories", 7, 1).notNull(),
    proteinG: decimal("protein_g", 6, 1).notNull(),
    carbsG: decimal("carbs_g", 6, 1).notNull(),
    fatG: decimal("fat_g", 6, 1).notNull(),
    /** Null for items the user entered by hand. */
    confidence: real("confidence"),
    glycemicLoad: text("glycemic_load"),
    /** whole, processed or ultra_processed; null for items typed in by hand. */
    processing: text("processing"),
  },
  (t) => [
    unique("meal_items_meal_position_unique").on(t.mealId, t.position),
    check(
      "meal_items_amounts_non_negative",
      sql`${t.calories} >= 0 and ${t.proteinG} >= 0 and ${t.carbsG} >= 0 and ${t.fatG} >= 0`,
    ),
    check("meal_items_confidence_range", sql`${t.confidence} is null or (${t.confidence} between 0 and 1)`),
  ],
);

export const checkIns = pgTable(
  "check_ins",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    at: timestamp("at", { withTimezone: true }).notNull(),
    flags: text("flags").array().notNull(),
    note: varchar("note", { length: 280 }),
    createdAt: timestamps.createdAt,
    deletedAt,
  },
  (t) => [
    index("check_ins_user_at_idx").on(t.userId, t.at.desc()),
    check("check_ins_has_flags", sql`cardinality(${t.flags}) > 0`),
  ],
);

export const recipeRecommendations = pgTable(
  "recipe_recommendations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    searchQuery: text("search_query").notNull(),
    title: text("title").notNull(),
    sourceName: text("source_name").notNull(),
    sourceUrl: text("source_url").notNull(),
    imageUrl: text("image_url"),
    minutes: integer("minutes").notNull(),
    calories: decimal("calories", 7, 1).notNull(),
    proteinG: decimal("protein_g", 6, 1).notNull(),
    carbsG: decimal("carbs_g", 6, 1).notNull(),
    fatG: decimal("fat_g", 6, 1).notNull(),
    reasoning: text("reasoning").notNull(),
    /** Hash of the day and bio-state the batch was made for; the same key means the batch can be served again. Null on older rows. */
    contextKey: text("context_key"),
    createdAt: timestamps.createdAt,
  },
  (t) => [index("recipe_recommendations_user_created_idx").on(t.userId, t.createdAt.desc())],
);

/** People to email when the mobile app is ready. Not tied to an account: they have none yet. */
export const waitlist = pgTable("waitlist", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Lower-cased. */
  email: text("email").notNull().unique(),
  platform: text("platform"),
  unsubscribeToken: text("unsubscribe_token").notNull().unique(),
  confirmationSentAt: timestamp("confirmation_sent_at", { withTimezone: true }),
  unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
  ...timestamps,
});

export const sleepSessions = pgTable(
  "sleep_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    source: text("source").notNull(),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    deepMinutes: integer("deep_minutes"),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    unique("sleep_sessions_user_source_start_unique").on(t.userId, t.source, t.startAt),
    index("sleep_sessions_user_end_idx").on(t.userId, t.endAt.desc()),
    check("sleep_sessions_end_after_start", sql`${t.endAt} > ${t.startAt}`),
  ],
);

export const screenTimeSamples = pgTable(
  "screen_time_samples",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    source: text("source").notNull(),
    windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
    windowEnd: timestamp("window_end", { withTimezone: true }).notNull(),
    minutes: integer("minutes").notNull(),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    unique("screen_time_user_source_window_unique").on(t.userId, t.source, t.windowStart),
    check("screen_time_minutes_fit_window", sql`${t.minutes} >= 0 and ${t.windowEnd} > ${t.windowStart}`),
  ],
);

/** Brain speed checks, scored by the API from the raw reaction times. */
export const brainChecks = pgTable(
  "brain_checks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    takenAt: timestamp("taken_at", { withTimezone: true }).notNull(),
    score: smallint("score").notNull(),
    medianMs: smallint("median_ms").notNull(),
    fastestMs: smallint("fastest_ms").notNull(),
    lapses: smallint("lapses").notNull(),
    falseStarts: smallint("false_starts").notNull(),
    trials: smallint("trials").notNull(),
    /** The raw reaction times, kept so the scoring can be revised later. */
    reactionTimesMs: integer("reaction_times_ms").array().notNull(),
  },
  (t) => [index("brain_checks_user_taken_idx").on(t.userId, t.takenAt.desc()), check("brain_checks_score_range", sql`${t.score} between 0 and 100`)],
);

/** Logged exercise; kcal is worked out when logged, from the weigh-in at the time. */
export const exercises = pgTable(
  "exercises",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    kind: text("kind", { enum: EXERCISE_KINDS }).notNull(),
    intensity: text("intensity", { enum: INTENSITIES }).notNull(),
    minutes: smallint("minutes").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    kcal: smallint("kcal").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("exercises_user_started_idx").on(t.userId, t.startedAt), check("exercises_minutes_range", sql`${t.minutes} between 1 and 600`)],
);

/** What someone has in their kitchen. `key` is the name for matching (lower case, no plural). */
export const pantryItems = pgTable(
  "pantry_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    name: varchar("name", { length: 60 }).notNull(),
    key: varchar("key", { length: 60 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [unique("pantry_items_user_key").on(t.userId, t.key)],
);

/** Where someone wants air quality for: a town, rounded to about 10 km. */
export const environmentLocations = pgTable("environment_locations", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id),
  place: text("place").notNull(),
  latitude: real("latitude").notNull(),
  longitude: real("longitude").notNull(),
});

/** The daily environment check; a null item wasn't answered. */
export const environmentChecks = pgTable(
  "environment_checks",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    date: date("date", { mode: "string" }).notNull(),
    daylight: boolean("daylight"),
    darkBedroom: boolean("dark_bedroom"),
    quietBedroom: boolean("quiet_bedroom"),
    filteredWater: boolean("filtered_water"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] })],
);

/** A day's mean US AQI per rounded place, fetched once and shared by everyone in that town. */
export const airQualityDays = pgTable(
  "air_quality_days",
  {
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    aqi: smallint("aqi"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.latitude, t.longitude, t.date] })],
);

/** The latest meal plan per person, as worked out (docs: domain/mealPlan.ts). */
export const mealPlans = pgTable("meal_plans", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id),
  plan: jsonb("plan").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

/** Videos and episodes for the knowledge pipeline (docs/NCBM.md §7). Transcripts aren't stored. */
export const knowledgeSources = pgTable("knowledge_sources", {
  id: uuid("id").primaryKey().defaultRandom(),
  url: text("url").notNull().unique(),
  title: text("title").notNull(),
  channel: text("channel"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  status: text("status", { enum: ["queued", "extracted", "failed"] }).notNull().default("queued"),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Techniques taken from a source, waiting for a person to approve or reject them. */
export const knowledgeTechniques = pgTable(
  "knowledge_techniques",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => knowledgeSources.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    pillar: text("pillar", { enum: PILLARS }).notNull(),
    summary: text("summary").notNull(),
    steps: text("steps").array().notNull(),
    evidence: text("evidence").notNull(),
    cautions: text("cautions").notNull(),
    quote: text("quote").notNull(),
    timestampSeconds: integer("timestamp_seconds"),
    status: text("status", { enum: ["pending", "approved", "rejected"] }).notNull().default("pending"),
    protocolId: text("protocol_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  },
  (t) => [index("knowledge_techniques_source_idx").on(t.sourceId)],
);

/** AI calls per person, day (UTC) and feature, for the daily allowance (domain/aiAllowance.ts). */
export const aiUsage = pgTable(
  "ai_usage",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    day: text("day").notNull(),
    feature: text("feature", { enum: ["read", "generate"] }).notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.userId, t.day, t.feature] })],
);

/** Kitchen devices the monthly scout found, waiting for an admin; approved ones become products. */
export const deviceCandidates = pgTable("device_candidates", {
  id: uuid("id").primaryKey().defaultRandom(),
  tag: text("tag", { enum: DEVICE_TAGS }).notNull(),
  name: text("name").notNull(),
  /** domain/devices.ts deviceKey: the same device is never added twice. */
  nameKey: text("name_key").notNull().unique(),
  maker: text("maker").notNull(),
  url: text("url").notNull(),
  description: text("description").notNull(),
  status: text("status", { enum: ["pending", "approved", "dismissed"] }).notNull().default("pending"),
  productId: text("product_id"),
  foundAt: timestamp("found_at", { withTimezone: true }).notNull().defaultNow(),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
});

/** Supplements someone takes. Ingredients are kept as read from the label. */
export const stackItems = pgTable(
  "stack_items",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    servingSize: text("serving_size"),
    ingredients: jsonb("ingredients").$type<SupplementIngredient[]>().notNull(),
    servingsPerDay: smallint("servings_per_day").notNull(),
    timing: text("timing").notNull(),
    servingsPerContainer: smallint("servings_per_container"),
    startedOn: date("started_on", { mode: "string" }).notNull(),
    ...timestamps,
  },
  (t) => [index("stack_items_user_idx").on(t.userId), check("stack_items_servings_positive", sql`${t.servingsPerDay} between 1 and 6`)],
);

/** A supplement ticked as taken on a local day. */
export const stackDoses = pgTable(
  "stack_doses",
  {
    itemId: uuid("item_id")
      .notNull()
      .references(() => stackItems.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    date: date("date", { mode: "string" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.date] }), index("stack_doses_user_date_idx").on(t.userId, t.date)],
);

/** One row per user: the subscription as last reported by RevenueCat. */
export const subscriptions = pgTable(
  "subscriptions",
  {
    userId: uuid("user_id")
      .primaryKey()
      .references(() => users.id),
    status: text("status").notNull(),
    productId: text("product_id"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    willRenew: boolean("will_renew").notNull(),
    eventAt: timestamp("event_at", { withTimezone: true }).notNull(),
    /** The trial end the reminder email was sent for, so each trial gets one. */
    trialRemindedFor: timestamp("trial_reminded_for", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [check("subscriptions_status_known", sql`${t.status} in ('trial', 'active', 'grace', 'expired', 'none')`)],
);

/** One weigh-in per user and local day; a second the same day replaces it. */
export const weightEntries = pgTable(
  "weight_entries",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    date: date("date", { mode: "string" }).notNull(),
    kg: decimal("kg", 5, 2).notNull(),
    ...timestamps,
  },
  (t) => [primaryKey({ columns: [t.userId, t.date] }), check("weight_entries_kg_range", sql`${t.kg} between 25 and 350`)],
);

export const focusScores = pgTable(
  "focus_scores",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    date: date("date", { mode: "string" }).notNull(),
    score: smallint("score"),
    sleepComponent: real("sleep_component"),
    timingComponent: real("timing_component"),
    glycemicComponent: real("glycemic_component"),
    stressComponent: real("stress_component"),
    movementComponent: real("movement_component"),
    environmentComponent: real("environment_component"),
    explanation: text("explanation").notNull(),
    modelVersion: text("model_version").notNull(),
    computedAt: timestamp("computed_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.userId, t.date] }),
    check("focus_scores_score_range", sql`${t.score} is null or ${t.score} between 0 and 100`),
  ],
);

/** Matches EMBEDDING_DIMENSIONS (text-embedding-3-small). */
const embedding = () => vector("embedding", { dimensions: 1536 }).notNull();

export const protocols = pgTable(
  "protocols",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    summary: text("summary").notNull(),
    steps: text("steps").array().notNull(),
    tags: text("tags").array().notNull(),
    embedding: embedding(),
    contentHash: text("content_hash").notNull(),
    /** "catalog": from the repo, replaced by catalog syncs; "knowledge": approved in the knowledge pipeline, kept. */
    managedBy: text("managed_by", { enum: ["catalog", "knowledge"] }).notNull().default("catalog"),
    sourceTitle: text("source_title"),
    sourceUrl: text("source_url"),
    updatedAt: timestamps.updatedAt,
  },
  (t) => [index("protocols_embedding_hnsw").using("hnsw", t.embedding.op("vector_cosine_ops"))],
);

export const products = pgTable(
  "products",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    description: text("description").notNull(),
    url: text("url"),
    affiliate: boolean("affiliate").notNull().default(false),
    ownBrand: boolean("own_brand").notNull().default(false),
    supplement: boolean("supplement").notNull().default(false),
    tags: text("tags").array().notNull(),
    embedding: embedding(),
    contentHash: text("content_hash").notNull(),
    // Admin settings. Catalog sync never writes these, so they survive every sync and deploy.
    /** "catalog" rows mirror catalog.ts; "admin" rows were added from the admin screen and are never removed by a sync. */
    managedBy: text("managed_by").notNull().default("catalog"),
    /** Disabled products are never suggested. */
    enabled: boolean("enabled").notNull().default(true),
    /** Replaces `url` when set (for example NeuroCal's own tracking link). */
    urlOverride: text("url_override"),
    /** Replaces `affiliate` when set. */
    affiliateOverride: boolean("affiliate_override"),
    updatedAt: timestamps.updatedAt,
  },
  (t) => [index("products_embedding_hnsw").using("hnsw", t.embedding.op("vector_cosine_ops"))],
);
