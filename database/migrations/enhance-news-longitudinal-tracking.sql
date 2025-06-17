-- Migration: Enhance news system for longitudinal tracking and historical rankings
-- This migration ensures all news data is available for generating rankings at any point in time

-- =============================================================================
-- STEP 1: Enhance news_updates table structure
-- =============================================================================

-- Add missing columns to news_updates if they don't exist
ALTER TABLE news_updates 
ADD COLUMN IF NOT EXISTS source_author VARCHAR(255),
ADD COLUMN IF NOT EXISTS discovered_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS published_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS type VARCHAR(50),
ADD COLUMN IF NOT EXISTS content TEXT,
ADD COLUMN IF NOT EXISTS metrics_mentioned JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS impact_assessment JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS verification_status VARCHAR(50) DEFAULT 'unverified',
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS effective_impact DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS decay_factor DECIMAL(5,4),
ADD COLUMN IF NOT EXISTS last_impact_calculated TIMESTAMP WITH TIME ZONE;

-- Rename published_at to published_date if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_name = 'news_updates' AND column_name = 'published_at') THEN
        ALTER TABLE news_updates RENAME COLUMN published_at TO published_date;
    END IF;
END $$;

-- Add proper indexes for temporal queries
CREATE INDEX IF NOT EXISTS idx_news_updates_published_date 
    ON news_updates(published_date);
CREATE INDEX IF NOT EXISTS idx_news_updates_discovered_date 
    ON news_updates(discovered_date);
CREATE INDEX IF NOT EXISTS idx_news_updates_type 
    ON news_updates(type);
CREATE INDEX IF NOT EXISTS idx_news_updates_source 
    ON news_updates(source);
CREATE INDEX IF NOT EXISTS idx_news_updates_related_tools 
    ON news_updates USING gin(related_tools);
CREATE INDEX IF NOT EXISTS idx_news_updates_tags 
    ON news_updates USING gin(tags);
CREATE INDEX IF NOT EXISTS idx_news_updates_url 
    ON news_updates(url);

-- Composite index for efficient temporal + tool queries
CREATE INDEX IF NOT EXISTS idx_news_updates_tool_date 
    ON news_updates(published_date, related_tools);

-- =============================================================================
-- STEP 2: Create news impact history table
-- =============================================================================

-- Table to store calculated news impacts at different points in time
CREATE TABLE IF NOT EXISTS news_impact_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    news_id UUID NOT NULL REFERENCES news_updates(id) ON DELETE CASCADE,
    tool_id VARCHAR(50) NOT NULL,
    calculated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    base_impact DECIMAL(5,2) NOT NULL,
    age_factor DECIMAL(5,4) NOT NULL,
    pr_discount DECIMAL(5,4) DEFAULT 1.0,
    credibility_factor DECIMAL(5,4) DEFAULT 1.0,
    effective_impact DECIMAL(5,2) NOT NULL,
    sentiment_modifier DECIMAL(5,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_news_impact_history_news_id ON news_impact_history(news_id);
CREATE INDEX idx_news_impact_history_tool_id ON news_impact_history(tool_id);
CREATE INDEX idx_news_impact_history_calculated_at ON news_impact_history(calculated_at);
CREATE INDEX idx_news_impact_history_tool_date ON news_impact_history(tool_id, calculated_at);

-- =============================================================================
-- STEP 3: Create enhanced news impact calculation function
-- =============================================================================

-- Function to calculate news impact at any point in time
CREATE OR REPLACE FUNCTION calculate_news_impact_at_date(
    p_news_id UUID,
    p_tool_id VARCHAR(50),
    p_reference_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) RETURNS TABLE (
    base_impact DECIMAL,
    age_factor DECIMAL,
    pr_discount DECIMAL,
    credibility_factor DECIMAL,
    sentiment_modifier DECIMAL,
    effective_impact DECIMAL
) AS $$
DECLARE
    v_news RECORD;
    v_base_impact DECIMAL;
    v_age_factor DECIMAL;
    v_pr_discount DECIMAL := 1.0;
    v_credibility_factor DECIMAL := 1.0;
    v_sentiment_modifier DECIMAL := 0;
    v_effective_impact DECIMAL;
    v_days_old INTEGER;
    v_tool_mention JSONB;
BEGIN
    -- Get news article details
    SELECT * INTO v_news FROM news_updates WHERE id = p_news_id;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Calculate age in days
    v_days_old := GREATEST(0, EXTRACT(DAY FROM p_reference_date - v_news.published_date));
    
    -- Calculate age factor using asymptotic decay (50% at 365 days)
    v_age_factor := 1.0 / (1.0 + POWER(v_days_old / 365.0, 1.5));
    
    -- Calculate base impact based on type and importance
    v_base_impact := CASE 
        WHEN v_news.type = 'funding' THEN 8
        WHEN v_news.type = 'acquisition' THEN 9
        WHEN v_news.type = 'product_launch' THEN 7
        WHEN v_news.type = 'feature_update' THEN 5
        WHEN v_news.type = 'benchmark_result' THEN 8
        WHEN v_news.type = 'pricing_change' THEN 6
        WHEN v_news.type = 'partnership' THEN 4
        WHEN v_news.type = 'technical_milestone' THEN 7
        WHEN v_news.type = 'security_incident' THEN -5
        WHEN v_news.type IN ('company_announcement', 'company_news') THEN 3
        ELSE 3
    END;
    
    -- Add importance assessment
    v_base_impact := v_base_impact + CASE
        WHEN v_news.impact_assessment->>'importance' = 'critical' THEN 5
        WHEN v_news.impact_assessment->>'importance' = 'high' THEN 3
        WHEN v_news.impact_assessment->>'importance' = 'medium' THEN 1
        ELSE 0
    END;
    
    -- Normalize to 0-10 scale
    v_base_impact := LEAST(10, GREATEST(0, v_base_impact / 1.5));
    
    -- Apply PR discount
    IF v_news.metadata->>'is_company_announcement' = 'true' OR
       v_news.type IN ('company_announcement', 'company_news') OR
       LOWER(v_news.source) LIKE '%blog%' OR
       LOWER(v_news.source) LIKE '%press release%' THEN
        v_pr_discount := 0.7; -- 30% discount
    END IF;
    
    -- Get credibility factor from metadata or use defaults
    IF v_news.metadata->>'source_credibility' IS NOT NULL THEN
        v_credibility_factor := (v_news.metadata->>'source_credibility')::DECIMAL;
    ELSE
        -- Default credibility based on source
        v_credibility_factor := CASE
            WHEN v_news.source IN ('TechCrunch', 'The Verge', 'Ars Technica', 'MIT Technology Review') THEN 1.0
            WHEN v_news.source IN ('Bloomberg', 'Reuters', 'The Information') THEN 0.95
            WHEN v_news.source IN ('VentureBeat', 'Forbes', 'Business Insider') THEN 0.85
            WHEN v_news.source = 'GitHub Blog' THEN 0.75
            WHEN LOWER(v_news.source) LIKE '%blog%' THEN 0.6
            ELSE 0.75
        END;
    END IF;
    
    -- Find tool mention and get sentiment
    SELECT value INTO v_tool_mention
    FROM jsonb_array_elements(v_news.related_tools) 
    WHERE value->>'tool_id' = p_tool_id
    LIMIT 1;
    
    IF v_tool_mention IS NOT NULL THEN
        -- Calculate sentiment modifier
        v_sentiment_modifier := CASE v_tool_mention->>'sentiment'
            WHEN 'positive' THEN 1.0
            WHEN 'negative' THEN -1.0
            WHEN 'mixed' THEN 0.2
            ELSE 0
        END;
        
        -- Apply relevance multiplier
        v_sentiment_modifier := v_sentiment_modifier * CASE v_tool_mention->>'relevance'
            WHEN 'primary' THEN 1.0
            WHEN 'secondary' THEN 0.5
            WHEN 'mentioned' THEN 0.2
            ELSE 0.1
        END;
    END IF;
    
    -- Calculate effective impact
    v_effective_impact := v_base_impact * v_age_factor * v_pr_discount * v_credibility_factor;
    
    -- Apply sentiment adjustment
    v_effective_impact := v_effective_impact * (1 + v_sentiment_modifier);
    
    -- Return results
    RETURN QUERY SELECT 
        v_base_impact,
        v_age_factor,
        v_pr_discount,
        v_credibility_factor,
        v_sentiment_modifier,
        v_effective_impact;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- STEP 4: Create monthly news aggregation views
-- =============================================================================

-- View for news articles by month
CREATE OR REPLACE VIEW news_by_month AS
SELECT 
    DATE_TRUNC('month', published_date) as month,
    COUNT(*) as article_count,
    COUNT(DISTINCT source) as unique_sources,
    array_agg(DISTINCT type) as news_types,
    COUNT(DISTINCT jsonb_array_elements_text(related_tools)) as tools_mentioned
FROM news_updates
WHERE published_date IS NOT NULL
GROUP BY DATE_TRUNC('month', published_date)
ORDER BY month DESC;

-- View for tool news impact by month
CREATE OR REPLACE VIEW tool_news_impact_by_month AS
WITH tool_mentions AS (
    SELECT 
        DATE_TRUNC('month', n.published_date) as month,
        tool_mention->>'tool_id' as tool_id,
        n.id as news_id,
        n.published_date,
        n.type,
        n.source,
        tool_mention->>'relevance' as relevance,
        tool_mention->>'sentiment' as sentiment
    FROM news_updates n,
    LATERAL jsonb_array_elements(n.related_tools) as tool_mention
    WHERE n.published_date IS NOT NULL
)
SELECT 
    month,
    tool_id,
    COUNT(*) as news_count,
    COUNT(CASE WHEN sentiment = 'positive' THEN 1 END) as positive_news,
    COUNT(CASE WHEN sentiment = 'negative' THEN 1 END) as negative_news,
    COUNT(CASE WHEN sentiment = 'neutral' THEN 1 END) as neutral_news,
    COUNT(CASE WHEN relevance = 'primary' THEN 1 END) as primary_mentions,
    array_agg(DISTINCT type) as news_types
FROM tool_mentions
GROUP BY month, tool_id
ORDER BY month DESC, news_count DESC;

-- =============================================================================
-- STEP 5: Create function to get all news impacts for a tool at a specific date
-- =============================================================================

CREATE OR REPLACE FUNCTION get_tool_news_impacts_at_date(
    p_tool_id VARCHAR(50),
    p_reference_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    p_lookback_days INTEGER DEFAULT 730  -- Look back 2 years by default
) RETURNS TABLE (
    news_id UUID,
    title VARCHAR(255),
    published_date TIMESTAMP WITH TIME ZONE,
    type VARCHAR(50),
    source VARCHAR(100),
    base_impact DECIMAL,
    age_factor DECIMAL,
    effective_impact DECIMAL,
    sentiment VARCHAR(50),
    relevance VARCHAR(50)
) AS $$
BEGIN
    RETURN QUERY
    WITH tool_news AS (
        SELECT 
            n.id,
            n.title,
            n.published_date,
            n.type,
            n.source,
            tool_mention->>'sentiment' as sentiment,
            tool_mention->>'relevance' as relevance
        FROM news_updates n,
        LATERAL jsonb_array_elements(n.related_tools) as tool_mention
        WHERE tool_mention->>'tool_id' = p_tool_id
        AND n.published_date <= p_reference_date
        AND n.published_date >= p_reference_date - (p_lookback_days || ' days')::INTERVAL
    )
    SELECT 
        tn.id,
        tn.title,
        tn.published_date,
        tn.type,
        tn.source,
        impact.base_impact,
        impact.age_factor,
        impact.effective_impact,
        tn.sentiment,
        tn.relevance
    FROM tool_news tn
    CROSS JOIN LATERAL calculate_news_impact_at_date(tn.id, p_tool_id, p_reference_date) as impact
    ORDER BY impact.effective_impact DESC;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- STEP 6: Create aggregated news impact function for ranking calculations
-- =============================================================================

CREATE OR REPLACE FUNCTION calculate_aggregate_news_impact(
    p_tool_id VARCHAR(50),
    p_reference_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) RETURNS TABLE (
    total_impact DECIMAL,
    positive_impact DECIMAL,
    negative_impact DECIMAL,
    article_count INTEGER,
    recent_article_count INTEGER,
    avg_impact DECIMAL
) AS $$
DECLARE
    v_total_impact DECIMAL := 0;
    v_positive_impact DECIMAL := 0;
    v_negative_impact DECIMAL := 0;
    v_article_count INTEGER := 0;
    v_recent_article_count INTEGER := 0;
BEGIN
    -- Calculate aggregate impacts
    WITH impacts AS (
        SELECT * FROM get_tool_news_impacts_at_date(p_tool_id, p_reference_date)
    )
    SELECT 
        SUM(effective_impact),
        SUM(CASE WHEN effective_impact > 0 THEN effective_impact ELSE 0 END),
        SUM(CASE WHEN effective_impact < 0 THEN ABS(effective_impact) ELSE 0 END),
        COUNT(*),
        COUNT(CASE WHEN published_date >= p_reference_date - INTERVAL '30 days' THEN 1 END)
    INTO 
        v_total_impact,
        v_positive_impact,
        v_negative_impact,
        v_article_count,
        v_recent_article_count
    FROM impacts;
    
    RETURN QUERY SELECT 
        COALESCE(v_total_impact, 0),
        COALESCE(v_positive_impact, 0),
        COALESCE(v_negative_impact, 0),
        COALESCE(v_article_count, 0),
        COALESCE(v_recent_article_count, 0),
        CASE WHEN v_article_count > 0 
            THEN v_total_impact / v_article_count 
            ELSE 0 
        END;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- STEP 7: Create materialized view for historical news impacts
-- =============================================================================

-- Materialized view for pre-calculated monthly news impacts
CREATE MATERIALIZED VIEW IF NOT EXISTS news_impact_monthly_summary AS
WITH monthly_impacts AS (
    SELECT 
        DATE_TRUNC('month', n.published_date) as month,
        tool_mention->>'tool_id' as tool_id,
        n.id as news_id,
        calculate_news_impact_at_date(
            n.id, 
            tool_mention->>'tool_id', 
            DATE_TRUNC('month', n.published_date) + INTERVAL '1 month' - INTERVAL '1 day'
        ) as impact
    FROM news_updates n,
    LATERAL jsonb_array_elements(n.related_tools) as tool_mention
    WHERE n.published_date IS NOT NULL
)
SELECT 
    month,
    tool_id,
    COUNT(*) as article_count,
    SUM((impact).effective_impact) as total_impact,
    AVG((impact).effective_impact) as avg_impact,
    SUM(CASE WHEN (impact).effective_impact > 0 THEN (impact).effective_impact ELSE 0 END) as positive_impact,
    SUM(CASE WHEN (impact).effective_impact < 0 THEN ABS((impact).effective_impact) ELSE 0 END) as negative_impact
FROM monthly_impacts
GROUP BY month, tool_id;

-- Create index on materialized view
CREATE INDEX idx_news_impact_monthly_tool_month 
    ON news_impact_monthly_summary(tool_id, month);

-- Function to refresh materialized view
CREATE OR REPLACE FUNCTION refresh_news_impact_summary() 
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY news_impact_monthly_summary;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- STEP 8: Add helper functions for ranking integration
-- =============================================================================

-- Function to get news impact modifier for ranking calculations
CREATE OR REPLACE FUNCTION get_news_impact_modifier(
    p_tool_id VARCHAR(50),
    p_reference_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) RETURNS DECIMAL AS $$
DECLARE
    v_impact RECORD;
    v_modifier DECIMAL;
BEGIN
    -- Get aggregate news impact
    SELECT * INTO v_impact 
    FROM calculate_aggregate_news_impact(p_tool_id, p_reference_date);
    
    -- Calculate modifier (capped between -2 and +2)
    v_modifier := LEAST(2, GREATEST(-2, v_impact.total_impact / 10));
    
    -- Boost for high recent activity
    IF v_impact.recent_article_count > 5 THEN
        v_modifier := v_modifier + 0.2;
    END IF;
    
    RETURN v_modifier;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- STEP 9: Create audit trigger for news updates
-- =============================================================================

-- Function to log news impact calculations
CREATE OR REPLACE FUNCTION log_news_impact_calculation()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND NEW.effective_impact IS NOT NULL THEN
        INSERT INTO news_impact_history (
            news_id,
            tool_id,
            calculated_at,
            base_impact,
            age_factor,
            effective_impact
        )
        SELECT 
            NEW.id,
            tool_mention->>'tool_id',
            NOW(),
            NEW.effective_impact / NEW.decay_factor,
            NEW.decay_factor,
            NEW.effective_impact
        FROM jsonb_array_elements(NEW.related_tools) as tool_mention;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER news_impact_calculation_trigger
AFTER UPDATE ON news_updates
FOR EACH ROW
WHEN (OLD.effective_impact IS DISTINCT FROM NEW.effective_impact)
EXECUTE FUNCTION log_news_impact_calculation();

-- =============================================================================
-- VALIDATION AND INITIAL DATA REFRESH
-- =============================================================================

-- Validate the migration
DO $$
BEGIN
    RAISE NOTICE 'News longitudinal tracking migration completed successfully';
    RAISE NOTICE 'Tables created: news_impact_history';
    RAISE NOTICE 'Views created: news_by_month, tool_news_impact_by_month, news_impact_monthly_summary';
    RAISE NOTICE 'Functions created: calculate_news_impact_at_date, get_tool_news_impacts_at_date, calculate_aggregate_news_impact, get_news_impact_modifier';
    
    -- Refresh materialized view if there's data
    IF EXISTS (SELECT 1 FROM news_updates LIMIT 1) THEN
        PERFORM refresh_news_impact_summary();
        RAISE NOTICE 'Materialized view refreshed with existing data';
    END IF;
END $$;