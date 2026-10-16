CREATE TABLE "air_quality_days" (
	"latitude" real NOT NULL,
	"longitude" real NOT NULL,
	"date" date NOT NULL,
	"aqi" smallint,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "air_quality_days_latitude_longitude_date_pk" PRIMARY KEY("latitude","longitude","date")
);
--> statement-breakpoint
CREATE TABLE "environment_checks" (
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"daylight" boolean,
	"dark_bedroom" boolean,
	"quiet_bedroom" boolean,
	"filtered_water" boolean,
	CONSTRAINT "environment_checks_user_id_date_pk" PRIMARY KEY("user_id","date")
);
--> statement-breakpoint
CREATE TABLE "environment_locations" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"place" text NOT NULL,
	"latitude" real NOT NULL,
	"longitude" real NOT NULL
);
--> statement-breakpoint
ALTER TABLE "focus_scores" ADD COLUMN "environment_component" real;--> statement-breakpoint
ALTER TABLE "environment_checks" ADD CONSTRAINT "environment_checks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "environment_locations" ADD CONSTRAINT "environment_locations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;