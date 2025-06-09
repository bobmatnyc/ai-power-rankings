-- =============================================================================
-- MIGRATION: Add JSON info column to tools table (FIXED)
-- Date: 2025-06-09
-- Purpose: Consolidate tool metadata into flexible JSON structure
-- =============================================================================

-- Add info column to tools table
ALTER TABLE tools 
ADD COLUMN IF NOT EXISTS info JSONB DEFAULT '{}';

-- Create indexes for JSON queries
CREATE INDEX IF NOT EXISTS idx_tools_info ON tools USING GIN (info);
CREATE INDEX IF NOT EXISTS idx_tools_info_company ON tools ((info->'company'->>'name'));
CREATE INDEX IF NOT EXISTS idx_tools_info_tags ON tools USING GIN ((info->'tags'));

-- Migrate existing data to JSON structure
-- First, let's join with companies table to get company names
UPDATE tools t
SET info = jsonb_build_object(
    'company', jsonb_build_object(
        'name', COALESCE(c.name, ''),
        'website', c.website_url,
        'founded_date', CAST(t.founded_date AS TEXT),
        'headquarters', c.headquarters
    ),
    'product', jsonb_build_object(
        'tagline', t.tagline,
        'description', t.description,
        'pricing_model', t.pricing_model,
        'license_type', t.license_type,
        'deployment_options', ARRAY[]::text[],
        'integrations', ARRAY[]::text[]
    ),
    'links', jsonb_build_object(
        'website', t.website_url,
        'github', t.github_repo,
        'documentation', NULL,
        'pricing', NULL,
        'blog', NULL
    ),
    'tags', ARRAY[]::text[],
    'features', jsonb_build_object(
        'key_features', ARRAY[]::text[],
        'languages_supported', ARRAY[]::text[],
        'ide_support', ARRAY[]::text[],
        'llm_providers', ARRAY[]::text[]
    ),
    'metadata', jsonb_build_object(
        'first_tracked_date', CAST(t.first_tracked_date AS TEXT),
        'logo_url', t.logo_url,
        'last_major_update', NULL,
        'acquisition_date', NULL,
        'discontinued_date', NULL
    )
)
FROM companies c
WHERE t.company_id = c.id
AND (t.info = '{}' OR t.info IS NULL);

-- Update tools without company_id
UPDATE tools 
SET info = jsonb_build_object(
    'company', jsonb_build_object(
        'name', '',
        'website', NULL,
        'founded_date', CAST(founded_date AS TEXT),
        'headquarters', NULL
    ),
    'product', jsonb_build_object(
        'tagline', tagline,
        'description', description,
        'pricing_model', pricing_model,
        'license_type', license_type,
        'deployment_options', ARRAY[]::text[],
        'integrations', ARRAY[]::text[]
    ),
    'links', jsonb_build_object(
        'website', website_url,
        'github', github_repo,
        'documentation', NULL,
        'pricing', NULL,
        'blog', NULL
    ),
    'tags', ARRAY[]::text[],
    'features', jsonb_build_object(
        'key_features', ARRAY[]::text[],
        'languages_supported', ARRAY[]::text[],
        'ide_support', ARRAY[]::text[],
        'llm_providers', ARRAY[]::text[]
    ),
    'metadata', jsonb_build_object(
        'first_tracked_date', CAST(first_tracked_date AS TEXT),
        'logo_url', logo_url,
        'last_major_update', NULL,
        'acquisition_date', NULL,
        'discontinued_date', NULL
    )
)
WHERE company_id IS NULL
AND (info = '{}' OR info IS NULL);

-- Add validation constraint
ALTER TABLE tools 
ADD CONSTRAINT valid_tool_info CHECK (
    jsonb_typeof(info) = 'object' AND
    info ? 'company' AND 
    info ? 'product' AND
    info ? 'links'
);

-- Create function to get tool with full info
CREATE OR REPLACE FUNCTION get_tool_with_info(p_tool_id VARCHAR(50))
RETURNS TABLE (
    id VARCHAR(50),
    name VARCHAR(100),
    slug VARCHAR(100),
    category VARCHAR(50),
    subcategory VARCHAR(50),
    status VARCHAR(20),
    info JSONB,
    created_at TIMESTAMP,
    updated_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.name,
        t.slug,
        t.category,
        t.subcategory,
        t.status,
        t.info,
        t.created_at,
        t.updated_at
    FROM tools t
    WHERE t.id = p_tool_id;
END;
$$ LANGUAGE plpgsql;

-- Create view for tools with expanded info
CREATE OR REPLACE VIEW tools_expanded AS
SELECT 
    t.id,
    t.name,
    t.slug,
    t.category,
    t.subcategory,
    t.status,
    t.info->'company'->>'name' as company_name,
    t.info->'links'->>'website' as website_url,
    t.info->'links'->>'github' as github_repo,
    t.info->'product'->>'pricing_model' as pricing_model,
    t.info->'product'->>'license_type' as license_type,
    t.info->'tags' as tags,
    t.info->'features'->'llm_providers' as llm_providers,
    t.created_at,
    t.updated_at
FROM tools t;

-- Function to update tool info
CREATE OR REPLACE FUNCTION update_tool_info(
    p_tool_id VARCHAR(50),
    p_info_path TEXT[],
    p_value JSONB
)
RETURNS VOID AS $$
BEGIN
    UPDATE tools
    SET info = jsonb_set(info, p_info_path, p_value, true),
        updated_at = NOW()
    WHERE id = p_tool_id;
END;
$$ LANGUAGE plpgsql;

-- Example usage:
COMMENT ON FUNCTION update_tool_info IS 'Update specific path in tool info. Example: update_tool_info(''cursor'', ''{company,headquarters}'', ''"San Francisco"'')';

-- Add comments
COMMENT ON COLUMN tools.info IS 'Flexible JSON storage for all tool metadata including company info, features, links, tags, etc.';

-- =============================================================================
-- METRICS HISTORY VIEW FOR TOOLS (Only if metrics_sources exists)
-- =============================================================================

-- Check if metrics_sources table exists before creating functions
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'metrics_sources') THEN
        -- Create function to get scoring-relevant metrics history
        CREATE OR REPLACE FUNCTION get_tool_metrics_for_scoring(
            p_tool_id VARCHAR(50),
            p_limit INTEGER DEFAULT 20
        )
        RETURNS TABLE (
            metric_date DATE,
            source_name VARCHAR(100),
            source_url VARCHAR(500),
            metrics JSONB,
            scoring_metrics JSONB,
            published_date DATE
        ) AS $func$
        BEGIN
            RETURN QUERY
            WITH scoring_metrics AS (
                -- Define which metrics affect scoring
                SELECT unnest(ARRAY[
                    'swe_bench_score',
                    'github_stars',
                    'estimated_users',
                    'monthly_arr',
                    'growth_rate',
                    'funding_total',
                    'release_frequency',
                    'github_contributors',
                    'community_size',
                    'enterprise_customers',
                    'business_sentiment',
                    'innovation_score',
                    'agentic_capability'
                ]) as metric_key
            ),
            filtered_metrics AS (
                SELECT 
                    tm.published_date as metric_date,
                    tm.source_name,
                    tm.source_url,
                    tm.metrics,
                    tm.published_date,
                    -- Extract only scoring-relevant metrics
                    (SELECT jsonb_object_agg(key, value)
                     FROM jsonb_each(tm.metrics) 
                     WHERE key IN (SELECT metric_key FROM scoring_metrics)
                    ) as scoring_metrics
                FROM tool_metrics tm
                WHERE tm.tool_id = p_tool_id
                AND tm.metrics IS NOT NULL
            )
            SELECT *
            FROM filtered_metrics
            WHERE scoring_metrics IS NOT NULL 
            AND scoring_metrics != '{}'::jsonb
            ORDER BY metric_date DESC
            LIMIT p_limit;
        END;
        $func$ LANGUAGE plpgsql;

        -- Create materialized view for latest scoring metrics per tool
        CREATE MATERIALIZED VIEW IF NOT EXISTS latest_scoring_metrics AS
        WITH latest_metrics AS (
            SELECT DISTINCT ON (tool_id, metric_key)
                tool_id,
                (jsonb_each_text(metrics)).key as metric_key,
                (jsonb_each_text(metrics)).value::numeric as metric_value,
                published_date,
                source_name
            FROM tool_metrics
            WHERE metrics IS NOT NULL
            ORDER BY tool_id, metric_key, published_date DESC
        ),
        scoring_relevant AS (
            SELECT * FROM latest_metrics
            WHERE metric_key IN (
                'swe_bench_score', 'github_stars', 'estimated_users',
                'monthly_arr', 'growth_rate', 'funding_total',
                'release_frequency', 'github_contributors', 'community_size',
                'enterprise_customers', 'business_sentiment', 'innovation_score',
                'agentic_capability'
            )
        )
        SELECT 
            tool_id,
            jsonb_object_agg(metric_key, jsonb_build_object(
                'value', metric_value,
                'date', published_date,
                'source', source_name
            )) as metrics
        FROM scoring_relevant
        GROUP BY tool_id;

        -- Create index
        CREATE INDEX IF NOT EXISTS idx_latest_scoring_metrics_tool ON latest_scoring_metrics(tool_id);

        -- Refresh trigger
        CREATE OR REPLACE FUNCTION refresh_latest_scoring_metrics()
        RETURNS TRIGGER AS $trigger$
        BEGIN
            REFRESH MATERIALIZED VIEW CONCURRENTLY latest_scoring_metrics;
            RETURN NULL;
        END;
        $trigger$ LANGUAGE plpgsql;

        -- Only create trigger if it doesn't exist
        IF NOT EXISTS (
            SELECT 1 FROM pg_trigger 
            WHERE tgname = 'trigger_refresh_latest_scoring_metrics'
        ) THEN
            CREATE TRIGGER trigger_refresh_latest_scoring_metrics
                AFTER INSERT OR UPDATE OR DELETE ON metrics_sources
                FOR EACH STATEMENT
                EXECUTE FUNCTION refresh_latest_scoring_metrics();
        END IF;

        -- Initial refresh
        REFRESH MATERIALIZED VIEW latest_scoring_metrics;
    END IF;
END
$$;

-- =============================================================================
-- EXAMPLE: Updating tool info
-- =============================================================================
/*
-- Update company headquarters
SELECT update_tool_info('cursor', '{company,headquarters}', '"San Francisco, CA"');

-- Add tags
SELECT update_tool_info('cursor', '{tags}', '["ai-native", "ide", "code-completion", "multi-file-editing"]');

-- Add key features
SELECT update_tool_info('cursor', '{features,key_features}', 
    '["AI pair programming", "Multi-file editing", "Natural language to code", "Codebase understanding"]'
);

-- Add LLM providers
SELECT update_tool_info('cursor', '{features,llm_providers}', 
    '["openai", "anthropic", "google", "custom"]'
);
*/