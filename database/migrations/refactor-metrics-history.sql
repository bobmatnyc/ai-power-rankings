-- =============================================================================
-- METRICS HISTORY REFACTORING
-- Transform metrics_history to canonical entries with JSON metrics
-- =============================================================================

-- Create new metrics_history table with improved structure
CREATE TABLE metrics_history_v2 (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id VARCHAR(50) REFERENCES tools(id) ON DELETE CASCADE,
    recorded_date DATE NOT NULL,
    source_url VARCHAR(500),
    source_type VARCHAR(50) CHECK (source_type IN ('official', 'media', 'research', 'estimate', 'manual')),
    source_name VARCHAR(100), -- e.g., 'TechCrunch', 'Company Blog', 'GitHub API'
    
    -- All metrics stored as JSON with value and evidence
    metrics JSONB NOT NULL,
    /* Example structure:
    {
      "agentic_capability": {
        "value": 8.0,
        "evidence": "Composer mode enables multi-file editing"
      },
      "business_sentiment": {
        "value": 0.9,
        "evidence": "Fastest growing SaaS ever"
      },
      "monthly_arr": {
        "value": 50000000000,
        "evidence": "$500M+ ARR reported"
      },
      "swe_bench_score": {
        "value": 72.5,
        "evidence": "Official benchmark result"
      }
    }
    */
    
    -- Additional context
    notes TEXT,
    confidence_level VARCHAR(20) CHECK (confidence_level IN ('high', 'medium', 'low')),
    is_verified BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT NOW(),
    created_by VARCHAR(100),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Ensure one canonical entry per tool per date
    UNIQUE(tool_id, recorded_date)
);

-- Create indexes for performance
CREATE INDEX idx_metrics_v2_tool_date ON metrics_history_v2(tool_id, recorded_date DESC);
CREATE INDEX idx_metrics_v2_date ON metrics_history_v2(recorded_date DESC);
CREATE INDEX idx_metrics_v2_metrics ON metrics_history_v2 USING GIN (metrics);

-- Create view for easy access to latest metrics
CREATE VIEW latest_metrics AS
SELECT DISTINCT ON (tool_id, metric_key)
    tool_id,
    recorded_date,
    metric_key,
    (metric_value->>'value')::TEXT as value,
    metric_value->>'evidence' as evidence,
    source_url,
    source_name
FROM metrics_history_v2,
    LATERAL jsonb_each(metrics) AS x(metric_key, metric_value)
ORDER BY tool_id, metric_key, recorded_date DESC;

-- Create function to get specific metric history
CREATE OR REPLACE FUNCTION get_metric_history(
    p_tool_id VARCHAR(50),
    p_metric_key VARCHAR(100),
    p_start_date DATE DEFAULT '2020-01-01',
    p_end_date DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (
    recorded_date DATE,
    value TEXT,
    evidence TEXT,
    source_url VARCHAR(500),
    source_name VARCHAR(100)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mh.recorded_date,
        mh.metrics->p_metric_key->>'value' as value,
        mh.metrics->p_metric_key->>'evidence' as evidence,
        mh.source_url,
        mh.source_name
    FROM metrics_history_v2 mh
    WHERE mh.tool_id = p_tool_id
        AND mh.recorded_date BETWEEN p_start_date AND p_end_date
        AND mh.metrics ? p_metric_key
    ORDER BY mh.recorded_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Migrate existing data to new structure
INSERT INTO metrics_history_v2 (tool_id, recorded_date, source_url, source_type, source_name, metrics, notes, confidence_level)
SELECT 
    tool_id,
    DATE(recorded_at) as recorded_date,
    source_url,
    CASE 
        WHEN source IN ('techcrunch', 'bloomberg', 'reuters') THEN 'media'
        WHEN source IN ('github', 'anthropic', 'google', 'cognition') THEN 'official'
        WHEN source = 'manual_entry' THEN 'manual'
        WHEN source = 'expert_assessment' THEN 'estimate'
        ELSE 'estimate'
    END as source_type,
    source as source_name,
    jsonb_build_object(
        metric_key, 
        jsonb_build_object(
            'value', COALESCE(value_integer::TEXT, value_decimal::TEXT, value_boolean::TEXT, value_text),
            'evidence', notes
        )
    ) as metrics,
    notes,
    CASE 
        WHEN source_url IS NOT NULL THEN 'high'
        WHEN source != 'manual_entry' THEN 'medium'
        ELSE 'low'
    END as confidence_level
FROM metrics_history
WHERE metric_key IS NOT NULL
ON CONFLICT (tool_id, recorded_date) DO UPDATE
SET metrics = metrics_history_v2.metrics || EXCLUDED.metrics,
    notes = COALESCE(metrics_history_v2.notes, EXCLUDED.notes),
    source_url = COALESCE(metrics_history_v2.source_url, EXCLUDED.source_url);

-- Add helper function to add/update metrics
CREATE OR REPLACE FUNCTION upsert_metrics(
    p_tool_id VARCHAR(50),
    p_date DATE,
    p_source_url VARCHAR(500),
    p_source_type VARCHAR(50),
    p_source_name VARCHAR(100),
    p_metrics JSONB,
    p_notes TEXT DEFAULT NULL,
    p_confidence VARCHAR(20) DEFAULT 'medium'
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO metrics_history_v2 (
        tool_id, recorded_date, source_url, source_type, 
        source_name, metrics, notes, confidence_level
    )
    VALUES (
        p_tool_id, p_date, p_source_url, p_source_type,
        p_source_name, p_metrics, p_notes, p_confidence
    )
    ON CONFLICT (tool_id, recorded_date) DO UPDATE
    SET 
        metrics = metrics_history_v2.metrics || EXCLUDED.metrics,
        source_url = COALESCE(EXCLUDED.source_url, metrics_history_v2.source_url),
        source_type = COALESCE(EXCLUDED.source_type, metrics_history_v2.source_type),
        source_name = COALESCE(EXCLUDED.source_name, metrics_history_v2.source_name),
        notes = COALESCE(EXCLUDED.notes, metrics_history_v2.notes),
        confidence_level = EXCLUDED.confidence_level,
        updated_at = NOW()
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Example usage:
/*
SELECT upsert_metrics(
    'cursor',
    '2025-06-05',
    'https://techcrunch.com/2025/06/05/cursor-9-9b-valuation/',
    'media',
    'TechCrunch',
    '{
        "monthly_arr": {"value": 50000000000, "evidence": "$500M+ ARR reported in Series C"},
        "valuation": {"value": 990000000000, "evidence": "$9.9B Series C valuation"},
        "funding_amount": {"value": 90000000000, "evidence": "$900M Series C round"},
        "estimated_users": {"value": 600000, "evidence": "Estimated from $500M ARR at $70-80/user/month"}
    }'::jsonb,
    'Series C funding announcement',
    'high'
);
*/

-- Create reporting view for current state
CREATE VIEW current_tool_metrics AS
SELECT 
    t.id as tool_id,
    t.name as tool_name,
    t.category,
    
    -- Latest quantitative metrics
    (SELECT (metrics->'monthly_arr'->>'value')::BIGINT 
     FROM metrics_history_v2 
     WHERE tool_id = t.id AND metrics ? 'monthly_arr' 
     ORDER BY recorded_date DESC LIMIT 1) as latest_arr,
    
    (SELECT (metrics->'valuation'->>'value')::BIGINT 
     FROM metrics_history_v2 
     WHERE tool_id = t.id AND metrics ? 'valuation' 
     ORDER BY recorded_date DESC LIMIT 1) as latest_valuation,
    
    (SELECT (metrics->'estimated_users'->>'value')::INTEGER 
     FROM metrics_history_v2 
     WHERE tool_id = t.id AND metrics ? 'estimated_users' 
     ORDER BY recorded_date DESC LIMIT 1) as estimated_users,
    
    -- Latest qualitative metrics
    (SELECT (metrics->'agentic_capability'->>'value')::DECIMAL 
     FROM metrics_history_v2 
     WHERE tool_id = t.id AND metrics ? 'agentic_capability' 
     ORDER BY recorded_date DESC LIMIT 1) as agentic_score,
    
    (SELECT (metrics->'business_sentiment'->>'value')::DECIMAL 
     FROM metrics_history_v2 
     WHERE tool_id = t.id AND metrics ? 'business_sentiment' 
     ORDER BY recorded_date DESC LIMIT 1) as business_sentiment,
    
    (SELECT (metrics->'swe_bench_score'->>'value')::DECIMAL 
     FROM metrics_history_v2 
     WHERE tool_id = t.id AND metrics ? 'swe_bench_score' 
     ORDER BY recorded_date DESC LIMIT 1) as swe_bench_score,
    
    -- Latest update info
    (SELECT MAX(recorded_date) 
     FROM metrics_history_v2 
     WHERE tool_id = t.id) as last_updated
     
FROM tools t
WHERE t.status = 'active';

-- Add comment explaining the new structure
COMMENT ON TABLE metrics_history_v2 IS 'Canonical metrics storage with all metrics for a tool/date in a single JSON entry. Ensures data consistency and source attribution.';
COMMENT ON COLUMN metrics_history_v2.metrics IS 'JSON object containing all metrics with value and evidence. Each metric should follow guidelines in METRICS-GUIDELINES.md';

-- Keep old table for reference but rename it
ALTER TABLE metrics_history RENAME TO metrics_history_old;
ALTER TABLE metrics_history_v2 RENAME TO metrics_history;