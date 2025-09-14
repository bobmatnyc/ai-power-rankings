-- Article Management System Migration
-- This migration adds comprehensive article management with rankings tracking

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ARTICLES TABLE
-- =============================================================================
-- Main table for storing ingested articles
CREATE TABLE IF NOT EXISTS articles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(255) UNIQUE NOT NULL,
    title VARCHAR(500) NOT NULL,
    summary TEXT,
    content TEXT NOT NULL,

    -- Ingestion metadata
    ingestion_type VARCHAR(20) NOT NULL CHECK (ingestion_type IN ('url', 'text', 'file')),
    source_url VARCHAR(1000),
    source_name VARCHAR(255),
    file_name VARCHAR(255),
    file_type VARCHAR(50),

    -- Content analysis
    tags TEXT[] DEFAULT '{}',
    category VARCHAR(100),
    importance_score INTEGER DEFAULT 5 CHECK (importance_score >= 0 AND importance_score <= 10),
    sentiment_score DECIMAL(3,2) CHECK (sentiment_score >= -1 AND sentiment_score <= 1),

    -- Tool and company mentions
    tool_mentions JSONB DEFAULT '[]', -- Array of {tool_id, tool_name, context, sentiment}
    company_mentions JSONB DEFAULT '[]', -- Array of {company_id, company_name, context}

    -- Rankings snapshot (state before article was ingested)
    rankings_snapshot JSONB, -- Complete snapshot of rankings before changes

    -- Metadata
    author VARCHAR(255),
    published_date TIMESTAMP,
    ingested_at TIMESTAMP DEFAULT NOW(),
    ingested_by VARCHAR(255) DEFAULT 'admin',

    -- Status tracking
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('draft', 'active', 'archived', 'deleted')),
    is_processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP,

    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_articles_slug ON articles(slug);
CREATE INDEX idx_articles_status ON articles(status);
CREATE INDEX idx_articles_published_date ON articles(published_date DESC);
CREATE INDEX idx_articles_importance ON articles(importance_score DESC);
CREATE INDEX idx_articles_ingested_at ON articles(ingested_at DESC);
CREATE INDEX idx_articles_tags ON articles USING GIN(tags);
CREATE INDEX idx_articles_tool_mentions ON articles USING GIN(tool_mentions);
CREATE INDEX idx_articles_company_mentions ON articles USING GIN(company_mentions);

-- =============================================================================
-- ARTICLE RANKINGS CHANGES TABLE
-- =============================================================================
-- Tracks specific ranking changes caused by each article
CREATE TABLE IF NOT EXISTS article_rankings_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    tool_id VARCHAR(50) NOT NULL,
    tool_name VARCHAR(255) NOT NULL,

    -- Ranking changes
    metric_changes JSONB NOT NULL, -- {metric_name: {old_value, new_value, change_amount}}
    old_rank INTEGER,
    new_rank INTEGER,
    rank_change INTEGER, -- Positive = improved, Negative = declined

    -- Score changes
    old_score DECIMAL(10,4),
    new_score DECIMAL(10,4),
    score_change DECIMAL(10,4),

    -- Change metadata
    change_type VARCHAR(20) CHECK (change_type IN ('increase', 'decrease', 'new_entry', 'no_change')),
    change_reason TEXT,

    -- Rollback support
    is_applied BOOLEAN DEFAULT TRUE,
    applied_at TIMESTAMP DEFAULT NOW(),
    rolled_back BOOLEAN DEFAULT FALSE,
    rolled_back_at TIMESTAMP,

    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for ranking changes
CREATE INDEX idx_article_rankings_article_id ON article_rankings_changes(article_id);
CREATE INDEX idx_article_rankings_tool_id ON article_rankings_changes(tool_id);
CREATE INDEX idx_article_rankings_applied ON article_rankings_changes(is_applied);
CREATE INDEX idx_article_rankings_change_type ON article_rankings_changes(change_type);

-- =============================================================================
-- UPDATE TOOLS TABLE
-- =============================================================================
-- Add column to track which article created the tool
ALTER TABLE tools
ADD COLUMN IF NOT EXISTS created_by_article_id UUID REFERENCES articles(id),
ADD COLUMN IF NOT EXISTS auto_created BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS first_mentioned_date TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_tools_created_by_article ON tools(created_by_article_id);

-- =============================================================================
-- UPDATE COMPANIES TABLE
-- =============================================================================
-- Add column to track which article created the company
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS created_by_article_id UUID REFERENCES articles(id),
ADD COLUMN IF NOT EXISTS auto_created BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS first_mentioned_date TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_companies_created_by_article ON companies(created_by_article_id);

-- =============================================================================
-- ARTICLE PROCESSING LOGS TABLE
-- =============================================================================
-- Logs for tracking article processing history
CREATE TABLE IF NOT EXISTS article_processing_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,

    -- Processing details
    action VARCHAR(50) NOT NULL CHECK (action IN (
        'dry_run', 'ingest', 'update', 'recalculate', 'delete', 'rollback'
    )),
    status VARCHAR(20) NOT NULL CHECK (status IN ('started', 'completed', 'failed')),

    -- Processing metadata
    started_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    duration_ms INTEGER,

    -- Results
    tools_affected INTEGER DEFAULT 0,
    companies_affected INTEGER DEFAULT 0,
    rankings_changed INTEGER DEFAULT 0,

    -- Debug information
    error_message TEXT,
    debug_info JSONB,

    -- User tracking
    performed_by VARCHAR(255) DEFAULT 'system',

    created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for processing logs
CREATE INDEX idx_article_processing_article_id ON article_processing_logs(article_id);
CREATE INDEX idx_article_processing_action ON article_processing_logs(action);
CREATE INDEX idx_article_processing_status ON article_processing_logs(status);
CREATE INDEX idx_article_processing_created ON article_processing_logs(created_at DESC);

-- =============================================================================
-- FUNCTIONS
-- =============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON articles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to rollback rankings changes for an article
CREATE OR REPLACE FUNCTION rollback_article_rankings(p_article_id UUID)
RETURNS TABLE(
    affected_tools INTEGER,
    rollback_status TEXT
) AS $$
DECLARE
    v_affected_tools INTEGER := 0;
BEGIN
    -- Mark all changes as rolled back
    UPDATE article_rankings_changes
    SET
        is_applied = FALSE,
        rolled_back = TRUE,
        rolled_back_at = NOW()
    WHERE
        article_id = p_article_id
        AND is_applied = TRUE
        AND rolled_back = FALSE;

    GET DIAGNOSTICS v_affected_tools = ROW_COUNT;

    RETURN QUERY
    SELECT
        v_affected_tools,
        'Rankings rolled back successfully'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- Function to get article impact summary
CREATE OR REPLACE FUNCTION get_article_impact(p_article_id UUID)
RETURNS TABLE(
    total_tools_affected INTEGER,
    total_companies_mentioned INTEGER,
    avg_rank_change DECIMAL,
    avg_score_change DECIMAL,
    tools_improved INTEGER,
    tools_declined INTEGER,
    new_tools_added INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        COUNT(DISTINCT tool_id)::INTEGER as total_tools_affected,
        (SELECT COUNT(*)::INTEGER FROM jsonb_array_elements(
            (SELECT company_mentions FROM articles WHERE id = p_article_id)
        )) as total_companies_mentioned,
        AVG(rank_change)::DECIMAL as avg_rank_change,
        AVG(score_change)::DECIMAL as avg_score_change,
        COUNT(CASE WHEN change_type = 'increase' THEN 1 END)::INTEGER as tools_improved,
        COUNT(CASE WHEN change_type = 'decrease' THEN 1 END)::INTEGER as tools_declined,
        COUNT(CASE WHEN change_type = 'new_entry' THEN 1 END)::INTEGER as new_tools_added
    FROM article_rankings_changes
    WHERE article_id = p_article_id AND is_applied = TRUE;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- VIEWS
-- =============================================================================

-- View for article statistics
CREATE OR REPLACE VIEW article_statistics AS
SELECT
    a.id,
    a.title,
    a.published_date,
    a.importance_score,
    COUNT(DISTINCT arc.tool_id) as tools_affected,
    AVG(arc.score_change) as avg_score_change,
    SUM(CASE WHEN arc.change_type = 'increase' THEN 1 ELSE 0 END) as tools_improved,
    SUM(CASE WHEN arc.change_type = 'decrease' THEN 1 ELSE 0 END) as tools_declined
FROM articles a
LEFT JOIN article_rankings_changes arc ON a.id = arc.article_id
WHERE a.status = 'active'
GROUP BY a.id, a.title, a.published_date, a.importance_score;

-- View for tool ranking history by article
CREATE OR REPLACE VIEW tool_ranking_history AS
SELECT
    arc.tool_id,
    arc.tool_name,
    a.title as article_title,
    a.published_date as article_date,
    arc.old_rank,
    arc.new_rank,
    arc.rank_change,
    arc.score_change,
    arc.change_type,
    arc.applied_at
FROM article_rankings_changes arc
JOIN articles a ON arc.article_id = a.id
WHERE arc.is_applied = TRUE
ORDER BY arc.applied_at DESC;

-- =============================================================================
-- MIGRATION COMPLETION
-- =============================================================================

-- Add migration record
INSERT INTO migrations (name, status, completed_at, metadata)
VALUES (
    'add-article-management-tables',
    'completed',
    NOW(),
    jsonb_build_object(
        'tables_created', ARRAY['articles', 'article_rankings_changes', 'article_processing_logs'],
        'columns_added', jsonb_build_object(
            'tools', ARRAY['created_by_article_id', 'auto_created', 'first_mentioned_date'],
            'companies', ARRAY['created_by_article_id', 'auto_created', 'first_mentioned_date']
        ),
        'functions_created', ARRAY['rollback_article_rankings', 'get_article_impact'],
        'views_created', ARRAY['article_statistics', 'tool_ranking_history']
    )
) ON CONFLICT (name) DO UPDATE
SET
    status = 'completed',
    completed_at = NOW(),
    metadata = EXCLUDED.metadata;