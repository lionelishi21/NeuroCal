CREATE TABLE "device_candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tag" text NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"maker" text NOT NULL,
	"url" text NOT NULL,
	"description" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"product_id" text,
	"found_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	CONSTRAINT "device_candidates_name_key_unique" UNIQUE("name_key")
);
