-- AI Power Rankings - Validation Queries for POC1
-- These queries help verify that the rankings "pass the sniff test"

-- =============================================================================
-- 1. OVERALL RANKING VALIDATION
-- =============================================================================

-- Current Top 20 Rankings with detailed breakdown
SELECT 
    rc.position,
    t.name,
    t.category,
    rc.score,
    ROUND(rc.market_traction_score, 1) as market,
    ROUND(rc.technical_capability_score, 1) as tech,
    ROUND(rc.developer_adoption_score, 1) as adoption,
    ROUND(rc.development_velocity_score, 1) as velocity,
    ROUND(rc.platform_resilience_score, 1) as resilience,
    ROUND(rc.community_sentiment_score, 1) as sentiment,
    c.name as company,
    CASE 
        WHEN fr.latest_valuation > 1000000000 THEN CONCAT('$', ROUND(fr.latest_valuation/1000000000.0, 1), 'B')
        WHEN fr.latest_valuation > 1000000 THEN CONCAT('$', ROUND(fr.latest_valuation/1000000.0, 0), 'M')
        ELSE 'N/A'
    END as valuation
FROM ranking_cache rc
JOIN tools t ON rc.tool_id = t.id
LEFT JOIN companies c ON t.company_id = c.id
LEFT JOIN (
    SELECT company_id, MAX(valuation_usd) as latest_valuation
    FROM funding_rounds
    GROUP BY company_id
) fr ON c.id = fr.company_id
WHERE rc.period = 'june-2025'
ORDER BY rc.position
LIMIT 20;

-- =============================================================================
-- 2. RANKING MOVEMENT ANALYSIS
-- =============================================================================

-- Show biggest movers between periods
WITH movement AS (
    SELECT 
        t.name,
        rc1.position as march_pos,
        rc2.position as june_pos,
        rc2.position - rc1.position as movement,
        rc1.score as march_score,
        rc2.score as june_score,
        ROUND(rc2.score - rc1.score, 2) as score_change
    FROM ranking_cache rc1
    JOIN ranking_cache rc2 ON rc1.tool_id = rc2.tool_id
    JOIN tools t ON rc1.tool_id = t.id
    WHERE rc1.period = 'march-2025'
    AND rc2.period = 'june-2025'
)
SELECT * FROM movement
ORDER BY ABS(movement) DESC
LIMIT 10;

-- =============================================================================
-- 3. CATEGORY ANALYSIS
-- =============================================================================

-- Average scores by category
SELECT 
    t.category,
    COUNT(*) as tool_count,
    ROUND(AVG(rc.score), 2) as avg_score,
    ROUND(AVG(rc.technical_capability_score), 2) as avg_tech_score,
    ROUND(AVG(rc.developer_adoption_score), 2) as avg_adoption_score
FROM ranking_cache rc
JOIN tools t ON rc.tool_id = t.id
WHERE rc.period = 'june-2025'
GROUP BY t.category
ORDER BY avg_score DESC;

-- =============================================================================
-- 4. FUNDING VS RANKING CORRELATION
-- =============================================================================

-- Check if funding correlates with rankings appropriately
SELECT 
    rc.position,
    t.name,
    rc.score,
    rc.market_traction_score,
    CASE 
        WHEN SUM(fr.amount_usd) > 1000000000 THEN CONCAT('$', ROUND(SUM(fr.amount_usd)/1000000000.0, 1), 'B')
        WHEN SUM(fr.amount_usd) > 1000000 THEN CONCAT('$', ROUND(SUM(fr.amount_usd)/1000000.0, 0), 'M')
        ELSE '$0'
    END as total_funding,
    MAX(fr.valuation_usd)/1000000000.0 as valuation_billions
FROM ranking_cache rc
JOIN tools t ON rc.tool_id = t.id
LEFT JOIN companies c ON t.company_id = c.id
LEFT JOIN funding_rounds fr ON c.id = fr.company_id
WHERE rc.period = 'june-2025'
GROUP BY rc.position, t.name, rc.score, rc.market_traction_score
ORDER BY rc.position
LIMIT 15;

-- =============================================================================
-- 5. TECHNICAL CAPABILITY LEADERS
-- =============================================================================

-- Tools with highest technical scores (should include Claude Code, Jules)
SELECT 
    t.name,
    rc.position,
    rc.technical_capability_score,
    tc.value_decimal as swe_bench_score,
    tc2.value_number as autonomy_level
FROM ranking_cache rc
JOIN tools t ON rc.tool_id = t.id
LEFT JOIN tool_capabilities tc ON t.id = tc.tool_id AND tc.capability_type = 'swe_bench_score'
LEFT JOIN tool_capabilities tc2 ON t.id = tc2.tool_id AND tc2.capability_type = 'autonomy_level'
WHERE rc.period = 'june-2025'
ORDER BY rc.technical_capability_score DESC
LIMIT 10;

-- =============================================================================
-- 6. OPEN SOURCE VS PROPRIETARY
-- =============================================================================

-- Compare open source vs proprietary tools
SELECT 
    t.license_type,
    COUNT(*) as count,
    ROUND(AVG(rc.score), 2) as avg_score,
    ROUND(AVG(rc.developer_adoption_score), 2) as avg_adoption,
    ROUND(AVG(rc.platform_resilience_score), 2) as avg_resilience
FROM ranking_cache rc
JOIN tools t ON rc.tool_id = t.id
WHERE rc.period = 'june-2025'
GROUP BY t.license_type
ORDER BY avg_score DESC;

-- =============================================================================
-- 7. GROWTH TRAJECTORY VALIDATION
-- =============================================================================

-- Cursor's meteoric rise validation
SELECT 
    rp.display_name as period,
    rc.position,
    rc.score,
    mh1.value_integer/1000000000.0 as valuation_billions,
    mh2.value_integer/1000000.0 as arr_millions,
    mh3.value_integer as users
FROM ranking_cache rc
JOIN ranking_periods rp ON rc.period = rp.period
JOIN tools t ON rc.tool_id = t.id
LEFT JOIN LATERAL (
    SELECT value_integer FROM metrics_history 
    WHERE tool_id = t.id 
    AND metric_key = 'valuation_latest' 
    AND recorded_at <= rp.end_date
    ORDER BY recorded_at DESC LIMIT 1
) mh1 ON true
LEFT JOIN LATERAL (
    SELECT value_integer FROM metrics_history 
    WHERE tool_id = t.id 
    AND metric_key = 'monthly_arr' 
    AND recorded_at <= rp.end_date
    ORDER BY recorded_at DESC LIMIT 1
) mh2 ON true
LEFT JOIN LATERAL (
    SELECT value_integer FROM metrics_history 
    WHERE tool_id = t.id 
    AND metric_key = 'estimated_users' 
    AND recorded_at <= rp.end_date
    ORDER BY recorded_at DESC LIMIT 1
) mh3 ON true
WHERE t.id = 'cursor'
ORDER BY rp.calculation_date;

-- =============================================================================
-- 8. BENCHMARK PERFORMANCE VALIDATION
-- =============================================================================

-- SWE-bench scores should align with technical rankings
SELECT 
    t.name,
    pb.benchmark_name,
    pb.score as benchmark_score,
    rc.technical_capability_score,
    rc.position,
    pb.test_date
FROM performance_benchmarks pb
JOIN tools t ON pb.tool_id = t.id
JOIN ranking_cache rc ON t.id = rc.tool_id AND rc.period = 'june-2025'
WHERE pb.benchmark_name LIKE '%SWE-bench%'
ORDER BY pb.score DESC;

-- =============================================================================
-- 9. SENTIMENT VS PERFORMANCE
-- =============================================================================

-- Check if community sentiment aligns with tool performance
SELECT 
    t.name,
    rc.position,
    rc.community_sentiment_score,
    mh.value_decimal as raw_sentiment,
    rc.score as overall_score,
    CASE 
        WHEN rc.position <= 5 THEN 'Top 5'
        WHEN rc.position <= 10 THEN 'Top 10'
        ELSE 'Below Top 10'
    END as tier
FROM ranking_cache rc
JOIN tools t ON rc.tool_id = t.id
LEFT JOIN LATERAL (
    SELECT value_decimal FROM metrics_history
    WHERE tool_id = t.id 
    AND metric_key = 'sentiment_score'
    ORDER BY recorded_at DESC LIMIT 1
) mh ON true
WHERE rc.period = 'june-2025'
ORDER BY rc.community_sentiment_score DESC
LIMIT 15;

-- =============================================================================
-- 10. ANOMALY DETECTION
-- =============================================================================

-- Find any tools with suspicious score patterns
WITH score_analysis AS (
    SELECT 
        t.name,
        rc.score,
        rc.market_traction_score,
        rc.technical_capability_score,
        rc.developer_adoption_score,
        ABS(rc.market_traction_score - rc.technical_capability_score) as market_tech_gap,
        ABS(rc.technical_capability_score - rc.developer_adoption_score) as tech_adoption_gap
    FROM ranking_cache rc
    JOIN tools t ON rc.tool_id = t.id
    WHERE rc.period = 'june-2025'
)
SELECT * FROM score_analysis
WHERE market_tech_gap > 4 OR tech_adoption_gap > 4
ORDER BY GREATEST(market_tech_gap, tech_adoption_gap) DESC;

-- =============================================================================
-- SUMMARY DASHBOARD QUERY
-- =============================================================================

-- Executive summary of current rankings
WITH summary AS (
    SELECT 
        'Total Tools Ranked' as metric,
        COUNT(*)::text as value
    FROM ranking_cache
    WHERE period = 'june-2025'
    
    UNION ALL
    
    SELECT 
        'Average Score',
        ROUND(AVG(score), 2)::text
    FROM ranking_cache
    WHERE period = 'june-2025'
    
    UNION ALL
    
    SELECT 
        'Top Tool',
        t.name || ' (' || rc.score || ')'
    FROM ranking_cache rc
    JOIN tools t ON rc.tool_id = t.id
    WHERE period = 'june-2025' AND position = 1
    
    UNION ALL
    
    SELECT 
        'Highest Valuation',
        t.name || ' ($' || ROUND(MAX(fr.valuation_usd)/1000000000.0, 1) || 'B)'
    FROM tools t
    JOIN companies c ON t.company_id = c.id
    JOIN funding_rounds fr ON c.id = fr.company_id
    GROUP BY t.name
    ORDER BY MAX(fr.valuation_usd) DESC
    LIMIT 1
    
    UNION ALL
    
    SELECT 
        'Best SWE-bench Score',
        t.name || ' (' || pb.score || '%)'
    FROM performance_benchmarks pb
    JOIN tools t ON pb.tool_id = t.id
    WHERE benchmark_name LIKE '%SWE-bench%'
    ORDER BY score DESC
    LIMIT 1
)
SELECT * FROM summary;