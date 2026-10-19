CREATE TABLE "glucose_days" (
	"user_id" uuid NOT NULL,
	"date" text NOT NULL,
	"source" text NOT NULL,
	"mean_mgdl" real NOT NULL,
	"in_range_140_pct" real NOT NULL,
	"in_range_180_pct" real NOT NULL,
	"cv_pct" real NOT NULL,
	"readings" integer NOT NULL,
	CONSTRAINT "glucose_days_user_id_date_source_pk" PRIMARY KEY("user_id","date","source")
);
--> statement-breakpoint
ALTER TABLE "glucose_days" ADD CONSTRAINT "glucose_days_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;