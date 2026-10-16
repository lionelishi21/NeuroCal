CREATE TABLE "meal_plans" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"plan" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meal_plans" ADD CONSTRAINT "meal_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;