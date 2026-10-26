CREATE TABLE "shopping_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"quantity" text,
	"aisle" text NOT NULL,
	"checked" boolean DEFAULT false NOT NULL,
	"source" text NOT NULL,
	"added_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shopping_items_user_idx" ON "shopping_items" USING btree ("user_id");