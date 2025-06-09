-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tools table
CREATE TABLE tools (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    category VARCHAR(50) NOT NULL,
    subcategory VARCHAR(50),
    description TEXT,
    website_url VARCHAR(255),
    github_repo VARCHAR(255),
    company_name VARCHAR(100),
    founded_date DATE,
    pricing_model VARCHAR(20),
    license_type VARCHAR(20),
    status VARCHAR(20) DEFAULT 'active',
    logo_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Tool capabilities
CREATE TABLE tool_capabilities (
    tool_id VARCHAR(50) REFERENCES tools(id),
    autonomy_level INTEGER CHECK (autonomy_level >= 1 AND autonomy_level <= 10),
    context_window_size INTEGER,
    supports_multi_file BOOLEAN DEFAULT FALSE,
    supported_languages JSONB,
    supported_platforms JSONB,
    integration_types JSONB,
    llm_providers JSONB,
    deployment_options JSONB,
    PRIMARY KEY (tool_id)
);

-- Tool metrics (current snapshot)
CREATE TABLE tool_metrics (
    tool_id VARCHAR(50) REFERENCES tools(id),
    metric_date DATE DEFAULT CURRENT_DATE,
    github_stars INTEGER DEFAULT 0,
    github_forks INTEGER DEFAULT 0,
    github_watchers INTEGER DEFAULT 0,
    github_commits_last_month INTEGER DEFAULT 0,
    github_contributors INTEGER DEFAULT 0,
    github_last_commit TIMESTAMP,
    funding_total BIGINT DEFAULT 0,
    valuation_latest BIGINT DEFAULT 0,
    estimated_users INTEGER DEFAULT 0,
    social_mentions_30d INTEGER DEFAULT 0,
    sentiment_score DECIMAL(3,2) DEFAULT 0.5,
    community_size INTEGER DEFAULT 0,
    release_frequency_days INTEGER,
    PRIMARY KEY (tool_id, metric_date)
);

-- Rankings
CREATE TABLE rankings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period VARCHAR(20) NOT NULL,
    tool_id VARCHAR(50) REFERENCES tools(id),
    position INTEGER NOT NULL,
    score DECIMAL(5,3) NOT NULL,
    movement VARCHAR(10),
    movement_positions INTEGER DEFAULT 0,
    previous_position INTEGER,
    score_breakdown JSONB,
    algorithm_version VARCHAR(10),
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(period, tool_id)
);

-- Ranking periods
CREATE TABLE ranking_periods (
    period VARCHAR(20) PRIMARY KEY,
    display_name VARCHAR(50) NOT NULL,
    publication_date DATE NOT NULL,
    tools_count INTEGER NOT NULL,
    algorithm_version VARCHAR(10),
    editorial_summary TEXT,
    major_changes JSONB,
    is_current BOOLEAN DEFAULT FALSE
);

-- News updates
CREATE TABLE news_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

-- Email subscribers
CREATE TABLE email_subscribers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    subscribed_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    preferences JSONB,
    source VARCHAR(50)
);

-- Create indexes for performance
CREATE INDEX idx_rankings_period ON rankings(period);
CREATE INDEX idx_rankings_position ON rankings(position);
CREATE INDEX idx_tools_category ON tools(category);
CREATE INDEX idx_tools_status ON tools(status);
CREATE INDEX idx_news_published ON news_updates(published_at);
CREATE INDEX idx_metrics_date ON tool_metrics(metric_date);