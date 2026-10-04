CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"url" text,
	"affiliate" boolean DEFAULT false NOT NULL,
	"tags" text[] NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"content_hash" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "protocols" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"steps" text[] NOT NULL,
	"tags" text[] NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"content_hash" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "products_embedding_hnsw" ON "products" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "protocols_embedding_hnsw" ON "protocols" USING hnsw ("embedding" vector_cosine_ops);