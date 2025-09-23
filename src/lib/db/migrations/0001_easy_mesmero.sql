CREATE TYPE "public"."article_status" AS ENUM('draft', 'active', 'archived', 'deleted');--> statement-breakpoint
CREATE TABLE "article_processing_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"action" varchar(50) NOT NULL,
	"status" varchar(20) NOT NULL,
	"started_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"duration_ms" integer,
	"tools_affected" integer DEFAULT 0,
	"companies_affected" integer DEFAULT 0,
	"rankings_changed" integer DEFAULT 0,
	"error_message" text,
	"debug_info" jsonb,
	"performed_by" varchar(255) DEFAULT 'system',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "article_rankings_changes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"article_id" uuid NOT NULL,
	"tool_id" varchar(50) NOT NULL,
	"tool_name" varchar(255) NOT NULL,
	"metric_changes" jsonb NOT NULL,
	"old_rank" integer,
	"new_rank" integer,
	"rank_change" integer,
	"old_score" numeric(10, 4),
	"new_score" numeric(10, 4),
	"score_change" numeric(10, 4),
	"change_type" varchar(20),
	"change_reason" text,
	"is_applied" boolean DEFAULT true,
	"applied_at" timestamp DEFAULT now(),
	"rolled_back" boolean DEFAULT false,
	"rolled_back_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" varchar(255) NOT NULL,
	"title" varchar(500) NOT NULL,
	"summary" text,
	"content" text NOT NULL,
	"ingestion_type" varchar(20) NOT NULL,
	"source_url" varchar(1000),
	"source_name" varchar(255),
	"file_name" varchar(255),
	"file_type" varchar(50),
	"tags" text[] DEFAULT '{}'::text[],
	"category" varchar(100),
	"importance_score" integer DEFAULT 5,
	"sentiment_score" numeric(3, 2),
	"tool_mentions" jsonb DEFAULT '[]',
	"company_mentions" jsonb DEFAULT '[]',
	"rankings_snapshot" jsonb,
	"author" varchar(255),
	"published_date" timestamp,
	"ingested_at" timestamp DEFAULT now(),
	"ingested_by" varchar(255) DEFAULT 'admin',
	"status" varchar(20) DEFAULT 'active',
	"is_processed" boolean DEFAULT false,
	"processed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "article_processing_logs" ADD CONSTRAINT "article_processing_logs_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "article_rankings_changes" ADD CONSTRAINT "article_rankings_changes_article_id_articles_id_fk" FOREIGN KEY ("article_id") REFERENCES "public"."articles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_article_processing_article_id" ON "article_processing_logs" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "idx_article_processing_action" ON "article_processing_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "idx_article_processing_status" ON "article_processing_logs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_article_processing_created" ON "article_processing_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_article_rankings_article_id" ON "article_rankings_changes" USING btree ("article_id");--> statement-breakpoint
CREATE INDEX "idx_article_rankings_tool_id" ON "article_rankings_changes" USING btree ("tool_id");--> statement-breakpoint
CREATE INDEX "idx_article_rankings_applied" ON "article_rankings_changes" USING btree ("is_applied");--> statement-breakpoint
CREATE INDEX "idx_article_rankings_change_type" ON "article_rankings_changes" USING btree ("change_type");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_articles_slug" ON "articles" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_articles_status" ON "articles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_articles_published_date" ON "articles" USING btree ("published_date");--> statement-breakpoint
CREATE INDEX "idx_articles_importance" ON "articles" USING btree ("importance_score");--> statement-breakpoint
CREATE INDEX "idx_articles_ingested_at" ON "articles" USING btree ("ingested_at");--> statement-breakpoint
CREATE INDEX "idx_articles_tags" ON "articles" USING gin ("tags");--> statement-breakpoint
CREATE INDEX "idx_articles_tool_mentions" ON "articles" USING gin ("tool_mentions");--> statement-breakpoint
CREATE INDEX "idx_articles_company_mentions" ON "articles" USING gin ("company_mentions");