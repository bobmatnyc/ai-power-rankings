-- =============================================================================
-- METRICS RECORDS WITH MULTI-TOOL SUPPORT
-- Single source can contain metrics for multiple tools
-- =============================================================================

-- Drop existing table to rebuild with new structure
DROP TABLE IF EXISTS metrics_records CASCADE;

-- Create new structure supporting multiple tools per source
CREATE TABLE metrics_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Source identification
    source_url VARCHAR(500) UNIQUE NOT NULL,
    source_type VARCHAR(50) CHECK (source_type IN ('official', 'media', 'research', 'benchmark', 'estimate', 'manual')),
    source_name VARCHAR(100) NOT NULL, -- e.g., 'TechCrunch', 'SWE-bench', 'GitHub Blog'
    
    -- Source metadata
    published_date DATE,
    author VARCHAR(200),
    title TEXT,
    
    -- Full JSON payload containing all data from this source
    data JSONB NOT NULL,
    /* Example structure:
    {
      "context": {
        "event_type": "benchmark_results",  // or "funding_round", "market_analysis", etc.
        "methodology": "SWE-bench verified test suite",
        "key_findings": ["Claude leads with 72.7%", "Cursor shows 63% improvement"],
        "industry_context": "Post-GPT-4 landscape analysis"
      },
      "tools": {
        "claude-code": {
          "metrics": {
            "swe_bench_score": {
              "value": 72.7,
              "evidence": "Highest score on SWE-bench verified",
              "confidence": "high"
            },
            "swe_bench_lite": {
              "value": 80.5,
              "evidence": "Top performance on lite benchmark",
              "confidence": "high"
            }
          },
          "analysis": "Demonstrates superior reasoning capabilities"
        },
        "cursor": {
          "metrics": {
            "swe_bench_score": {
              "value": 63.0,
              "evidence": "Strong performance, 2nd place",
              "confidence": "high"
            },
            "monthly_arr": {
              "value": 50000000000,
              "evidence": "$500M+ ARR mentioned in benchmark context",
              "confidence": "medium"
            }
          },
          "analysis": "Rapid improvement from previous 40% score"
        },
        "github-copilot": {
          "metrics": {
            "swe_bench_score": {
              "value": 48.2,
              "evidence": "Mid-tier performance",
              "confidence": "high"
            }
          },
          "analysis": "Established player showing incremental gains"
        }
      },
      "metadata": {
        "collected_at": "2025-06-09T10:30:00Z",
        "collector": "manual",
        "version": "2.0",
        "tags": ["benchmark", "swe-bench", "comparison"]
      }
    }
    */
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    -- Validation
    CONSTRAINT valid_source_json CHECK (
        data ? 'tools' AND 
        jsonb_typeof(data->'tools') = 'object' AND
        data ? 'metadata'
    )
);

-- Create materialized view for tool-centric queries
CREATE MATERIALIZED VIEW tool_metrics AS
SELECT 
    tool_key as tool_id,
    s.source_url,
    s.source_type,
    s.source_name,
    s.published_date,
    tool_data->'metrics' as metrics,
    tool_data->'analysis' as analysis,
    s.data->'context' as context,
    s.created_at,
    s.updated_at
FROM 
    metrics_sources s,
    jsonb_each(s.data->'tools') AS t(tool_key, tool_data)
WHERE 
    jsonb_typeof(tool_data->'metrics') = 'object';

-- Create indexes
CREATE INDEX idx_sources_url ON metrics_sources(source_url);
CREATE INDEX idx_sources_date ON metrics_sources(published_date DESC);
CREATE INDEX idx_sources_type ON metrics_sources(source_type);
CREATE INDEX idx_sources_data ON metrics_sources USING GIN (data);
CREATE INDEX idx_sources_tools ON metrics_sources USING GIN ((data->'tools'));

-- Index on materialized view
CREATE INDEX idx_tool_metrics_tool ON tool_metrics(tool_id);
CREATE INDEX idx_tool_metrics_date ON tool_metrics(published_date DESC);
CREATE INDEX idx_tool_metrics_metrics ON tool_metrics USING GIN (metrics);

-- Refresh trigger for materialized view
CREATE OR REPLACE FUNCTION refresh_tool_metrics()
RETURNS TRIGGER AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY tool_metrics;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_refresh_tool_metrics
    AFTER INSERT OR UPDATE OR DELETE ON metrics_sources
    FOR EACH STATEMENT
    EXECUTE FUNCTION refresh_tool_metrics();

-- Helper function to add/update a source with multiple tools
CREATE OR REPLACE FUNCTION upsert_metrics_source(
    p_source_url VARCHAR(500),
    p_source_type VARCHAR(50),
    p_source_name VARCHAR(100),
    p_published_date DATE,
    p_data JSONB
)
RETURNS UUID AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO metrics_sources (
        source_url, source_type, source_name, published_date, data
    )
    VALUES (
        p_source_url, p_source_type, p_source_name, p_published_date, p_data
    )
    ON CONFLICT (source_url) DO UPDATE
    SET 
        data = EXCLUDED.data,
        source_type = EXCLUDED.source_type,
        source_name = EXCLUDED.source_name,
        published_date = EXCLUDED.published_date
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- Function to get all metrics for a specific tool
CREATE OR REPLACE FUNCTION get_tool_metrics_history(p_tool_id VARCHAR(50))
RETURNS TABLE (
    source_url VARCHAR(500),
    source_name VARCHAR(100),
    published_date DATE,
    metrics JSONB,
    analysis TEXT,
    context JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        tm.source_url,
        tm.source_name,
        tm.published_date,
        tm.metrics,
        tm.analysis::TEXT,
        tm.context
    FROM tool_metrics tm
    WHERE tm.tool_id = p_tool_id
    ORDER BY tm.published_date DESC;
END;
$$ LANGUAGE plpgsql;

-- Example usage:
/*
-- Insert a benchmark comparison
SELECT upsert_metrics_source(
    'https://github.com/openai/simple-evals/swe-bench-results-2025-06',
    'benchmark',
    'SWE-bench Official',
    '2025-06-01',
    '{
        "context": {
            "event_type": "benchmark_results",
            "methodology": "SWE-bench verified test suite",
            "test_count": 500,
            "key_findings": [
                "Claude Code achieves state-of-the-art 72.7%",
                "Significant improvements across all tools",
                "Agentic capabilities correlate with performance"
            ]
        },
        "tools": {
            "claude-code": {
                "metrics": {
                    "swe_bench_score": {"value": 72.7, "evidence": "Official result", "confidence": "high"},
                    "swe_bench_lite": {"value": 80.5, "evidence": "Lite benchmark", "confidence": "high"}
                },
                "analysis": "Best-in-class performance with advanced reasoning"
            },
            "cursor": {
                "metrics": {
                    "swe_bench_score": {"value": 63.0, "evidence": "Official result", "confidence": "high"}
                },
                "analysis": "Strong improvement from 40% in previous version"
            },
            "devin": {
                "metrics": {
                    "swe_bench_score": {"value": 68.5, "evidence": "Official result", "confidence": "high"}
                },
                "analysis": "Autonomous approach shows promise"
            },
            "github-copilot": {
                "metrics": {
                    "swe_bench_score": {"value": 48.2, "evidence": "Official result", "confidence": "high"}
                },
                "analysis": "Incremental improvements, focus on reliability"
            }
        },
        "metadata": {
            "collected_at": "2025-06-09T15:00:00Z",
            "version": "2.0"
        }
    }'::jsonb
);

-- Insert a market analysis article
SELECT upsert_metrics_source(
    'https://techcrunch.com/2025/06/08/ai-coding-tools-market-analysis',
    'media',
    'TechCrunch',
    '2025-06-08',
    '{
        "context": {
            "event_type": "market_analysis",
            "author": "Sarah Johnson",
            "title": "AI Coding Tools Market Heats Up: Cursor vs GitHub Copilot vs Devin"
        },
        "tools": {
            "cursor": {
                "metrics": {
                    "estimated_users": {"value": 600000, "evidence": "600K+ developers reported", "confidence": "high"},
                    "growth_rate": {"value": 15, "evidence": "15% MoM growth", "confidence": "medium"}
                },
                "analysis": "Fastest growing tool in the space"
            },
            "github-copilot": {
                "metrics": {
                    "estimated_users": {"value": 2000000, "evidence": "2M+ users across plans", "confidence": "high"},
                    "enterprise_adoption": {"value": 50000, "evidence": "50K+ companies", "confidence": "high"}
                },
                "analysis": "Market leader by user count"
            },
            "devin": {
                "metrics": {
                    "waitlist_size": {"value": 500000, "evidence": "500K developer waitlist", "confidence": "medium"}
                },
                "analysis": "High interest but limited availability"
            }
        },
        "metadata": {
            "collected_at": "2025-06-09T10:00:00Z"
        }
    }'::jsonb
);
*/

-- Create view for latest metrics per tool
CREATE VIEW latest_tool_metrics_v2 AS
WITH ranked_metrics AS (
    SELECT 
        tool_id,
        source_url,
        source_name,
        published_date,
        metrics,
        analysis,
        context,
        ROW_NUMBER() OVER (
            PARTITION BY tool_id 
            ORDER BY published_date DESC, created_at DESC
        ) as rn
    FROM tool_metrics
)
SELECT 
    t.id as tool_id,
    t.name as tool_name,
    t.category,
    rm.published_date as latest_date,
    rm.metrics,
    rm.source_name,
    rm.source_url
FROM tools t
LEFT JOIN ranked_metrics rm ON t.id = rm.tool_id AND rm.rn = 1
WHERE t.status = 'active';

COMMENT ON TABLE metrics_sources IS 'Source-centric storage where each source (article, benchmark, report) can contain metrics for multiple tools. Enables tracking competitive comparisons and benchmark results.';
COMMENT ON MATERIALIZED VIEW tool_metrics IS 'Tool-centric view of metrics data, automatically maintained from metrics_sources. Use this for tool-specific queries.';
COMMENT ON COLUMN metrics_sources.data IS 'JSON structure containing tools object with metrics for each tool mentioned in the source. See migration script for detailed schema.';