-- AI Power Rankings - Zeitgeist-Based Ranking Algorithm
-- Based on ALGORITHM.md specifications

-- Category multipliers for normalization
CREATE TABLE IF NOT EXISTS category_multipliers (
    category VARCHAR(50) PRIMARY KEY,
    multiplier DECIMAL(3,2) DEFAULT 1.0,
    description TEXT
);

INSERT INTO category_multipliers (category, multiplier, description) VALUES
('code-editor', 1.0, 'Full IDEs with AI integration'),
('code-completion', 0.9, 'Inline code completion tools'),
('agent-framework', 1.2, 'Autonomous coding agents'),
('testing-tools', 0.8, 'AI-powered testing tools'),
('documentation', 0.7, 'Documentation generators'),
('code-review', 0.8, 'Automated code review tools'),
('refactoring', 0.8, 'Code refactoring assistants'),
('cli-tools', 0.9, 'Command-line AI tools'),
('browser-extension', 0.7, 'Browser-based coding tools'),
('api-client', 0.6, 'API and SDK generators')
ON CONFLICT (category) DO UPDATE SET multiplier = EXCLUDED.multiplier;

-- Algorithm configuration
CREATE TABLE IF NOT EXISTS algorithm_config (
    version VARCHAR(10) PRIMARY KEY,
    config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO algorithm_config (version, config, is_active) VALUES
('v1.0', '{
    "weights": {
        "momentum_signals": 0.50,
        "engagement_signals": 0.30,
        "innovation_velocity": 0.20
    },
    "momentum_metrics": {
        "github_stars_wow": 0.30,
        "github_commits_wow": 0.25,
        "downloads_growth": 0.25,
        "social_mentions_wow": 0.20
    },
    "engagement_metrics": {
        "community_size": 0.35,
        "github_contributors": 0.25,
        "social_sentiment": 0.20,
        "issue_responsiveness": 0.20
    },
    "innovation_metrics": {
        "release_frequency": 0.40,
        "feature_velocity": 0.30,
        "market_position": 0.30
    },
    "time_decay_factor": 0.95,
    "anomaly_threshold": 3.0
}', true)
ON CONFLICT (version) DO NOTHING;

-- Main ranking calculation function
CREATE OR REPLACE FUNCTION calculate_zeitgeist_rankings(
    p_period VARCHAR(20),
    p_algorithm_version VARCHAR(10) DEFAULT 'v1.0'
) RETURNS TABLE (
    tool_id VARCHAR(50),
    score DECIMAL(5,2),
    momentum_score DECIMAL(5,2),
    engagement_score DECIMAL(5,2),
    innovation_score DECIMAL(5,2),
    score_breakdown JSONB
) AS $$
DECLARE
    v_config JSONB;
    v_weights JSONB;
BEGIN
    -- Get algorithm configuration
    SELECT config INTO v_config
    FROM algorithm_config
    WHERE version = p_algorithm_version;
    
    v_weights := v_config->'weights';
    
    RETURN QUERY
    WITH 
    -- Calculate momentum scores (50% weight)
    momentum_scores AS (
        SELECT 
            t.id as tool_id,
            -- GitHub stars momentum
            COALESCE(calculate_wow_change(t.id, 'github_stars'), 0) * 0.30 +
            -- Commit activity momentum  
            COALESCE(calculate_wow_change(t.id, 'github_commits_30d'), 0) * 0.25 +
            -- Download growth (NPM, VS Code, etc.)
            COALESCE(
                GREATEST(
                    calculate_wow_change(t.id, 'npm_downloads_weekly'),
                    calculate_wow_change(t.id, 'vscode_installs'),
                    0
                ), 0
            ) * 0.25 +
            -- Social buzz momentum
            COALESCE(calculate_wow_change(t.id, 'social_mentions_7d'), 0) * 0.20
            AS raw_score
        FROM tools t
        WHERE t.status = 'active'
    ),
    
    -- Calculate engagement scores (30% weight)
    engagement_scores AS (
        SELECT
            t.id as tool_id,
            -- Community size (normalized 0-100)
            LEAST(
                COALESCE(
                    (get_metric_at_time(t.id, 'discord_members', NOW()) / 10000.0 * 100) * 0.35,
                    0
                ),
                35
            ) +
            -- Contributor activity
            LEAST(
                COALESCE(
                    (get_metric_at_time(t.id, 'github_contributors', NOW()) / 100.0 * 100) * 0.25,
                    0
                ),
                25
            ) +
            -- Sentiment score (already 0-1, multiply by 100)
            COALESCE(get_metric_at_time(t.id, 'sentiment_score', NOW()) * 100 * 0.20, 10) +
            -- Issue responsiveness (based on open issues ratio)
            CASE 
                WHEN get_metric_at_time(t.id, 'github_issues_open', NOW()) > 0 THEN
                    GREATEST(
                        0,
                        (1 - (get_metric_at_time(t.id, 'github_issues_open', NOW()) / 
                              NULLIF(get_metric_at_time(t.id, 'github_stars', NOW()), 0) * 100)
                        ) * 100 * 0.20
                    )
                ELSE 20
            END AS raw_score
        FROM tools t
        WHERE t.status = 'active'
    ),
    
    -- Calculate innovation velocity scores (20% weight)
    innovation_scores AS (
        SELECT
            t.id as tool_id,
            -- Release frequency score
            CASE
                WHEN get_metric_at_time(t.id, 'github_last_release_days', NOW()) <= 7 THEN 100
                WHEN get_metric_at_time(t.id, 'github_last_release_days', NOW()) <= 30 THEN 80
                WHEN get_metric_at_time(t.id, 'github_last_release_days', NOW()) <= 90 THEN 50
                ELSE 20
            END * 0.40 +
            -- Feature velocity (based on commit frequency)
            LEAST(
                COALESCE(
                    (get_metric_at_time(t.id, 'github_commits_30d', NOW()) / 100.0 * 100),
                    0
                ),
                100
            ) * 0.30 +
            -- Market position (funding as proxy)
            CASE
                WHEN c.total_funding >= 100000000 THEN 100  -- $100M+
                WHEN c.total_funding >= 50000000 THEN 80    -- $50M+
                WHEN c.total_funding >= 10000000 THEN 60    -- $10M+
                WHEN c.total_funding >= 1000000 THEN 40     -- $1M+
                WHEN t.license_type = 'open-source' THEN 50 -- OSS bonus
                ELSE 20
            END * 0.30 AS raw_score
        FROM tools t
        LEFT JOIN companies c ON t.company_id = c.id
        WHERE t.status = 'active'
    ),
    
    -- Normalize and combine scores
    normalized_scores AS (
        SELECT
            m.tool_id,
            -- Apply sigmoid normalization to prevent extreme values
            LEAST(GREATEST(m.raw_score / 2, -100), 100) as momentum_norm,
            e.raw_score as engagement_norm,
            i.raw_score as innovation_norm,
            t.category,
            cm.multiplier as category_multiplier
        FROM momentum_scores m
        JOIN engagement_scores e ON m.tool_id = e.tool_id
        JOIN innovation_scores i ON m.tool_id = i.tool_id
        JOIN tools t ON m.tool_id = t.id
        JOIN category_multipliers cm ON t.category = cm.category
    ),
    
    -- Calculate final scores
    final_scores AS (
        SELECT
            tool_id,
            -- Apply weights and category multiplier
            LEAST(
                GREATEST(
                    (
                        momentum_norm * (v_weights->>'momentum_signals')::decimal +
                        engagement_norm * (v_weights->>'engagement_signals')::decimal +
                        innovation_norm * (v_weights->>'innovation_velocity')::decimal
                    ) * category_multiplier,
                    0
                ),
                100
            ) as final_score,
            momentum_norm,
            engagement_norm,
            innovation_norm,
            jsonb_build_object(
                'momentum', jsonb_build_object(
                    'score', round(momentum_norm, 2),
                    'weight', (v_weights->>'momentum_signals')::decimal
                ),
                'engagement', jsonb_build_object(
                    'score', round(engagement_norm, 2),
                    'weight', (v_weights->>'engagement_signals')::decimal
                ),
                'innovation', jsonb_build_object(
                    'score', round(innovation_norm, 2),
                    'weight', (v_weights->>'innovation_velocity')::decimal
                ),
                'category_multiplier', category_multiplier,
                'algorithm_version', p_algorithm_version
            ) as breakdown
        FROM normalized_scores
    )
    
    SELECT
        tool_id,
        round(final_score, 2) as score,
        round(momentum_norm, 2) as momentum_score,
        round(engagement_norm, 2) as engagement_score,
        round(innovation_norm, 2) as innovation_score,
        breakdown as score_breakdown
    FROM final_scores
    ORDER BY final_score DESC;
    
END;
$$ LANGUAGE plpgsql;

-- Function to generate and store rankings for a period
CREATE OR REPLACE FUNCTION generate_rankings_for_period(
    p_period VARCHAR(20),
    p_algorithm_version VARCHAR(10) DEFAULT 'v1.0'
) RETURNS VOID AS $$
DECLARE
    v_ranking RECORD;
    v_position INTEGER := 1;
    v_previous_position INTEGER;
    v_movement VARCHAR(10);
    v_movement_positions INTEGER;
BEGIN
    -- Calculate rankings
    FOR v_ranking IN 
        SELECT * FROM calculate_zeitgeist_rankings(p_period, p_algorithm_version)
    LOOP
        -- Get previous position
        SELECT position INTO v_previous_position
        FROM rankings
        WHERE tool_id = v_ranking.tool_id
        AND period < p_period
        ORDER BY period DESC
        LIMIT 1;
        
        -- Determine movement
        IF v_previous_position IS NULL THEN
            v_movement := 'new';
            v_movement_positions := 0;
        ELSIF v_previous_position = v_position THEN
            v_movement := 'same';
            v_movement_positions := 0;
        ELSIF v_previous_position > v_position THEN
            v_movement := 'up';
            v_movement_positions := v_previous_position - v_position;
        ELSE
            v_movement := 'down';
            v_movement_positions := v_position - v_previous_position;
        END IF;
        
        -- Insert ranking
        INSERT INTO rankings (
            period,
            tool_id,
            position,
            score,
            movement,
            movement_positions,
            previous_position,
            score_breakdown,
            momentum_score,
            engagement_score,
            innovation_score,
            algorithm_version
        ) VALUES (
            p_period,
            v_ranking.tool_id,
            v_position,
            v_ranking.score,
            v_movement,
            v_movement_positions,
            v_previous_position,
            v_ranking.score_breakdown,
            v_ranking.momentum_score,
            v_ranking.engagement_score,
            v_ranking.innovation_score,
            p_algorithm_version
        )
        ON CONFLICT (period, tool_id) 
        DO UPDATE SET
            position = EXCLUDED.position,
            score = EXCLUDED.score,
            movement = EXCLUDED.movement,
            movement_positions = EXCLUDED.movement_positions,
            previous_position = EXCLUDED.previous_position,
            score_breakdown = EXCLUDED.score_breakdown,
            momentum_score = EXCLUDED.momentum_score,
            engagement_score = EXCLUDED.engagement_score,
            innovation_score = EXCLUDED.innovation_score,
            algorithm_version = EXCLUDED.algorithm_version,
            created_at = NOW();
        
        v_position := v_position + 1;
    END LOOP;
    
    -- Update ranking period
    INSERT INTO ranking_periods (
        period,
        display_name,
        publication_date,
        tools_count,
        algorithm_version,
        algorithm_config,
        is_current
    ) VALUES (
        p_period,
        TO_CHAR(TO_DATE(p_period || '-01', 'YYYY-MM-DD'), 'Month YYYY'),
        TO_DATE(p_period || '-01', 'YYYY-MM-DD'),
        v_position - 1,
        p_algorithm_version,
        (SELECT config FROM algorithm_config WHERE version = p_algorithm_version),
        TRUE
    )
    ON CONFLICT (period) 
    DO UPDATE SET
        tools_count = EXCLUDED.tools_count,
        algorithm_version = EXCLUDED.algorithm_version,
        algorithm_config = EXCLUDED.algorithm_config,
        updated_at = NOW();
    
    -- Set all other periods as not current
    UPDATE ranking_periods 
    SET is_current = FALSE 
    WHERE period != p_period;
    
END;
$$ LANGUAGE plpgsql;

-- Validation query to check rankings
CREATE OR REPLACE VIEW ranking_validation AS
WITH current_rankings AS (
    SELECT 
        r.position,
        t.name,
        t.category,
        r.score,
        r.momentum_score,
        r.engagement_score,
        r.innovation_score,
        r.movement,
        r.movement_positions,
        r.score_breakdown
    FROM rankings r
    JOIN tools t ON r.tool_id = t.id
    JOIN ranking_periods rp ON r.period = rp.period
    WHERE rp.is_current = TRUE
    ORDER BY r.position
)
SELECT * FROM current_rankings;