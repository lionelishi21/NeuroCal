-- Products already in the catalog count as old, so the first product-news run announces none of them.
ALTER TABLE "products" ADD COLUMN "created_at" timestamp with time zone DEFAULT '2026-01-01T00:00:00Z' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ALTER COLUMN "created_at" SET DEFAULT now();
