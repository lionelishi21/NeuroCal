CREATE TABLE "stack_feelings" (
	"item_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"feeling" text NOT NULL,
	CONSTRAINT "stack_feelings_item_id_date_pk" PRIMARY KEY("item_id","date")
);
--> statement-breakpoint
ALTER TABLE "stack_items" ADD COLUMN "added_on" date DEFAULT current_date NOT NULL;--> statement-breakpoint
-- Items added before this column started their experiment when they were created, not today.
UPDATE "stack_items" SET "added_on" = "created_at"::date;--> statement-breakpoint
ALTER TABLE "stack_feelings" ADD CONSTRAINT "stack_feelings_item_id_stack_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."stack_items"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stack_feelings" ADD CONSTRAINT "stack_feelings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stack_feelings_user_idx" ON "stack_feelings" USING btree ("user_id");