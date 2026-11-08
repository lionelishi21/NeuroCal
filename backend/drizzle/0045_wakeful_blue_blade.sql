ALTER TABLE "subscriptions" ADD COLUMN "trial_started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint
UPDATE "subscriptions" SET "trial_started_at" = "created_at" WHERE "status" = 'trial';--> statement-breakpoint
UPDATE "subscriptions" SET "paid_at" = "created_at" WHERE "status" IN ('active', 'grace');
