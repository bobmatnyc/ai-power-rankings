CREATE TABLE "companies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"data" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "companies_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "migrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"error" text,
	"metadata" jsonb DEFAULT '{}',
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "migrations_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "news" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"article_id" text,
	"title" text NOT NULL,
	"summary" text,
	"category" text,
	"source" text,
	"source_url" text,
	"published_at" timestamp NOT NULL,
	"date" timestamp,
	"data" jsonb DEFAULT '{}' NOT NULL,
	"tool_mentions" jsonb DEFAULT '[]',
	"importance_score" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "news_slug_unique" UNIQUE("slug"),
	CONSTRAINT "news_article_id_unique" UNIQUE("article_id")
);
--> statement-breakpoint
CREATE TABLE "rankings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period" text NOT NULL,
	"algorithm_version" text DEFAULT 'v1.0' NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"published_at" timestamp,
	"data" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"company_id" text,
	"data" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tools_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "companies_slug_idx" ON "companies" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "companies_name_idx" ON "companies" USING btree ("name");--> statement-breakpoint
CREATE INDEX "companies_data_gin_idx" ON "companies" USING gin ("data");--> statement-breakpoint
CREATE UNIQUE INDEX "migrations_name_idx" ON "migrations" USING btree ("name");--> statement-breakpoint
CREATE INDEX "migrations_status_idx" ON "migrations" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "news_slug_idx" ON "news" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "news_article_id_idx" ON "news" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "news_published_idx" ON "news" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "news_category_idx" ON "news" USING btree ("category");--> statement-breakpoint
CREATE INDEX "news_source_idx" ON "news" USING btree ("source");--> statement-breakpoint
CREATE INDEX "news_importance_idx" ON "news" USING btree ("importance_score");--> statement-breakpoint
CREATE INDEX "news_data_gin_idx" ON "news" USING gin ("data");--> statement-breakpoint
CREATE INDEX "news_tool_mentions_gin_idx" ON "news" USING gin ("tool_mentions");--> statement-breakpoint
CREATE INDEX "news_title_search_idx" ON "news" USING gin (to_tsvector('english', "title"));--> statement-breakpoint
CREATE UNIQUE INDEX "rankings_period_idx" ON "rankings" USING btree ("period");--> statement-breakpoint
CREATE INDEX "rankings_current_idx" ON "rankings" USING btree ("is_current");--> statement-breakpoint
CREATE INDEX "rankings_published_idx" ON "rankings" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "rankings_data_gin_idx" ON "rankings" USING gin ("data");--> statement-breakpoint
CREATE UNIQUE INDEX "tools_slug_idx" ON "tools" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "tools_category_idx" ON "tools" USING btree ("category");--> statement-breakpoint
CREATE INDEX "tools_status_idx" ON "tools" USING btree ("status");--> statement-breakpoint
CREATE INDEX "tools_name_idx" ON "tools" USING btree ("name");--> statement-breakpoint
CREATE INDEX "tools_data_gin_idx" ON "tools" USING gin ("data");