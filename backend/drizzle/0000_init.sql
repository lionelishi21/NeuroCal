CREATE TABLE "check_ins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"flags" text[] NOT NULL,
	"note" varchar(280),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "check_ins_has_flags" CHECK (cardinality("check_ins"."flags") > 0)
);
--> statement-breakpoint
CREATE TABLE "meal_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meal_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"name" text NOT NULL,
	"portion" text NOT NULL,
	"calories" numeric(7, 1) NOT NULL,
	"protein_g" numeric(6, 1) NOT NULL,
	"carbs_g" numeric(6, 1) NOT NULL,
	"fat_g" numeric(6, 1) NOT NULL,
	"confidence" real,
	"glycemic_load" text,
	CONSTRAINT "meal_items_meal_position_unique" UNIQUE("meal_id","position"),
	CONSTRAINT "meal_items_amounts_non_negative" CHECK ("meal_items"."calories" >= 0 and "meal_items"."protein_g" >= 0 and "meal_items"."carbs_g" >= 0 and "meal_items"."fat_g" >= 0),
	CONSTRAINT "meal_items_confidence_range" CHECK ("meal_items"."confidence" is null or ("meal_items"."confidence" between 0 and 1))
);
--> statement-breakpoint
CREATE TABLE "meals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"eaten_at" timestamp with time zone NOT NULL,
	"photo_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"time_zone" text DEFAULT 'UTC' NOT NULL,
	"dietary_preference" text NOT NULL,
	"cognitive_goals" text[] DEFAULT '{}'::text[] NOT NULL,
	"daily_calorie_target" integer NOT NULL,
	"protein_target_g" numeric(6, 1) NOT NULL,
	"carbs_target_g" numeric(6, 1) NOT NULL,
	"fat_target_g" numeric(6, 1) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_calorie_target_positive" CHECK ("profiles"."daily_calorie_target" > 0),
	CONSTRAINT "profiles_macro_targets_non_negative" CHECK ("profiles"."protein_target_g" >= 0 and "profiles"."carbs_target_g" >= 0 and "profiles"."fat_target_g" >= 0)
);
--> statement-breakpoint
CREATE TABLE "recipe_recommendations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"search_query" text NOT NULL,
	"title" text NOT NULL,
	"source_name" text NOT NULL,
	"source_url" text NOT NULL,
	"image_url" text,
	"minutes" integer NOT NULL,
	"calories" numeric(7, 1) NOT NULL,
	"protein_g" numeric(6, 1) NOT NULL,
	"carbs_g" numeric(6, 1) NOT NULL,
	"fat_g" numeric(6, 1) NOT NULL,
	"reasoning" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cognito_sub" text NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "users_cognito_sub_unique" UNIQUE("cognito_sub"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "check_ins" ADD CONSTRAINT "check_ins_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_items" ADD CONSTRAINT "meal_items_meal_id_meals_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_recommendations" ADD CONSTRAINT "recipe_recommendations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "check_ins_user_at_idx" ON "check_ins" USING btree ("user_id","at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "meals_user_eaten_at_idx" ON "meals" USING btree ("user_id","eaten_at" DESC NULLS LAST) WHERE "meals"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "recipe_recommendations_user_created_idx" ON "recipe_recommendations" USING btree ("user_id","created_at" DESC NULLS LAST);