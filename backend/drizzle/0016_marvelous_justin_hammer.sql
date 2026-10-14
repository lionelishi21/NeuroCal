CREATE TABLE "brain_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"taken_at" timestamp with time zone NOT NULL,
	"score" smallint NOT NULL,
	"median_ms" smallint NOT NULL,
	"fastest_ms" smallint NOT NULL,
	"lapses" smallint NOT NULL,
	"false_starts" smallint NOT NULL,
	"trials" smallint NOT NULL,
	"reaction_times_ms" integer[] NOT NULL,
	CONSTRAINT "brain_checks_score_range" CHECK ("brain_checks"."score" between 0 and 100)
);
--> statement-breakpoint
ALTER TABLE "brain_checks" ADD CONSTRAINT "brain_checks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "brain_checks_user_taken_idx" ON "brain_checks" USING btree ("user_id","taken_at" DESC NULLS LAST);