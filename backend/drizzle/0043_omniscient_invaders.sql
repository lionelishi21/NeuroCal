CREATE TABLE "why_explanations" (
	"user_id" uuid NOT NULL,
	"topic" text NOT NULL,
	"date" text NOT NULL,
	"hash" text NOT NULL,
	"text" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "why_explanations_user_id_topic_date_pk" PRIMARY KEY("user_id","topic","date")
);
--> statement-breakpoint
ALTER TABLE "why_explanations" ADD CONSTRAINT "why_explanations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;