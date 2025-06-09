-- =============================================================================
-- METRICS HISTORY PURE JSON STRUCTURE
-- Single source of truth for all metrics data
-- =============================================================================

-- Create new pure JSON metrics table
CREATE TABLE metrics_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Core identifiers
    tool_id VARCHAR(50) REFERENCES tools(id) ON DELETE CASCADE,
    source_url VARCHAR(500) UNIQUE NOT NULL, -- Ensures one record per source
    
    -- Full JSON payload containing everything
    data JSONB NOT NULL,
    /* Example structure:
    {
      "recorded_date": "2025-06-09",
      "source": {
        "type": "media",        // official, media, research, estimate, manual
        "name": "TechCrunch",
        "author": "John Doe",
        "published_date": "2025-06-09"
      },
      "metrics": {
        "monthly_arr": {
          "value": 50000000000,
          "evidence": "$500M+ ARR reported in Series C",
          "confidence": "high"
        },
        "valuation": {
          "value": 990000000000,
          "evidence": "$9.9B Series C valuation",
          "confidence": "high"
        },
        "agentic_capability": {
          "value": 8.0,
          "evidence": "Composer mode enables multi-file editing",
          "confidence": "medium"
        },
        "innovation_score": {
          "value": 8.0,
          "evidence": "Codebase-wide understanding paradigm",
          "confidence": "high"
        }
      },
      "context": {
        "event": "Series C Funding",
        "competitors_mentioned": ["GitHub Copilot", "Windsurf"],
        "key_quotes": ["fastest growing SaaS ever"],
        "methodology": "direct announcement"
      },
      "metadata": {
        "collected_at": "2025-06-09T10:30:00Z",
        "collector": "manual",
        "version": "1.0",
        "tags": ["funding", "unicorn", "growth"]
      }
    }
    */
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Indexes on commonly queried JSON paths
    CONSTRAINT valid_json CHECK (
        data ? 'recorded_date' AND 
        data ? 'source' AND 
        data ? 'metrics'
    )
);

-- Create indexes for performance
CREATE INDEX idx_metrics_tool_date ON metrics_records(tool_id, (data->>'recorded_date') DESC);
CREATE INDEX idx_metrics_source_url ON metrics_records(source_url);
CREATE INDEX idx_metrics_data ON metrics_records USING GIN (data);
CREATE INDEX idx_metrics_recorded_date ON metrics_records((data->>'recorded_date'));

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_metrics_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_metrics_updated_at
    BEFORE UPDATE ON metrics_records
    FOR EACH ROW
    EXECUTE FUNCTION update_metrics_updated_at();

-- Helper function to upsert metrics
CREATE OR REPLACE FUNCTION upsert_metrics_record(
    p_tool_id VARCHAR(50),
    p_source_url VARCHAR(500),
    p_data JSONB
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO metrics_records (tool_id, source_url, data)
    VALUES (p_tool_id, p_source_url, p_data)
    ON CONFLICT (source_url) DO UPDATE
    SET 
        data = EXCLUDED.data,
        tool_id = EXCLUDED.tool_id
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- View to extract latest metrics per tool
CREATE VIEW latest_tool_metrics AS
WITH ranked_metrics AS (
    SELECT 
        tool_id,
        data,
        ROW_NUMBER() OVER (
            PARTITION BY tool_id 
            ORDER BY (data->>'recorded_date') DESC, created_at DESC
        ) as rn
    FROM metrics_records
)
SELECT 
    t.id as tool_id,
    t.name as tool_name,
    t.category,
    rm.data->>'recorded_date' as latest_date,
    rm.data->'metrics' as metrics,
    rm.data->'source' as source
FROM tools t
LEFT JOIN ranked_metrics rm ON t.id = rm.tool_id AND rm.rn = 1
WHERE t.status = 'active';

-- View to get all metrics for a specific date
CREATE VIEW metrics_by_date AS
SELECT 
    tool_id,
    data->>'recorded_date' as recorded_date,
    data->'source'->>'type' as source_type,
    data->'source'->>'name' as source_name,
    data->'metrics' as metrics,
    source_url
FROM metrics_records
ORDER BY (data->>'recorded_date') DESC, tool_id;

-- Function to get metric history for a specific tool and metric
CREATE OR REPLACE FUNCTION get_metric_timeline(
    p_tool_id VARCHAR(50),
    p_metric_key VARCHAR(100)
)
RETURNS TABLE (
    recorded_date DATE,
    value TEXT,
    evidence TEXT,
    source_name TEXT,
    source_url VARCHAR(500)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (data->>'recorded_date')::DATE,
        data->'metrics'->p_metric_key->>'value',
        data->'metrics'->p_metric_key->>'evidence',
        data->'source'->>'name',
        mr.source_url
    FROM metrics_records mr
    WHERE mr.tool_id = p_tool_id
        AND data->'metrics' ? p_metric_key
    ORDER BY (data->>'recorded_date') DESC;
END;
$$ LANGUAGE plpgsql;

-- Example usage:
/*
-- Insert a new record
SELECT upsert_metrics_record(
    'cursor',
    'https://techcrunch.com/2025/06/05/cursor-9-9b-valuation/',
    '{
        "recorded_date": "2025-06-05",
        "source": {
            "type": "media",
            "name": "TechCrunch",
            "author": "Jane Smith"
        },
        "metrics": {
            "monthly_arr": {
                "value": 50000000000,
                "evidence": "$500M+ ARR reported",
                "confidence": "high"
            },
            "valuation": {
                "value": 990000000000,
                "evidence": "$9.9B valuation",
                "confidence": "high"
            }
        },
        "context": {
            "event": "Series C Funding"
        }
    }'::jsonb
);

-- Update qualitative values
UPDATE metrics_records 
SET data = jsonb_set(
    jsonb_set(
        data,
        '{metrics,innovation_score}',
        '{"value": 8.5, "evidence": "Composer mode revolutionized multi-file editing", "confidence": "high"}'::jsonb
    ),
    '{metadata,updated_by}',
    '"analyst_review"'
)
WHERE source_url = 'https://techcrunch.com/2025/06/05/cursor-9-9b-valuation/';

-- Query latest metrics
SELECT * FROM latest_tool_metrics WHERE tool_id = 'cursor';

-- Get metric history
SELECT * FROM get_metric_timeline('cursor', 'monthly_arr');
*/

-- Add comment explaining the design
COMMENT ON TABLE metrics_records IS 'Pure JSON storage for all metrics data. Each record represents metrics from a unique source URL. Data can be updated to refine qualitative assessments while maintaining source attribution.';
COMMENT ON COLUMN metrics_records.source_url IS 'Unique constraint ensures one record per source, preventing duplicate entries from the same article/source.';
COMMENT ON COLUMN metrics_records.data IS 'Complete JSON payload containing metrics, source info, context, and metadata. See METRICS-GUIDELINES.md for structure.';