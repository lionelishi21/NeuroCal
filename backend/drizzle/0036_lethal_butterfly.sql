CREATE TABLE "performance_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"activity" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"minutes" smallint NOT NULL,
	"sharpness" smallint NOT NULL,
	"result" real,
	"game" text,
	"wins" smallint,
	"losses" smallint,
	"rating_before" integer,
	"rating_after" integer,
	CONSTRAINT "performance_sessions_sharpness" CHECK ("performance_sessions"."sharpness" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "performance_sessions" ADD CONSTRAINT "performance_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "performance_sessions_user_started_at_idx" ON "performance_sessions" USING btree ("user_id","started_at");