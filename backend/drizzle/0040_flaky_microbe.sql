CREATE TABLE "guides" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"subtitle" text NOT NULL,
	"summary" text NOT NULL,
	"body" text NOT NULL,
	"brand" text NOT NULL,
	"status" text NOT NULL,
	"program" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "programs" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"guide_id" text NOT NULL,
	"started_on" date NOT NULL,
	"days" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"checks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "programs" ADD CONSTRAINT "programs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;