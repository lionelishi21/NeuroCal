CREATE TABLE "eating_out_items" (
	"id" text PRIMARY KEY NOT NULL,
	"food" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
