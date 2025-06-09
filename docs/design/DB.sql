-- AI Power Rankings Database Schema
-- Focused design for tracking agentic AI coding tools and rankings

-- =============================================================================
-- CORE TOOL REGISTRY
-- =============================================================================

-- Primary tool information registry
CREATE TABLE tools (
    id VARCHAR(50) PRIMARY KEY, -- e.g., 'cursor', 'github-copilot'
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL, -- URL-friendly identifier
    display_name VARCHAR(200), -- Marketing/display name if different
    company_id UUID REFERENCES companies(id),
    category VARCHAR(50) NOT NULL, -- 'code-editor', 'autonomous-agent', etc.
    subcategory VARCHAR(100), -- More specific classification
    description TEXT,
    tagline VARCHAR(500), -- Brief marketing description
    website_url VARCHAR(500),
    github_repo VARCHAR(200), -- Format: 'owner/repo'
    documentation_url VARCHAR(500),
    founded_date DATE,
    first_tracked_date DATE, -- When we started monitoring this tool
    pricing_model VARCHAR(50) NOT NULL, -- 'free', 'freemium', 'paid', 'enterprise'
    license_type VARCHAR(50) NOT NULL, -- 'open-source', 'proprietary', 'commercial'
    status VARCHAR(30) DEFAULT 'active', -- 'active', 'discontinued', 'beta', 'stealth'
    logo_url VARCHAR(500),
    screenshot_url VARCHAR(500),
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Search and filtering optimization
    CONSTRAINT valid_category CHECK (category IN (
        'code-editor', 'autonomous-agent', 'app-builder', 'ide-assistant',
        'testing-tool', 'open-source-framework', 'specialized-platform',
        'documentation-tool', 'code-review', 'enterprise-platform'
    )),
    CONSTRAINT valid_pricing CHECK (pricing_model IN (
        'free', 'freemium', 'paid', 'enterprise', 'usage-based', 'open-source'
    )),
    CONSTRAINT valid_license CHECK (license_type IN (
        'open-source', 'proprietary', 'commercial', 'mit', 'apache', 'gpl'
    ))
);

-- Company information for tools
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    website_url VARCHAR(500),
    headquarters VARCHAR(200), -- City, Country
    founded_year INTEGER,
    company_size VARCHAR(50), -- 'startup', 'small', 'medium', 'large', 'enterprise'
    company_type VARCHAR(50), -- 'startup', 'public', 'private', 'acquisition'
    parent_company_id UUID REFERENCES companies(id), -- For acquisitions
    logo_url VARCHAR(500),
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Technical capabilities and specifications
CREATE TABLE tool_capabilities (
    tool_id VARCHAR(50) REFERENCES tools(id) ON DELETE CASCADE,
    capability_type VARCHAR(50) NOT NULL,
    value_text VARCHAR(500),
    value_number DECIMAL(10,2),
    value_boolean BOOLEAN,
    value_json JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (tool_id, capability_type),
    
    -- Predefined capability types
    CONSTRAINT valid_capability CHECK (capability_type IN (
        'autonomy_level', 'context_window_size', 'supports_multi_file',
        'supported_languages', 'supported_platforms', 'integration_types',
        'llm_providers', 'deployment_options', 'swe_bench_score',
        'max_file_size', 'offline_capable', 'custom_models'
    ))
);

-- Pricing tiers and plans
CREATE TABLE pricing_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id VARCHAR(50) REFERENCES tools(id) ON DELETE CASCADE,
    plan_name VARCHAR(100) NOT NULL, -- 'Free', 'Pro', 'Enterprise'
    price_monthly DECIMAL(10,2), -- Monthly price in USD
    price_annually DECIMAL(10,2), -- Annual price in USD
    currency VARCHAR(3) DEFAULT 'USD',
    billing_cycle VARCHAR(20), -- 'monthly', 'annually', 'usage-based'
    features JSONB, -- Array of features included
    limits JSONB, -- Usage limits (requests, users, etc.)
    is_primary BOOLEAN DEFAULT FALSE, -- Main plan to display
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =============================================================================
-- METRICS AND DATA COLLECTION (History-Based)
-- =============================================================================

-- Define what metrics we track and their properties
CREATE TABLE metric_definitions (
    metric_key VARCHAR(100) PRIMARY KEY,
    metric_name VARCHAR(200) NOT NULL,
    metric_category VARCHAR(50) NOT NULL, -- 'github', 'business', 'community', 'technical', 'web'
    data_type VARCHAR(20) NOT NULL, -- 'integer', 'decimal', 'text', 'boolean', 'json'
    unit VARCHAR(50), -- 'count', 'percentage', 'usd_cents', 'days', etc.
    description TEXT,
    algorithm_factor VARCHAR(50), -- Which ranking factor this contributes to
    weight_in_factor DECIMAL(3,2), -- 0.0 to 1.0, how much this metric matters within its factor
    update_frequency VARCHAR(50), -- 'realtime', 'daily', 'weekly', 'monthly', 'irregular', 'manual'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT valid_data_type CHECK (data_type IN ('integer', 'decimal', 'text', 'boolean', 'json')),
    CONSTRAINT valid_category CHECK (metric_category IN ('github', 'business', 'community', 'technical', 'web', 'performance'))
);

-- Flexible metrics history - stores any metric for any tool at any time
CREATE TABLE metrics_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id VARCHAR(50) REFERENCES tools(id) ON DELETE CASCADE,
    metric_key VARCHAR(100) REFERENCES metric_definitions(metric_key),
    
    -- Flexible value storage
    value_integer BIGINT,
    value_decimal DECIMAL(15,4),
    value_text TEXT,
    value_boolean BOOLEAN,
    value_json JSONB,
    
    -- Metadata
    recorded_at TIMESTAMP NOT NULL, -- When this value was observed/valid
    collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, -- When we recorded it in our system
    source VARCHAR(200), -- 'github_api', 'manual_entry', 'news_scraping', 'company_announcement'
    source_url VARCHAR(1000), -- Reference URL for this data point
    confidence_score DECIMAL(3,2) DEFAULT 1.0, -- 0.0 to 1.0, how confident we are in this data
    
    -- Notes and context
    notes TEXT, -- Any additional context about this metric
    replaced_by UUID REFERENCES metrics_history(id), -- If this value was corrected later
    is_estimate BOOLEAN DEFAULT FALSE, -- True if this is an estimated/calculated value
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT single_value_type CHECK (
        (value_integer IS NOT NULL)::int + 
        (value_decimal IS NOT NULL)::int + 
        (value_text IS NOT NULL)::int + 
        (value_boolean IS NOT NULL)::int + 
        (value_json IS NOT NULL)::int = 1
    ),
    
    -- Indexes for performance
    INDEX idx_metrics_tool_key (tool_id, metric_key),
    INDEX idx_metrics_recorded_at (recorded_at DESC),
    INDEX idx_metrics_key_recorded (metric_key, recorded_at DESC),
    INDEX idx_metrics_tool_recorded (tool_id, recorded_at DESC)
);

-- Latest metrics view for easy access to current values
CREATE VIEW latest_metrics AS
SELECT DISTINCT ON (tool_id, metric_key)
    tool_id,
    metric_key,
    value_integer,
    value_decimal, 
    value_text,
    value_boolean,
    value_json,
    recorded_at,
    source,
    confidence_score,
    is_estimate
FROM metrics_history 
WHERE replaced_by IS NULL -- Only non-corrected values
ORDER BY tool_id, metric_key, recorded_at DESC;

-- Funding rounds and investment data
CREATE TABLE funding_rounds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID REFERENCES companies(id),
    round_type VARCHAR(50), -- 'seed', 'series-a', 'series-b', etc.
    amount_usd BIGINT, -- Amount in USD cents
    valuation_usd BIGINT, -- Post-money valuation in USD cents
    announced_date DATE,
    lead_investor VARCHAR(200),
    other_investors JSONB, -- Array of investor names
    use_of_funds TEXT,
    source_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance benchmarks (SWE-bench, etc.)
CREATE TABLE performance_benchmarks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id VARCHAR(50) REFERENCES tools(id) ON DELETE CASCADE,
    benchmark_name VARCHAR(100) NOT NULL, -- 'swe-bench', 'humaneval', etc.
    score DECIMAL(5,2) NOT NULL,
    max_score DECIMAL(5,2),
    percentile DECIMAL(5,2),
    test_date DATE,
    version_tested VARCHAR(50),
    methodology TEXT,
    source_url VARCHAR(500),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_benchmarks_tool (tool_id),
    INDEX idx_benchmarks_name (benchmark_name)
);

-- =============================================================================
-- RANKING SYSTEM (Temporal/Derivable)
-- =============================================================================

-- Ranking periods define when we want to calculate rankings (not store them)
CREATE TABLE ranking_periods (
    period VARCHAR(20) PRIMARY KEY, -- 'june-2025', 'july-2025'
    display_name VARCHAR(50) NOT NULL, -- 'June 2025'
    calculation_date DATE NOT NULL, -- When to calculate rankings (end of period)
    start_date DATE NOT NULL, -- Period start (for filtering relevant events)
    end_date DATE NOT NULL, -- Period end
    publication_date DATE,
    is_published BOOLEAN DEFAULT FALSE,
    is_current BOOLEAN DEFAULT FALSE,
    algorithm_version VARCHAR(20) NOT NULL,
    editorial_summary TEXT,
    major_changes JSONB, -- Notable movements and new entries
    market_analysis TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT single_current CHECK (
        (is_current = FALSE) OR 
        (is_current = TRUE AND (SELECT COUNT(*) FROM ranking_periods WHERE is_current = TRUE) <= 1)
    )
);

-- Optional: Cache calculated rankings for performance (but derivable from metrics)
CREATE TABLE ranking_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period VARCHAR(20) REFERENCES ranking_periods(period),
    tool_id VARCHAR(50) REFERENCES tools(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    score DECIMAL(8,3) NOT NULL,
    
    -- Score breakdown (algorithm factors)
    market_traction_score DECIMAL(5,3),
    technical_capability_score DECIMAL(5,3),
    developer_adoption_score DECIMAL(5,3),
    development_velocity_score DECIMAL(5,3),
    platform_resilience_score DECIMAL(5,3),
    community_sentiment_score DECIMAL(5,3),
    
    -- Movement tracking (calculated vs previous period)
    previous_position INTEGER,
    movement VARCHAR(20), -- 'up', 'down', 'same', 'new', 'returning', 'dropped'
    movement_positions INTEGER,
    
    -- Metadata
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    algorithm_version VARCHAR(20),
    data_completeness DECIMAL(3,2), -- 0.0 to 1.0, how much data was available
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(period, tool_id),
    UNIQUE(period, position),
    
    INDEX idx_ranking_cache_period (period),
    INDEX idx_ranking_cache_position (position),
    INDEX idx_ranking_cache_score (score DESC)
);

-- View to get metrics state at any point in time
CREATE VIEW metrics_at_time AS
SELECT DISTINCT ON (tool_id, metric_key, calculation_date)
    tool_id,
    metric_key,
    value_integer,
    value_decimal,
    value_text,
    value_boolean,
    value_json,
    recorded_at,
    source,
    confidence_score,
    is_estimate,
    calculation_date
FROM (
    SELECT 
        mh.*,
        rp.calculation_date,
        -- Only include metrics recorded before or on the calculation date
        CASE WHEN mh.recorded_at <= rp.calculation_date THEN mh.recorded_at ELSE NULL END as valid_recorded_at
    FROM metrics_history mh
    CROSS JOIN ranking_periods rp
    WHERE mh.replaced_by IS NULL -- Only non-corrected values
      AND mh.recorded_at <= rp.calculation_date
) filtered
WHERE valid_recorded_at IS NOT NULL
ORDER BY tool_id, metric_key, calculation_date, recorded_at DESC;

-- Function to calculate rankings for any period
CREATE OR REPLACE FUNCTION calculate_rankings_for_period(period_name VARCHAR(20))
RETURNS TABLE (
    tool_id VARCHAR(50),
    tool_name VARCHAR(200),
    position INTEGER,
    score DECIMAL(8,3),
    market_traction_score DECIMAL(5,3),
    technical_capability_score DECIMAL(5,3),
    developer_adoption_score DECIMAL(5,3),
    development_velocity_score DECIMAL(5,3),
    platform_resilience_score DECIMAL(5,3),
    community_sentiment_score DECIMAL(5,3),
    data_completeness DECIMAL(3,2)
) AS $
DECLARE
    period_date DATE;
    algo_version VARCHAR(20);
    factor_weights JSONB;
BEGIN
    -- Get period details
    SELECT rp.calculation_date, rp.algorithm_version
    INTO period_date, algo_version
    FROM ranking_periods rp 
    WHERE rp.period = period_name;
    
    -- Get algorithm weights
    SELECT av.weights INTO factor_weights
    FROM algorithm_versions av 
    WHERE av.version = algo_version;
    
    -- Calculate and return rankings
    RETURN QUERY
    WITH tool_metrics AS (
        SELECT 
            t.id as tool_id,
            t.name as tool_name,
            -- Market Traction Factor
            COALESCE(
                SUM(CASE WHEN md.algorithm_factor = 'market_traction' THEN
                    CASE md.data_type
                        WHEN 'integer' THEN mat.value_integer::DECIMAL * md.weight_in_factor * mat.confidence_score
                        WHEN 'decimal' THEN mat.value_decimal * md.weight_in_factor * mat.confidence_score
                        ELSE 0
                    END
                END), 0
            ) * (factor_weights->>'market_traction')::DECIMAL as market_score,
            
            -- Technical Capability Factor  
            COALESCE(
                SUM(CASE WHEN md.algorithm_factor = 'technical_capability' THEN
                    CASE md.data_type
                        WHEN 'integer' THEN mat.value_integer::DECIMAL * md.weight_in_factor * mat.confidence_score
                        WHEN 'decimal' THEN mat.value_decimal * md.weight_in_factor * mat.confidence_score
                        ELSE 0
                    END
                END), 0
            ) * (factor_weights->>'technical_capability')::DECIMAL as technical_score,
            
            -- Developer Adoption Factor
            COALESCE(
                SUM(CASE WHEN md.algorithm_factor = 'developer_adoption' THEN
                    CASE md.data_type
                        WHEN 'integer' THEN mat.value_integer::DECIMAL * md.weight_in_factor * mat.confidence_score
                        WHEN 'decimal' THEN mat.value_decimal * md.weight_in_factor * mat.confidence_score
                        ELSE 0
                    END
                END), 0
            ) * (factor_weights->>'developer_adoption')::DECIMAL as adoption_score,
            
            -- Development Velocity Factor
            COALESCE(
                SUM(CASE WHEN md.algorithm_factor = 'development_velocity' THEN
                    CASE md.data_type
                        WHEN 'integer' THEN mat.value_integer::DECIMAL * md.weight_in_factor * mat.confidence_score
                        WHEN 'decimal' THEN mat.value_decimal * md.weight_in_factor * mat.confidence_score
                        ELSE 0
                    END
                END), 0
            ) * (factor_weights->>'development_velocity')::DECIMAL as velocity_score,
            
            -- Platform Resilience Factor
            COALESCE(
                SUM(CASE WHEN md.algorithm_factor = 'platform_resilience' THEN
                    CASE md.data_type
                        WHEN 'integer' THEN mat.value_integer::DECIMAL * md.weight_in_factor * mat.confidence_score
                        WHEN 'decimal' THEN mat.value_decimal * md.weight_in_factor * mat.confidence_score
                        ELSE 0
                    END
                END), 0
            ) * (factor_weights->>'platform_resilience')::DECIMAL as resilience_score,
            
            -- Community Sentiment Factor
            COALESCE(
                SUM(CASE WHEN md.algorithm_factor = 'community_sentiment' THEN
                    CASE md.data_type
                        WHEN 'integer' THEN mat.value_integer::DECIMAL * md.weight_in_factor * mat.confidence_score
                        WHEN 'decimal' THEN mat.value_decimal * md.weight_in_factor * mat.confidence_score
                        ELSE 0
                    END
                END), 0
            ) * (factor_weights->>'community_sentiment')::DECIMAL as sentiment_score,
            
            -- Data completeness (how many metrics we have vs. total possible)
            COUNT(mat.metric_key)::DECIMAL / COUNT(md.metric_key)::DECIMAL as completeness
            
        FROM tools t
        LEFT JOIN metrics_at_time mat ON t.id = mat.tool_id AND mat.calculation_date = period_date
        LEFT JOIN metric_definitions md ON mat.metric_key = md.metric_key
        WHERE t.status = 'active'
        GROUP BY t.id, t.name
    ),
    ranked_tools AS (
        SELECT 
            tool_id,
            tool_name,
            market_score,
            technical_score,
            adoption_score,
            velocity_score,
            resilience_score,
            sentiment_score,
            completeness,
            (market_score + technical_score + adoption_score + velocity_score + resilience_score + sentiment_score) as total_score,
            ROW_NUMBER() OVER (ORDER BY 
                (market_score + technical_score + adoption_score + velocity_score + resilience_score + sentiment_score) DESC,
                completeness DESC,
                tool_name ASC
            ) as rank_position
        FROM tool_metrics
    )
    SELECT 
        rt.tool_id::VARCHAR(50),
        rt.tool_name::VARCHAR(200),
        rt.rank_position::INTEGER,
        rt.total_score::DECIMAL(8,3),
        rt.market_score::DECIMAL(5,3),
        rt.technical_score::DECIMAL(5,3),
        rt.adoption_score::DECIMAL(5,3),
        rt.velocity_score::DECIMAL(5,3),
        rt.resilience_score::DECIMAL(5,3),
        rt.sentiment_score::DECIMAL(5,3),
        rt.completeness::DECIMAL(3,2)
    FROM ranked_tools rt
    ORDER BY rt.rank_position;
END;
$ LANGUAGE plpgsql;

-- Editorial content linked to derivable rankings
CREATE TABLE ranking_editorial (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period VARCHAR(20) REFERENCES ranking_periods(period),
    tool_id VARCHAR(50) REFERENCES tools(id) ON DELETE CASCADE,
    
    -- Editorial content for this tool's ranking
    the_real_story TEXT, -- Key explanation for this ranking position
    key_developments JSONB, -- Array of recent developments that affected ranking
    competitive_analysis TEXT,
    notable_events JSONB, -- Array of events during this period
    
    -- Editorial metadata
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    author VARCHAR(200),
    editor_notes TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(period, tool_id),
    INDEX idx_editorial_period (period)
);

-- Utility view: Rankings with editorial content
CREATE VIEW rankings_with_editorial AS
SELECT 
    rc.*,
    re.the_real_story,
    re.key_developments,
    re.competitive_analysis,
    re.notable_events,
    -- Calculate movement vs previous period
    LAG(rc.position) OVER (PARTITION BY rc.tool_id ORDER BY rp.calculation_date) as previous_position,
    CASE 
        WHEN LAG(rc.position) OVER (PARTITION BY rc.tool_id ORDER BY rp.calculation_date) IS NULL THEN 'new'
        WHEN LAG(rc.position) OVER (PARTITION BY rc.tool_id ORDER BY rp.calculation_date) > rc.position THEN 'up'
        WHEN LAG(rc.position) OVER (PARTITION BY rc.tool_id ORDER BY rp.calculation_date) < rc.position THEN 'down'
        ELSE 'same'
    END as movement,
    LAG(rc.position) OVER (PARTITION BY rc.tool_id ORDER BY rp.calculation_date) - rc.position as movement_positions
FROM ranking_cache rc
JOIN ranking_periods rp ON rc.period = rp.period
LEFT JOIN ranking_editorial re ON rc.period = re.period AND rc.tool_id = re.tool_id;

-- Function to get tool ranking at any specific date
CREATE OR REPLACE FUNCTION get_tool_ranking_at_date(tool_name VARCHAR(50), target_date DATE)
RETURNS TABLE (
    ranking_date DATE,
    position INTEGER,
    score DECIMAL(8,3),
    available_metrics JSONB
) AS $
BEGIN
    RETURN QUERY
    WITH metrics_snapshot AS (
        SELECT 
            mh.metric_key,
            mh.value_integer,
            mh.value_decimal,
            mh.recorded_at,
            mh.source,
            ROW_NUMBER() OVER (PARTITION BY mh.metric_key ORDER BY mh.recorded_at DESC) as rn
        FROM metrics_history mh
        JOIN tools t ON mh.tool_id = t.id
        WHERE t.name = tool_name
          AND mh.recorded_at <= target_date
          AND mh.replaced_by IS NULL
    ),
    latest_metrics AS (
        SELECT 
            metric_key,
            value_integer,
            value_decimal,
            recorded_at,
            source
        FROM metrics_snapshot
        WHERE rn = 1
    )
    SELECT 
        target_date as ranking_date,
        1 as position, -- Would need full calculation here
        0.0::DECIMAL(8,3) as score, -- Placeholder
        jsonb_agg(
            jsonb_build_object(
                'metric', lm.metric_key,
                'value', COALESCE(lm.value_integer::TEXT, lm.value_decimal::TEXT),
                'recorded_at', lm.recorded_at,
                'source', lm.source
            )
        ) as available_metrics
    FROM latest_metrics lm;
END;
$ LANGUAGE plpgsql;

-- Function to compare rankings between two periods
CREATE OR REPLACE FUNCTION compare_rankings_between_periods(period1 VARCHAR(20), period2 VARCHAR(20))
RETURNS TABLE (
    tool_id VARCHAR(50),
    tool_name VARCHAR(200),
    period1_position INTEGER,
    period2_position INTEGER,
    position_change INTEGER,
    period1_score DECIMAL(8,3),
    period2_score DECIMAL(8,3),
    score_change DECIMAL(8,3)
) AS $
BEGIN
    RETURN QUERY
    SELECT 
        COALESCE(r1.tool_id, r2.tool_id)::VARCHAR(50),
        COALESCE(r1.tool_name, r2.tool_name)::VARCHAR(200),
        r1.position as period1_position,
        r2.position as period2_position,
        (r1.position - r2.position) as position_change,
        r1.score as period1_score,
        r2.score as period2_score,
        (r2.score - r1.score) as score_change
    FROM 
        (SELECT * FROM calculate_rankings_for_period(period1)) r1
    FULL OUTER JOIN 
        (SELECT * FROM calculate_rankings_for_period(period2)) r2
    ON r1.tool_id = r2.tool_id
    ORDER BY COALESCE(r2.position, 999), COALESCE(r1.position, 999);
END;
$ LANGUAGE plpgsql;

-- =============================================================================
-- CONTENT MANAGEMENT
-- =============================================================================

-- News and updates aggregation
CREATE TABLE news_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(500) NOT NULL,
    summary TEXT,
    content TEXT,
    url VARCHAR(1000) NOT NULL,
    source VARCHAR(200) NOT NULL,
    author VARCHAR(200),
    published_at TIMESTAMP NOT NULL,
    scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Categorization
    category VARCHAR(50), -- 'funding', 'product', 'industry', 'acquisition'
    importance_score INTEGER DEFAULT 5, -- 1-10 scale
    
    -- Tool associations
    related_tools JSONB, -- Array of tool IDs
    primary_tool_id VARCHAR(50) REFERENCES tools(id),
    
    -- Content analysis
    sentiment DECIMAL(3,2), -- -1 to 1
    key_topics JSONB, -- Array of extracted topics
    entities JSONB, -- Named entities found
    
    -- Processing status
    is_processed BOOLEAN DEFAULT FALSE,
    is_featured BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_news_published (published_at DESC),
    INDEX idx_news_category (category),
    INDEX idx_news_importance (importance_score DESC)
);

-- Monthly ranking reports and articles
CREATE TABLE ranking_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    period VARCHAR(20) REFERENCES ranking_periods(period),
    report_type VARCHAR(50), -- 'monthly-ranking', 'tool-spotlight', 'market-analysis'
    title VARCHAR(500) NOT NULL,
    slug VARCHAR(200) UNIQUE NOT NULL,
    
    -- Content
    executive_summary TEXT,
    content_markdown TEXT,
    content_html TEXT,
    
    -- SEO and metadata
    meta_description VARCHAR(300),
    meta_keywords JSONB,
    featured_image_url VARCHAR(500),
    
    -- Publishing
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'review', 'published', 'archived'
    published_at TIMESTAMP,
    author VARCHAR(200), -- Simple author name for now
    
    -- Basic metrics
    view_count INTEGER DEFAULT 0,
    social_shares INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_reports_period (period),
    INDEX idx_reports_published (published_at DESC),
    INDEX idx_reports_status (status)
);

-- Tool deep-dive articles and profiles
CREATE TABLE tool_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tool_id VARCHAR(50) REFERENCES tools(id) ON DELETE CASCADE,
    profile_type VARCHAR(50) DEFAULT 'comprehensive', -- 'comprehensive', 'spotlight', 'comparison'
    
    -- Content sections
    overview TEXT,
    key_features JSONB, -- Array of feature descriptions
    pricing_analysis TEXT,
    competitive_analysis TEXT,
    use_cases JSONB, -- Array of use case descriptions
    pros_cons JSONB, -- {pros: [], cons: []}
    expert_opinion TEXT,
    hands_on_review TEXT,
    
    -- Media
    screenshots JSONB, -- Array of screenshot URLs
    demo_videos JSONB, -- Array of video URLs
    
    -- Metadata
    last_reviewed DATE,
    reviewer_name VARCHAR(200), -- Simple reviewer name for now
    review_score DECIMAL(3,1), -- 1-10 scale
    
    -- Status
    is_published BOOLEAN DEFAULT FALSE,
    is_featured BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(tool_id, profile_type)
);

-- Newsletter subscribers (simplified)
CREATE TABLE email_subscribers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(320) UNIQUE NOT NULL,
    status VARCHAR(20) DEFAULT 'active', -- 'active', 'unsubscribed', 'bounced'
    
    -- Subscription preferences
    preferences JSONB DEFAULT '{"monthly_rankings": true, "tool_updates": true, "industry_news": false}',
    
    -- Source tracking
    source VARCHAR(50), -- 'website', 'tool-page', 'article'
    
    -- Basic engagement
    subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    unsubscribed_at TIMESTAMP,
    last_email_sent TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_subscribers_status (status)
);

-- =============================================================================
-- DATA COLLECTION & AUTOMATION
-- =============================================================================

-- Data collection jobs and status
CREATE TABLE data_collection_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type VARCHAR(50) NOT NULL, -- 'github', 'news', 'social', 'website'
    job_name VARCHAR(200),
    schedule_cron VARCHAR(50), -- Cron expression
    
    -- Configuration
    config JSONB, -- Job-specific configuration
    target_tools JSONB, -- Array of tool IDs or 'all'
    data_sources JSONB, -- Array of sources for this job
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    last_run_at TIMESTAMP,
    last_success_at TIMESTAMP,
    next_run_at TIMESTAMP,
    run_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_jobs_type (job_type),
    INDEX idx_jobs_next_run (next_run_at)
);

-- Data collection run logs
CREATE TABLE data_collection_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES data_collection_jobs(id),
    
    -- Execution details
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(20) DEFAULT 'running', -- 'running', 'completed', 'failed', 'cancelled'
    
    -- Results
    tools_processed INTEGER DEFAULT 0,
    records_created INTEGER DEFAULT 0,
    records_updated INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    
    -- Logs and data
    execution_log TEXT,
    error_details JSONB,
    summary_stats JSONB,
    
    INDEX idx_runs_job (job_id),
    INDEX idx_runs_status (status),
    INDEX idx_runs_started (started_at DESC)
);

-- API rate limiting and quotas
CREATE TABLE api_quotas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_name VARCHAR(100) NOT NULL, -- 'github', 'perplexity', 'twitter'
    quota_type VARCHAR(50), -- 'hourly', 'daily', 'monthly'
    quota_limit INTEGER,
    quota_used INTEGER DEFAULT 0,
    quota_reset_at TIMESTAMP,
    
    -- Status
    is_exceeded BOOLEAN DEFAULT FALSE,
    last_request_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    UNIQUE(service_name, quota_type),
    INDEX idx_quotas_reset (quota_reset_at)
);

-- =============================================================================
-- INDEXES FOR PERFORMANCE
-- =============================================================================

-- Additional composite indexes for temporal queries
CREATE INDEX idx_tools_category_status ON tools(category, status);
CREATE INDEX idx_tools_company_category ON tools(company_id, category);
CREATE INDEX idx_ranking_cache_period_position ON ranking_cache(period, position);
CREATE INDEX idx_news_tools_published ON news_updates USING GIN(related_tools) WHERE published_at > NOW() - INTERVAL '6 months';

-- Temporal metrics indexes for ranking calculations
CREATE INDEX idx_metrics_temporal_lookup ON metrics_history(tool_id, metric_key, recorded_at DESC) WHERE replaced_by IS NULL;
CREATE INDEX idx_metrics_recorded_date ON metrics_history(recorded_at DESC) WHERE replaced_by IS NULL;
CREATE INDEX idx_metrics_algorithm_factor ON metrics_history(tool_id, recorded_at DESC) 
    WHERE replaced_by IS NULL 
    AND metric_key IN (
        SELECT metric_key FROM metric_definitions WHERE algorithm_factor IS NOT NULL
    );

-- Editorial content indexes
CREATE INDEX idx_editorial_period_tool ON ranking_editorial(period, tool_id);
CREATE INDEX idx_editorial_updated ON ranking_editorial(last_updated DESC);

-- Full-text search indexes
CREATE INDEX idx_tools_search ON tools USING GIN(to_tsvector('english', name || ' ' || COALESCE(description, '')));
CREATE INDEX idx_news_search ON news_updates USING GIN(to_tsvector('english', title || ' ' || COALESCE(summary, '')));

-- =============================================================================
-- SAMPLE DATA & INITIAL SETUP
-- =============================================================================

-- Insert sample algorithm version
INSERT INTO algorithm_versions (version, name, description, weights, active_from, is_active) VALUES (
    'v3.2',
    'Balanced Multi-Factor Algorithm',
    'Comprehensive ranking algorithm balancing market dynamics with technical capabilities',
    '{
        "market_traction": 0.25,
        "technical_capability": 0.20,
        "developer_adoption": 0.20,
        "development_velocity": 0.15,
        "platform_resilience": 0.10,
        "community_sentiment": 0.10
    }',
    '2025-06-01',
    true
);

-- Insert sample companies
INSERT INTO companies (name, slug, website_url, company_type, headquarters) VALUES
    ('Anysphere Inc.', 'anysphere', 'https://cursor.com', 'startup', 'San Francisco, CA'),
    ('Anthropic', 'anthropic', 'https://anthropic.com', 'startup', 'San Francisco, CA'),
    ('GitHub (Microsoft)', 'github', 'https://github.com', 'public', 'San Francisco, CA'),
    ('Google', 'google', 'https://google.com', 'public', 'Mountain View, CA'),
    ('Codeium Inc.', 'codeium', 'https://codeium.com', 'startup', 'Mountain View, CA');

-- Sample metric definitions to show the flexible structure
INSERT INTO metric_definitions (metric_key, metric_name, metric_category, data_type, unit, description, algorithm_factor, weight_in_factor, update_frequency) VALUES
    -- GitHub metrics (automated, frequent)
    ('github_stars', 'GitHub Stars', 'github', 'integer', 'count', 'Number of GitHub repository stars', 'developer_adoption', 0.25, 'daily'),
    ('github_forks', 'GitHub Forks', 'github', 'integer', 'count', 'Number of GitHub repository forks', 'developer_adoption', 0.15, 'daily'),
    ('github_commits_30d', 'Commits (30 days)', 'github', 'integer', 'count', 'Number of commits in last 30 days', 'development_velocity', 0.30, 'daily'),
    ('github_contributors', 'Contributors', 'github', 'integer', 'count', 'Number of unique contributors', 'development_velocity', 0.20, 'weekly'),
    
    -- Business metrics (irregular, manual/semi-automated)
    ('funding_total', 'Total Funding', 'business', 'integer', 'usd_cents', 'Total funding raised to date', 'market_traction', 0.30, 'irregular'),
    ('valuation_latest', 'Latest Valuation', 'business', 'integer', 'usd_cents', 'Most recent company valuation', 'market_traction', 0.35, 'irregular'),
    ('estimated_users', 'Estimated Users', 'business', 'integer', 'count', 'Estimated number of active users', 'market_traction', 0.25, 'monthly'),
    ('monthly_revenue', 'Monthly Revenue', 'business', 'integer', 'usd_cents', 'Estimated monthly recurring revenue', 'market_traction', 0.10, 'irregular'),
    
    -- Community metrics (mixed frequency)
    ('sentiment_score', 'Community Sentiment', 'community', 'decimal', 'score', 'Aggregate sentiment score from -1 to 1', 'community_sentiment', 0.40, 'weekly'),
    ('social_mentions_30d', 'Social Mentions (30d)', 'community', 'integer', 'count', 'Social media mentions in last 30 days', 'community_sentiment', 0.30, 'weekly'),
    ('discord_members', 'Discord Members', 'community', 'integer', 'count', 'Number of Discord community members', 'community_sentiment', 0.15, 'monthly'),
    
    -- Technical metrics (mixed frequency)
    ('swe_bench_score', 'SWE-bench Score', 'performance', 'decimal', 'percentage', 'SWE-bench benchmark performance', 'technical_capability', 0.40, 'irregular'),
    ('context_window_size', 'Context Window', 'technical', 'integer', 'tokens', 'Maximum context window size in tokens', 'technical_capability', 0.25, 'irregular'),
    ('autonomy_level', 'Autonomy Level', 'technical', 'integer', 'scale_1_10', 'Autonomy level on 1-10 scale', 'technical_capability', 0.35, 'manual'),
    
    -- Platform resilience (manual/irregular)
    ('llm_provider_count', 'LLM Providers', 'technical', 'integer', 'count', 'Number of supported LLM providers', 'platform_resilience', 0.50, 'manual'),
    ('dependency_risk_score', 'Dependency Risk', 'technical', 'decimal', 'score', 'Risk score based on platform dependencies', 'platform_resilience', 0.50, 'manual');

-- Sample tools data structure ready for implementation
-- This schema accommodates all 100+ tools identified in the research