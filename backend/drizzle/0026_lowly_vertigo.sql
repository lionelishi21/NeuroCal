CREATE TABLE "health_markers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"marker" text NOT NULL,
	"value" real NOT NULL,
	"measured_at" timestamp with time zone NOT NULL,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "health_markers_user_marker_time_source_unique" UNIQUE("user_id","marker","measured_at","source")
);
--> statement-breakpoint
ALTER TABLE "health_markers" ADD CONSTRAINT "health_markers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "health_markers_user_time_idx" ON "health_markers" USING btree ("user_id","measured_at");