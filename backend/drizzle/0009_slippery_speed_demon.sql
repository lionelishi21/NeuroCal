ALTER TABLE "meals" ADD COLUMN "client_key" text;--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_user_client_key_unique" UNIQUE("user_id","client_key");