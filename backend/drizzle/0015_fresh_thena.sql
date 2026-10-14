CREATE TABLE "stack_doses" (
	"item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	CONSTRAINT "stack_doses_item_id_date_pk" PRIMARY KEY("item_id","date")
);
--> statement-breakpoint
CREATE TABLE "stack_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"serving_size" text,
	"ingredients" jsonb NOT NULL,
	"servings_per_day" smallint NOT NULL,
	"timing" text NOT NULL,
	"servings_per_container" smallint,
	"started_on" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stack_items_servings_positive" CHECK ("stack_items"."servings_per_day" between 1 and 6)
);
--> statement-breakpoint
ALTER TABLE "stack_doses" ADD CONSTRAINT "stack_doses_item_id_stack_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."stack_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stack_doses" ADD CONSTRAINT "stack_doses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stack_items" ADD CONSTRAINT "stack_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stack_doses_user_date_idx" ON "stack_doses" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "stack_items_user_idx" ON "stack_items" USING btree ("user_id");