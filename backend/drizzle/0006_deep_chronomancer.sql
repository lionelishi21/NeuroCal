ALTER TABLE "products" ADD COLUMN "managed_by" text DEFAULT 'catalog' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "url_override" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "affiliate_override" boolean;