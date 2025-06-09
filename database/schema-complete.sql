-- AI Power Rankings Complete Database Schema
-- This schema matches the POPULATE.sql data structure

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- =============================================================================
-- CORE TABLES
-- =============================================================================

-- Algorithm versions for tracking ranking methodology changes
CREATE TABLE algorithm_versions (
    version VARCHAR(10) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    weights JSONB NOT NULL,
    active_from DATE NOT NULL,
    active_to DATE,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Companies table (parent organizations)
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    website_url VARCHAR(255),
    headquarters VARCHAR(100),
    founded_year INTEGER,
    company_size VARCHAR(20) CHECK (company_size IN ('startup', 'small', 'medium', 'large', 'enterprise')),
    company_type VARCHAR(20) CHECK (company_type IN ('private', 'public', 'open-source', 'non-profit')),
    logo_url VARCHAR(500),
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tools registry
CREATE TABLE tools (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    company_id UUID REFERENCES companies(id),
    category VARCHAR(50) NOT NULL,
    subcategory VARCHAR(50),
    description TEXT,
    tagline VARCHAR(255),
    website_url VARCHAR(255),
    github_repo VARCHAR(255),
    founded_date DATE,
    first_tracked_date DATE DEFAULT CURRENT_DATE,
    pricing_model VARCHAR(20) CHECK (pricing_model IN ('free', 'freemium', 'paid', 'open-source', 'enterprise')),
    license_type VARCHAR(20) CHECK (license_type IN ('mit', 'apache', 'gpl', 'proprietary', 'other')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'beta', 'deprecated', 'discontinued')),
    logo_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tool capabilities (flexible key-value storage)
CREATE TABLE tool_capabilities (
    tool_id VARCHAR(50) REFERENCES tools(id) ON DELETE CASCADE,
    capability_type VARCHAR(50) NOT NULL,
    value_text TEXT,
    value_number DECIMAL,
    value_boolean BOOLEAN,
    value_json JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (tool_id, capability_type)
);

-- Pricing plans
CREATE TABLE pricing_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id VARCHAR(50) REFERENCES tools(id) ON DELETE CASCADE,
    plan_name VARCHAR(50) NOT NULL,
    price_monthly DECIMAL(10,2),
    price_annually DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    billing_cycle VARCHAR(20) CHECK (billing_cycle IN ('monthly', 'annually', 'one-time', 'usage-based')),
    features JSONB,
    limits JSONB,
    is_primary BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- METRICS SYSTEM
-- =============================================================================

-- Metric definitions
CREATE TABLE metric_definitions (
    metric_key VARCHAR(50) PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_category VARCHAR(50) NOT NULL,
    data_type VARCHAR(20) NOT NULL CHECK (data_type IN ('integer', 'decimal', 'boolean', 'json')),
    unit VARCHAR(50),
    description TEXT,
    algorithm_factor VARCHAR(50),
    weight_in_factor DECIMAL(3,2),
    update_frequency VARCHAR(20),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Metrics history (time series data)
CREATE TABLE metrics_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id VARCHAR(50) REFERENCES tools(id) ON DELETE CASCADE,
    metric_key VARCHAR(50) REFERENCES metric_definitions(metric_key),
    value_integer BIGINT,
    value_decimal DECIMAL(15,2),
    value_boolean BOOLEAN,
    value_json JSONB,
    recorded_at TIMESTAMP NOT NULL,
    source VARCHAR(50),
    source_url VARCHAR(500),
    notes TEXT,
    is_interpolated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tool_id, metric_key, recorded_at)
);

-- =============================================================================
-- RANKING SYSTEM
-- =============================================================================

-- Ranking periods
CREATE TABLE ranking_periods (
    period VARCHAR(20) PRIMARY KEY,
    display_name VARCHAR(50) NOT NULL,
    calculation_date DATE NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    publication_date DATE,
    is_published BOOLEAN DEFAULT FALSE,
    is_current BOOLEAN DEFAULT FALSE,
    algorithm_version VARCHAR(10) REFERENCES algorithm_versions(version),
    editorial_summary TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Ranking cache (pre-calculated rankings)
CREATE TABLE ranking_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period VARCHAR(20) REFERENCES ranking_periods(period),
    tool_id VARCHAR(50) REFERENCES tools(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    score DECIMAL(5,2) NOT NULL,
    market_traction_score DECIMAL(5,2),
    technical_capability_score DECIMAL(5,2),
    developer_adoption_score DECIMAL(5,2),
    development_velocity_score DECIMAL(5,2),
    platform_resilience_score DECIMAL(5,2),
    community_sentiment_score DECIMAL(5,2),
    algorithm_version VARCHAR(10) REFERENCES algorithm_versions(version),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(period, tool_id)
);

-- Ranking editorial content
CREATE TABLE ranking_editorial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period VARCHAR(20) REFERENCES ranking_periods(period),
    tool_id VARCHAR(50) REFERENCES tools(id) ON DELETE CASCADE,
    the_real_story TEXT,
    key_developments JSONB,
    competitive_analysis TEXT,
    notable_events JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(period, tool_id)
);

-- =============================================================================
-- FINANCIAL DATA
-- =============================================================================

-- Funding rounds
CREATE TABLE funding_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
    round_type VARCHAR(50),
    amount_usd BIGINT NOT NULL,
    valuation_usd BIGINT,
    announced_date DATE NOT NULL,
    lead_investor VARCHAR(100),
    other_investors JSONB,
    source_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- PERFORMANCE TRACKING
-- =============================================================================

-- Performance benchmarks
CREATE TABLE performance_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id VARCHAR(50) REFERENCES tools(id) ON DELETE CASCADE,
    benchmark_name VARCHAR(50) NOT NULL,
    score DECIMAL(5,2) NOT NULL,
    max_score DECIMAL(5,2) DEFAULT 100.00,
    test_date DATE NOT NULL,
    source_url VARCHAR(500),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- NEWS AND UPDATES
-- =============================================================================

-- News updates
CREATE TABLE news_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    summary TEXT,
    url VARCHAR(500) NOT NULL,
    source VARCHAR(100) NOT NULL,
    published_at TIMESTAMP NOT NULL,
    related_tools JSONB,
    category VARCHAR(50),
    importance_score INTEGER CHECK (importance_score >= 1 AND importance_score <= 10),
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- DATA COLLECTION
-- =============================================================================

-- Data collection jobs
CREATE TABLE data_collection_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type VARCHAR(50) NOT NULL,
    job_name VARCHAR(100) NOT NULL,
    schedule_cron VARCHAR(50),
    config JSONB,
    target_tools JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Collection run history
CREATE TABLE collection_run_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES data_collection_jobs(id),
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    status VARCHAR(20) CHECK (status IN ('running', 'completed', 'failed', 'partial')),
    tools_processed INTEGER DEFAULT 0,
    tools_failed INTEGER DEFAULT 0,
    error_logs JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Primary query indexes
CREATE INDEX idx_tools_category_status ON tools(category, status);
CREATE INDEX idx_tools_company ON tools(company_id);
CREATE INDEX idx_tools_slug ON tools(slug);

-- Metrics indexes
CREATE INDEX idx_metrics_tool_key_date ON metrics_history(tool_id, metric_key, recorded_at DESC);
CREATE INDEX idx_metrics_recorded_at ON metrics_history(recorded_at);
CREATE INDEX idx_metrics_source ON metrics_history(source);

-- Ranking indexes
CREATE INDEX idx_rankings_period_position ON ranking_cache(period, position);
CREATE INDEX idx_rankings_tool_period ON ranking_cache(tool_id, period);
CREATE INDEX idx_rankings_period_score ON ranking_cache(period, score DESC);

-- Financial indexes
CREATE INDEX idx_funding_company_date ON funding_rounds(company_id, announced_date DESC);
CREATE INDEX idx_funding_date ON funding_rounds(announced_date DESC);

-- News indexes
CREATE INDEX idx_news_published ON news_updates(published_at DESC);
CREATE INDEX idx_news_importance ON news_updates(importance_score DESC);

-- Performance indexes
CREATE INDEX idx_benchmarks_tool ON performance_benchmarks(tool_id, test_date DESC);
CREATE INDEX idx_benchmarks_name ON performance_benchmarks(benchmark_name);

-- =============================================================================
-- VIEWS FOR COMMON QUERIES
-- =============================================================================

-- Current tool metrics view
CREATE OR REPLACE VIEW current_tool_metrics AS
SELECT DISTINCT ON (tool_id, metric_key)
    tool_id,
    metric_key,
    COALESCE(value_integer, value_decimal) as value,
    recorded_at,
    source
FROM metrics_history
ORDER BY tool_id, metric_key, recorded_at DESC;

-- Latest rankings view
CREATE OR REPLACE VIEW latest_rankings AS
SELECT 
    rc.position,
    t.name as tool_name,
    t.slug,
    t.category,
    rc.score,
    rc.market_traction_score,
    rc.technical_capability_score,
    rc.developer_adoption_score,
    rc.development_velocity_score,
    rc.platform_resilience_score,
    rc.community_sentiment_score,
    rp.period,
    rp.display_name as period_name
FROM ranking_cache rc
JOIN tools t ON rc.tool_id = t.id
JOIN ranking_periods rp ON rc.period = rp.period
WHERE rp.is_current = TRUE
ORDER BY rc.position;

-- Tool funding summary view
CREATE OR REPLACE VIEW tool_funding_summary AS
SELECT 
    t.id as tool_id,
    t.name as tool_name,
    c.name as company_name,
    COUNT(fr.id) as funding_rounds,
    SUM(fr.amount_usd) as total_funding_usd,
    MAX(fr.valuation_usd) as latest_valuation_usd,
    MAX(fr.announced_date) as last_funding_date
FROM tools t
JOIN companies c ON t.company_id = c.id
LEFT JOIN funding_rounds fr ON c.id = fr.company_id
GROUP BY t.id, t.name, c.name;

-- =============================================================================
-- HELPER FUNCTIONS
-- =============================================================================

-- Get metric value at specific time
CREATE OR REPLACE FUNCTION get_metric_at_time(
    p_tool_id VARCHAR(50),
    p_metric_key VARCHAR(50),
    p_timestamp TIMESTAMP
) RETURNS DECIMAL AS $$
DECLARE
    v_value DECIMAL;
BEGIN
    SELECT COALESCE(value_decimal, value_integer::decimal) INTO v_value
    FROM metrics_history
    WHERE tool_id = p_tool_id
    AND metric_key = p_metric_key
    AND recorded_at <= p_timestamp
    ORDER BY recorded_at DESC
    LIMIT 1;
    
    RETURN v_value;
END;
$$ LANGUAGE plpgsql;

-- Calculate week-over-week change
CREATE OR REPLACE FUNCTION calculate_wow_change(
    p_tool_id VARCHAR(50),
    p_metric_key VARCHAR(50),
    p_date DATE DEFAULT CURRENT_DATE
) RETURNS DECIMAL AS $$
DECLARE
    v_current DECIMAL;
    v_previous DECIMAL;
BEGIN
    v_current := get_metric_at_time(p_tool_id, p_metric_key, p_date::timestamp);
    v_previous := get_metric_at_time(p_tool_id, p_metric_key, (p_date - INTERVAL '7 days')::timestamp);
    
    IF v_previous IS NULL OR v_previous = 0 THEN
        RETURN 0;
    END IF;
    
    RETURN ((v_current - v_previous) / v_previous) * 100;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================================================

-- Enable RLS on sensitive tables (optional for POC)
-- ALTER TABLE metrics_history ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE funding_rounds ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- FINAL SETUP
-- =============================================================================

-- Set timezone to UTC
SET timezone = 'UTC';

-- Create a function to update updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at columns
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tools_updated_at BEFORE UPDATE ON tools
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tool_capabilities_updated_at BEFORE UPDATE ON tool_capabilities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_pricing_plans_updated_at BEFORE UPDATE ON pricing_plans
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ranking_periods_updated_at BEFORE UPDATE ON ranking_periods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ranking_editorial_updated_at BEFORE UPDATE ON ranking_editorial
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================================
-- VALIDATION QUERIES
-- =============================================================================

-- Query to validate schema creation
SELECT 
    'Schema created successfully' as status,
    COUNT(DISTINCT table_name) as tables_created
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE';

-- Query to check all required tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_type = 'BASE TABLE'
ORDER BY table_name;