/**
 * Drizzle schema for Aurora PostgreSQL (ARCHITECTURE §4).
 * Tables for planned features (telemetry, focus scores, protocols, products,
 * embeddings) are added when their use cases are built.
 */
import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  numeric,
  pgTable,
  real,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

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
    createdAt: timestamps.createdAt,
  },
  (t) => [index("recipe_recommendations_user_created_idx").on(t.userId, t.createdAt.desc())],
);
