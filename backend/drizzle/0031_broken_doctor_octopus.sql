CREATE TABLE "coffee_cups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"taken_at" timestamp with time zone NOT NULL,
	"kind" text NOT NULL,
	"add_ins" text[] NOT NULL
);
--> statement-breakpoint
ALTER TABLE "coffee_cups" ADD CONSTRAINT "coffee_cups_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coffee_cups_user_taken_at_idx" ON "coffee_cups" USING btree ("user_id","taken_at");