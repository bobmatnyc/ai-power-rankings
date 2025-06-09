-- AI Power Rankings Enhanced Schema for POC1
-- Includes temporal metrics and flexible metric definitions

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "btree_gist"; -- For temporal queries

-- Companies table (parent organizations)
CREATE TABLE companies (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    website_url VARCHAR(255),
    founded_date DATE,
    headquarters_location VARCHAR(100),
    total_funding BIGINT DEFAULT 0,
    last_funding_date DATE,
    last_funding_amount BIGINT,
    last_funding_round VARCHAR(50),
    valuation BIGINT,
    employee_count INTEGER,
    is_public BOOLEAN DEFAULT FALSE,
    stock_symbol VARCHAR(10),
    parent_company_id VARCHAR(50) REFERENCES companies(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tools table with company relationship
CREATE TABLE tools (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    subcategory VARCHAR(50),
    description TEXT,
    website_url VARCHAR(255),
    github_repo VARCHAR(255),
    company_id VARCHAR(50) REFERENCES companies(id),
    founded_date DATE,
    first_release_date DATE,
    pricing_model VARCHAR(20) CHECK (pricing_model IN ('free', 'freemium', 'paid', 'enterprise')),
    license_type VARCHAR(20) CHECK (license_type IN ('open-source', 'proprietary', 'source-available')),
    status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'beta', 'deprecated', 'discontinued')),
    logo_url VARCHAR(255),
    first_tracked_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tool capabilities with more details
CREATE TABLE tool_capabilities (
    tool_id VARCHAR(50) REFERENCES tools(id) ON DELETE CASCADE,
    autonomy_level INTEGER CHECK (autonomy_level >= 1 AND autonomy_level <= 10),
    context_window_size INTEGER,
    supports_multi_file BOOLEAN DEFAULT FALSE,
    supports_workspace_analysis BOOLEAN DEFAULT FALSE,
    supports_code_execution BOOLEAN DEFAULT FALSE,
    supports_debugging BOOLEAN DEFAULT FALSE,
    supported_languages JSONB, -- ["python", "javascript", "typescript", ...]
    supported_platforms JSONB, -- ["vscode", "jetbrains", "web", "cli", ...]
    integration_types JSONB, -- ["ide", "api", "cli", "browser", ...]
    llm_providers JSONB, -- ["openai", "anthropic", "google", "proprietary", ...]
    deployment_options JSONB, -- ["cloud", "local", "hybrid", ...]
    key_features JSONB, -- ["auto-complete", "generation", "refactoring", ...]
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (tool_id)
);

-- Metric definitions for flexible metric tracking
CREATE TABLE metric_definitions (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL, -- 'github', 'social', 'financial', 'usage', 'community'
    data_type VARCHAR(20) NOT NULL CHECK (data_type IN ('integer', 'decimal', 'boolean', 'json')),
    unit VARCHAR(50), -- 'count', 'usd', 'percentage', etc.
    description TEXT,
    collection_frequency VARCHAR(20), -- 'daily', 'weekly', 'monthly'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Metrics history table for temporal data
CREATE TABLE metrics_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tool_id VARCHAR(50) REFERENCES tools(id) ON DELETE CASCADE,
    metric_id VARCHAR(50) REFERENCES metric_definitions(id),
    value_numeric DECIMAL,
    value_boolean BOOLEAN,
    value_json JSONB,
    collected_at TIMESTAMP NOT NULL,
    source VARCHAR(50), -- 'github_api', 'manual', 'web_scrape', etc.
    is_interpolated BOOLEAN DEFAULT FALSE, -- For filled gaps
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tool_id, metric_id, collected_at)
);

-- Current metrics view (latest values for each metric)
CREATE OR REPLACE VIEW current_metrics AS
SELECT DISTINCT ON (tool_id, metric_id)
    tool_id,
    metric_id,
    value_numeric,
    value_boolean,
    value_json,
    collected_at
FROM metrics_history
ORDER BY tool_id, metric_id, collected_at DESC;

-- Rankings with enhanced metadata
CREATE TABLE rankings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period VARCHAR(20) NOT NULL, -- '2025-01'
    tool_id VARCHAR(50) REFERENCES tools(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    score DECIMAL(5,2) NOT NULL CHECK (score >= 0 AND score <= 100),
    movement VARCHAR(10) CHECK (movement IN ('up', 'down', 'same', 'new', 'returning')),
    movement_positions INTEGER DEFAULT 0,
    previous_position INTEGER,
    score_breakdown JSONB NOT NULL, -- Detailed factor scores
    momentum_score DECIMAL(5,2),
    engagement_score DECIMAL(5,2),
    innovation_score DECIMAL(5,2),
    algorithm_version VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(period, tool_id)
);

-- Ranking periods with metadata
CREATE TABLE ranking_periods (
    period VARCHAR(20) PRIMARY KEY,
    display_name VARCHAR(50) NOT NULL,
    publication_date DATE NOT NULL,
    tools_count INTEGER NOT NULL,
    algorithm_version VARCHAR(10) NOT NULL,
    algorithm_config JSONB, -- Weights and parameters used
    editorial_summary TEXT,
    major_changes JSONB,
    is_current BOOLEAN DEFAULT FALSE,
    is_published BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- News updates for context
CREATE TABLE news_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    summary TEXT,
    url VARCHAR(500) NOT NULL,
    source VARCHAR(100) NOT NULL,
    published_at TIMESTAMP NOT NULL,
    related_tools JSONB, -- Array of tool_ids
    category VARCHAR(50),
    sentiment VARCHAR(20) CHECK (sentiment IN ('positive', 'negative', 'neutral', 'mixed')),
    importance_score INTEGER CHECK (importance_score >= 1 AND importance_score <= 10),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Tool funding events
CREATE TABLE funding_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_id VARCHAR(50) REFERENCES companies(id) ON DELETE CASCADE,
    amount BIGINT NOT NULL,
    round_type VARCHAR(50), -- 'seed', 'series_a', 'series_b', etc.
    lead_investor VARCHAR(100),
    investors JSONB, -- Array of investor names
    announced_date DATE NOT NULL,
    source_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW()
);

-- Email subscribers
CREATE TABLE email_subscribers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    subscribed_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    preferences JSONB,
    source VARCHAR(50),
    last_email_sent_at TIMESTAMP,
    unsubscribed_at TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_rankings_period ON rankings(period);
CREATE INDEX idx_rankings_position ON rankings(position);
CREATE INDEX idx_rankings_tool_period ON rankings(tool_id, period);
CREATE INDEX idx_tools_category ON tools(category);
CREATE INDEX idx_tools_status ON tools(status);
CREATE INDEX idx_tools_company ON tools(company_id);
CREATE INDEX idx_metrics_history_tool ON metrics_history(tool_id, metric_id, collected_at DESC);
CREATE INDEX idx_metrics_history_collected ON metrics_history(collected_at);
CREATE INDEX idx_news_published ON news_updates(published_at);
CREATE INDEX idx_funding_company ON funding_events(company_id);
CREATE INDEX idx_funding_date ON funding_events(announced_date);

-- Insert default metric definitions
INSERT INTO metric_definitions (id, name, category, data_type, unit, collection_frequency) VALUES
-- GitHub metrics
('github_stars', 'GitHub Stars', 'github', 'integer', 'count', 'daily'),
('github_forks', 'GitHub Forks', 'github', 'integer', 'count', 'daily'),
('github_watchers', 'GitHub Watchers', 'github', 'integer', 'count', 'daily'),
('github_contributors', 'GitHub Contributors', 'github', 'integer', 'count', 'weekly'),
('github_commits_30d', 'GitHub Commits (30 days)', 'github', 'integer', 'count', 'weekly'),
('github_issues_open', 'Open Issues', 'github', 'integer', 'count', 'daily'),
('github_pr_open', 'Open Pull Requests', 'github', 'integer', 'count', 'daily'),
('github_releases_count', 'Total Releases', 'github', 'integer', 'count', 'weekly'),
('github_last_release_days', 'Days Since Last Release', 'github', 'integer', 'days', 'daily'),

-- Social/Community metrics
('twitter_followers', 'Twitter Followers', 'social', 'integer', 'count', 'weekly'),
('discord_members', 'Discord Members', 'community', 'integer', 'count', 'weekly'),
('reddit_subscribers', 'Reddit Subscribers', 'community', 'integer', 'count', 'weekly'),
('social_mentions_7d', 'Social Mentions (7 days)', 'social', 'integer', 'count', 'weekly'),
('sentiment_score', 'Sentiment Score', 'social', 'decimal', 'score', 'weekly'),

-- Usage metrics
('npm_downloads_weekly', 'NPM Weekly Downloads', 'usage', 'integer', 'count', 'weekly'),
('vscode_installs', 'VS Code Installs', 'usage', 'integer', 'count', 'weekly'),
('docker_pulls', 'Docker Pulls', 'usage', 'integer', 'count', 'weekly'),
('estimated_mau', 'Estimated Monthly Active Users', 'usage', 'integer', 'count', 'monthly'),

-- Financial metrics
('funding_total', 'Total Funding', 'financial', 'integer', 'usd', 'monthly'),
('valuation', 'Company Valuation', 'financial', 'integer', 'usd', 'monthly'),
('revenue_arr', 'Annual Recurring Revenue', 'financial', 'integer', 'usd', 'monthly'),
('employee_count', 'Employee Count', 'financial', 'integer', 'count', 'monthly');

-- Helper function to get metric value at a specific time
CREATE OR REPLACE FUNCTION get_metric_at_time(
    p_tool_id VARCHAR(50),
    p_metric_id VARCHAR(50),
    p_timestamp TIMESTAMP
) RETURNS DECIMAL AS $$
DECLARE
    v_value DECIMAL;
BEGIN
    SELECT value_numeric INTO v_value
    FROM metrics_history
    WHERE tool_id = p_tool_id
    AND metric_id = p_metric_id
    AND collected_at <= p_timestamp
    ORDER BY collected_at DESC
    LIMIT 1;
    
    RETURN v_value;
END;
$$ LANGUAGE plpgsql;

-- Helper function to calculate week-over-week change
CREATE OR REPLACE FUNCTION calculate_wow_change(
    p_tool_id VARCHAR(50),
    p_metric_id VARCHAR(50),
    p_date DATE DEFAULT CURRENT_DATE
) RETURNS DECIMAL AS $$
DECLARE
    v_current DECIMAL;
    v_previous DECIMAL;
BEGIN
    v_current := get_metric_at_time(p_tool_id, p_metric_id, p_date::timestamp);
    v_previous := get_metric_at_time(p_tool_id, p_metric_id, (p_date - INTERVAL '7 days')::timestamp);
    
    IF v_previous IS NULL OR v_previous = 0 THEN
        RETURN 0;
    END IF;
    
    RETURN ((v_current - v_previous) / v_previous) * 100;
END;
$$ LANGUAGE plpgsql;