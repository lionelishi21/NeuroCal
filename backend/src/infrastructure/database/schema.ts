/**
 * Drizzle schema for Aurora PostgreSQL + pgvector (ARCHITECTURE §4).
 * Migration 0002 enables the `vector` extension before the catalog tables use it.
 */
import { sql } from "drizzle-orm";
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
    ...timestamps,
    deletedAt,
  },
  (t) => [index("meals_user_eaten_at_idx").on(t.userId, t.eatenAt.desc()).where(sql`${t.deletedAt} is null`)],
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
