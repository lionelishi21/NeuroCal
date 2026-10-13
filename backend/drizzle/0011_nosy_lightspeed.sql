CREATE TABLE "weight_entries" (
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"kg" numeric(5, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "weight_entries_user_id_date_pk" PRIMARY KEY("user_id","date"),
	CONSTRAINT "weight_entries_kg_range" CHECK ("weight_entries"."kg" between 25 and 350)
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "weight_goal" jsonb;--> statement-breakpoint
ALTER TABLE "weight_entries" ADD CONSTRAINT "weight_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;