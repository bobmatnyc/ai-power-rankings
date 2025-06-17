-- Migration: Add tables for tracking processed files and ingestion reports
-- Since we can't move files with API key only, we track processed files in the database

-- Table to track processed Google Drive files
CREATE TABLE IF NOT EXISTS processed_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_id VARCHAR(255) NOT NULL UNIQUE,
  file_name VARCHAR(255) NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  articles_ingested INTEGER DEFAULT 0,
  validation_errors INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_processed_files_file_id ON processed_files(file_id);
CREATE INDEX idx_processed_files_processed_at ON processed_files(processed_at);

-- Table to store ingestion reports
CREATE TABLE IF NOT EXISTS ingestion_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  file_name VARCHAR(255) NOT NULL,
  file_id VARCHAR(255),
  report JSONB NOT NULL,
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for report queries
CREATE INDEX idx_ingestion_reports_file_name ON ingestion_reports(file_name);
CREATE INDEX idx_ingestion_reports_processed_at ON ingestion_reports(processed_at);

-- Add news decay metadata to news_updates if not exists
ALTER TABLE news_updates 
ADD COLUMN IF NOT EXISTS effective_impact DECIMAL(5,2),
ADD COLUMN IF NOT EXISTS decay_factor DECIMAL(5,4),
ADD COLUMN IF NOT EXISTS last_impact_calculated TIMESTAMP WITH TIME ZONE;

-- Function to calculate news impact with aging
CREATE OR REPLACE FUNCTION calculate_news_impact(
  published_date TIMESTAMP WITH TIME ZONE,
  base_impact DECIMAL,
  is_pr BOOLEAN DEFAULT FALSE,
  reference_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) RETURNS DECIMAL AS $$
DECLARE
  days_old INTEGER;
  decay_factor DECIMAL;
  pr_discount DECIMAL := 0.7;
  effective_impact DECIMAL;
BEGIN
  -- Calculate age in days
  days_old := GREATEST(0, EXTRACT(DAY FROM reference_date - published_date));
  
  -- Asymptotic decay curve: 50% decay at 365 days
  decay_factor := 1.0 / (1.0 + POWER(days_old / 365.0, 1.5));
  
  -- Apply decay
  effective_impact := base_impact * decay_factor;
  
  -- Apply PR discount if applicable
  IF is_pr THEN
    effective_impact := effective_impact * pr_discount;
  END IF;
  
  RETURN ROUND(effective_impact, 2);
END;
$$ LANGUAGE plpgsql;

-- View for recent high-impact news
CREATE OR REPLACE VIEW recent_news_impact AS
SELECT 
  nu.id,
  nu.title,
  nu.source,
  nu.published_date,
  nu.type,
  nu.related_tools,
  EXTRACT(DAY FROM NOW() - nu.published_date) as days_old,
  CASE 
    WHEN nu.metadata->>'is_company_announcement' = 'true' 
      OR nu.type IN ('company_news', 'company_announcement')
      OR LOWER(nu.source) LIKE '%blog%'
      OR LOWER(nu.source) LIKE '%press release%'
    THEN true 
    ELSE false 
  END as is_pr,
  calculate_news_impact(
    nu.published_date,
    CASE 
      WHEN nu.impact_assessment->>'importance' = 'critical' THEN 10
      WHEN nu.impact_assessment->>'importance' = 'high' THEN 7
      WHEN nu.impact_assessment->>'importance' = 'medium' THEN 4
      ELSE 2
    END,
    CASE 
      WHEN nu.metadata->>'is_company_announcement' = 'true' 
        OR nu.type IN ('company_news', 'company_announcement')
      THEN true 
      ELSE false 
    END
  ) as effective_impact
FROM news_updates nu
WHERE nu.published_date > NOW() - INTERVAL '2 years'
ORDER BY effective_impact DESC;