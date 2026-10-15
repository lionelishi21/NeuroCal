CREATE TABLE "knowledge_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"channel" text,
	"published_at" timestamp with time zone,
	"status" text DEFAULT 'queued' NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "knowledge_sources_url_unique" UNIQUE("url")
);
--> statement-breakpoint
CREATE TABLE "knowledge_techniques" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_id" uuid NOT NULL,
	"title" text NOT NULL,
	"pillar" text NOT NULL,
	"summary" text NOT NULL,
	"steps" text[] NOT NULL,
	"evidence" text NOT NULL,
	"cautions" text NOT NULL,
	"quote" text NOT NULL,
	"timestamp_seconds" integer,
	"status" text DEFAULT 'pending' NOT NULL,
	"protocol_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "protocols" ADD COLUMN "managed_by" text DEFAULT 'catalog' NOT NULL;--> statement-breakpoint
ALTER TABLE "protocols" ADD COLUMN "source_title" text;--> statement-breakpoint
ALTER TABLE "protocols" ADD COLUMN "source_url" text;--> statement-breakpoint
ALTER TABLE "knowledge_techniques" ADD CONSTRAINT "knowledge_techniques_source_id_knowledge_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."knowledge_sources"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "knowledge_techniques_source_idx" ON "knowledge_techniques" USING btree ("source_id");