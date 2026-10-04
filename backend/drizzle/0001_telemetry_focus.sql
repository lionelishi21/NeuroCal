CREATE TABLE "focus_scores" (
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"score" smallint,
	"sleep_component" real,
	"timing_component" real,
	"glycemic_component" real,
	"stress_component" real,
	"explanation" text NOT NULL,
	"model_version" text NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "focus_scores_user_id_date_pk" PRIMARY KEY("user_id","date"),
	CONSTRAINT "focus_scores_score_range" CHECK ("focus_scores"."score" is null or "focus_scores"."score" between 0 and 100)
);
--> statement-breakpoint
CREATE TABLE "screen_time_samples" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" text NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"minutes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "screen_time_user_source_window_unique" UNIQUE("user_id","source","window_start"),
	CONSTRAINT "screen_time_minutes_fit_window" CHECK ("screen_time_samples"."minutes" >= 0 and "screen_time_samples"."window_end" > "screen_time_samples"."window_start")
);
--> statement-breakpoint
CREATE TABLE "sleep_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source" text NOT NULL,
	"start_at" timestamp with time zone NOT NULL,
	"end_at" timestamp with time zone NOT NULL,
	"deep_minutes" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sleep_sessions_user_source_start_unique" UNIQUE("user_id","source","start_at"),
	CONSTRAINT "sleep_sessions_end_after_start" CHECK ("sleep_sessions"."end_at" > "sleep_sessions"."start_at")
);
--> statement-breakpoint
ALTER TABLE "focus_scores" ADD CONSTRAINT "focus_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "screen_time_samples" ADD CONSTRAINT "screen_time_samples_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sleep_sessions" ADD CONSTRAINT "sleep_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sleep_sessions_user_end_idx" ON "sleep_sessions" USING btree ("user_id","end_at" DESC NULLS LAST);