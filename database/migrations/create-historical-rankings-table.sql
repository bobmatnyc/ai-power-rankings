-- Migration: Create Historical Rankings Table
-- This table stores rankings for different time periods with news impact

-- Create historical_rankings table
CREATE TABLE IF NOT EXISTS historical_rankings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Time period
  ranking_period DATE NOT NULL, -- First day of the month for monthly rankings
  period_type VARCHAR(20) DEFAULT 'monthly' CHECK (period_type IN ('monthly', 'quarterly', 'yearly')),
  
  -- Tool information
  tool_id VARCHAR(255) NOT NULL REFERENCES tools(id),
  tool_name VARCHAR(255) NOT NULL,
  
  -- Ranking data
  position INTEGER NOT NULL,
  score DECIMAL(10,4) NOT NULL,
  tier VARCHAR(20) NOT NULL CHECK (tier IN ('S', 'A', 'B', 'C', 'D')),
  
  -- Score breakdown
  base_score DECIMAL(10,4) NOT NULL DEFAULT 0,
  news_impact_score DECIMAL(10,4) NOT NULL DEFAULT 0,
  metrics_score DECIMAL(10,4) NOT NULL DEFAULT 0,
  
  -- Factor scores (matching algorithm v6)
  agentic_capability DECIMAL(5,2) DEFAULT 0,
  innovation DECIMAL(5,2) DEFAULT 0,
  technical_performance DECIMAL(5,2) DEFAULT 0,
  developer_adoption DECIMAL(5,2) DEFAULT 0,
  market_traction DECIMAL(5,2) DEFAULT 0,
  business_sentiment DECIMAL(5,2) DEFAULT 0,
  development_velocity DECIMAL(5,2) DEFAULT 0,
  platform_resilience DECIMAL(5,2) DEFAULT 0,
  
  -- News summary
  news_articles_count INTEGER DEFAULT 0,
  news_total_impact DECIMAL(10,4) DEFAULT 0,
  news_positive_mentions INTEGER DEFAULT 0,
  news_negative_mentions INTEGER DEFAULT 0,
  recent_funding_rounds INTEGER DEFAULT 0,
  recent_product_launches INTEGER DEFAULT 0,
  
  -- Algorithm metadata
  algorithm_version VARCHAR(50) NOT NULL DEFAULT 'v6',
  includes_news_impact BOOLEAN NOT NULL DEFAULT true,
  calculation_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX idx_historical_rankings_period ON historical_rankings(ranking_period, period_type);
CREATE INDEX idx_historical_rankings_tool ON historical_rankings(tool_id);
CREATE INDEX idx_historical_rankings_position ON historical_rankings(ranking_period, position);
CREATE INDEX idx_historical_rankings_score ON historical_rankings(ranking_period, score DESC);

-- Unique constraint to prevent duplicate rankings for same tool/period
CREATE UNIQUE INDEX idx_historical_rankings_unique 
ON historical_rankings(tool_id, ranking_period, period_type, algorithm_version);

-- Function to determine tier based on position
CREATE OR REPLACE FUNCTION calculate_tier(position INTEGER) RETURNS VARCHAR(20) AS $$
BEGIN
  CASE 
    WHEN position <= 5 THEN RETURN 'S';
    WHEN position <= 15 THEN RETURN 'A';
    WHEN position <= 25 THEN RETURN 'B';
    WHEN position <= 35 THEN RETURN 'C';
    ELSE RETURN 'D';
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate news impact for a tool in a given period
CREATE OR REPLACE FUNCTION calculate_news_impact_for_period(
  p_tool_id VARCHAR(255),
  p_period_start DATE,
  p_period_end DATE DEFAULT NULL
) RETURNS TABLE(
  articles_count INTEGER,
  total_impact DECIMAL(10,4),
  positive_mentions INTEGER,
  funding_rounds INTEGER,
  product_launches INTEGER,
  weighted_score DECIMAL(10,4)
) AS $$
DECLARE
  period_end_date DATE;
BEGIN
  -- Default to end of month if not specified
  period_end_date := COALESCE(p_period_end, (p_period_start + INTERVAL '1 month - 1 day')::DATE);
  
  RETURN QUERY
  SELECT 
    COUNT(*)::INTEGER as articles_count,
    SUM(COALESCE(nu.importance_score, 5))::DECIMAL(10,4) as total_impact,
    COUNT(CASE WHEN nu.importance_score >= 7 THEN 1 END)::INTEGER as positive_mentions,
    COUNT(CASE WHEN nu.category = 'funding' THEN 1 END)::INTEGER as funding_rounds,
    COUNT(CASE WHEN nu.category IN ('product-update', 'product') THEN 1 END)::INTEGER as product_launches,
    (
      SUM(COALESCE(nu.importance_score, 5)) * 2 + -- Base impact
      COUNT(CASE WHEN nu.category = 'funding' THEN 1 END) * 25 + -- Funding boost
      COUNT(CASE WHEN nu.category IN ('product-update', 'product') THEN 1 END) * 15 + -- Product boost
      COUNT(CASE WHEN nu.importance_score >= 8 THEN 1 END) * 10 -- High impact boost
    )::DECIMAL(10,4) as weighted_score
  FROM news_updates nu
  WHERE (
    p_tool_id = ANY(nu.related_tools) OR
    nu.related_tools @> ARRAY[p_tool_id]
  )
  AND nu.published_at::DATE BETWEEN p_period_start AND period_end_date;
END;
$$ LANGUAGE plpgsql;

-- View for latest rankings
CREATE OR REPLACE VIEW latest_rankings AS
SELECT hr.*
FROM historical_rankings hr
INNER JOIN (
  SELECT tool_id, MAX(ranking_period) as latest_period
  FROM historical_rankings
  GROUP BY tool_id
) latest ON hr.tool_id = latest.tool_id AND hr.ranking_period = latest.latest_period
ORDER BY hr.position;

COMMENT ON TABLE historical_rankings IS 'Stores historical rankings with news impact for different time periods';
COMMENT ON FUNCTION calculate_news_impact_for_period IS 'Calculates news impact metrics for a tool within a specific period';