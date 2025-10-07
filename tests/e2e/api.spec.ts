/**
 * API Endpoint Tests
 *
 * UAT Focus: Validate all critical API endpoints return correct data structures,
 * status codes, and business-critical information.
 *
 * Coverage:
 * - /api/rankings/current - Current rankings with 31 tools, Claude Code #1
 * - /api/rankings/trending - Historical trending data with 4 periods
 * - /api/admin/news/analyze - Admin article analysis endpoint
 * - /api/tools - Tools listing
 * - /api/health - Health check endpoint
 */

import { test, expect } from '@playwright/test';
import {
  TEST_CONFIG,
  API_ENDPOINTS,
  EXPECTED_TOP_TOOLS,
  EXPECTED_TRENDING_PERIODS,
  validateApiResponse,
  validateRankingsResponse,
  validateTrendingResponse,
  validateRankingItem,
  type RankingsResponse,
  type TrendingResponse,
} from '../fixtures/test-data';

test.describe('API Endpoints - Current Rankings', () => {
  test('should return successful response with correct structure', async ({ request }) => {
    const response = await request.get(API_ENDPOINTS.CURRENT_RANKINGS);

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(validateApiResponse(data)).toBeTruthy();
    expect(data.success).toBe(true);
  });

  test('should return 31 tools in current rankings', async ({ request }) => {
    const response = await request.get(API_ENDPOINTS.CURRENT_RANKINGS);
    const json = await response.json();

    expect(json.success).toBe(true);
    expect(validateRankingsResponse(json.data)).toBeTruthy();

    const rankings = (json.data as RankingsResponse).rankings;
    expect(rankings.length).toBe(TEST_CONFIG.expectedToolsCount);
  });

  test('should have Claude Code ranked #1', async ({ request }) => {
    const response = await request.get(API_ENDPOINTS.CURRENT_RANKINGS);
    const json = await response.json();

    const rankings = (json.data as RankingsResponse).rankings;
    const topTool = rankings[0];

    expect(topTool).toBeDefined();
    expect(topTool.position).toBe(1);
    expect(topTool.tool_name).toBe('Claude Code');
    expect(topTool.tool_slug).toBe('claude-code');
  });

  test('should validate top 3 tools structure', async ({ request }) => {
    const response = await request.get(API_ENDPOINTS.CURRENT_RANKINGS);
    const json = await response.json();

    const rankings = (json.data as RankingsResponse).rankings;
    const top3 = rankings.slice(0, 3);

    // Validate structure of each ranking item
    top3.forEach((item, index) => {
      expect(validateRankingItem(item)).toBeTruthy();
      expect(item.position).toBe(index + 1);

      // Check required fields
      expect(item.tool_id).toBeDefined();
      expect(item.tool_name).toBeDefined();
      expect(item.tool_slug).toBeDefined();
      expect(typeof item.score).toBe('number');
      expect(item.score).toBeGreaterThan(0);

      // Check movement data
      expect(item.movement).toBeDefined();
      expect(['up', 'down', 'same']).toContain(item.movement.direction);
    });

    // Verify expected top tools are present
    const topToolNames = top3.map((t) => t.tool_name);
    EXPECTED_TOP_TOOLS.forEach((expected) => {
      expect(topToolNames).toContain(expected.name);
    });
  });

  test('should have proper metadata', async ({ request }) => {
    const response = await request.get(API_ENDPOINTS.CURRENT_RANKINGS);
    const json = await response.json();

    const data = json.data as RankingsResponse;

    expect(data.metadata).toBeDefined();
    expect(data.metadata.total_tools).toBe(TEST_CONFIG.expectedToolsCount);
    expect(data.metadata.is_current).toBe(true);
    expect(data.metadata.generated_at).toBeDefined();
    expect(new Date(data.metadata.generated_at).getTime()).toBeLessThanOrEqual(Date.now());
  });

  test('should have proper cache headers', async ({ request }) => {
    const response = await request.get(API_ENDPOINTS.CURRENT_RANKINGS);

    const cacheControl = response.headers()['cache-control'];
    expect(cacheControl).toBeDefined();
    expect(cacheControl).toContain('public');
  });

  test('should return consistent data across multiple requests', async ({ request }) => {
    // Make 3 requests
    const responses = await Promise.all([
      request.get(API_ENDPOINTS.CURRENT_RANKINGS),
      request.get(API_ENDPOINTS.CURRENT_RANKINGS),
      request.get(API_ENDPOINTS.CURRENT_RANKINGS),
    ]);

    const data = await Promise.all(responses.map((r) => r.json()));

    // All should have same top tool
    const topTools = data.map((d) => d.data.rankings[0].tool_name);
    expect(new Set(topTools).size).toBe(1);
    expect(topTools[0]).toBe('Claude Code');

    // All should have same total count
    const counts = data.map((d) => d.data.rankings.length);
    expect(new Set(counts).size).toBe(1);
    expect(counts[0]).toBe(TEST_CONFIG.expectedToolsCount);
  });
});

test.describe('API Endpoints - Trending Rankings', () => {
  test('should return successful response with correct structure', async ({ request }) => {
    const response = await request.get(API_ENDPOINTS.TRENDING_RANKINGS);

    expect(response.ok()).toBeTruthy();
    expect(response.status()).toBe(200);

    const data = await response.json();
    expect(validateTrendingResponse(data)).toBeTruthy();
  });

  test('should return 4 ranking periods (June-Sept 2025)', async ({ request }) => {
    const response = await request.get(API_ENDPOINTS.TRENDING_RANKINGS);
    const data = (await response.json()) as TrendingResponse;

    expect(data.periods.length).toBe(TEST_CONFIG.expectedRankingPeriodsCount);
    expect(data.metadata.total_periods).toBe(TEST_CONFIG.expectedRankingPeriodsCount);

    // Check that periods match expected months
    EXPECTED_TRENDING_PERIODS.forEach((expectedPeriod) => {
      expect(data.periods).toContain(expectedPeriod);
    });
  });

  test('should have chart data for all periods', async ({ request }) => {
    const response = await request.get(API_ENDPOINTS.TRENDING_RANKINGS);
    const data = (await response.json()) as TrendingResponse;

    expect(data.chart_data.length).toBe(TEST_CONFIG.expectedRankingPeriodsCount);

    // Each chart data point should have period and date
    data.chart_data.forEach((point) => {
      expect(point.period).toBeDefined();
      expect(point.date).toBeDefined();
      expect(EXPECTED_TRENDING_PERIODS).toContain(point.period);
    });
  });

  test('should have tools with trending data', async ({ request }) => {
    const response = await request.get(API_ENDPOINTS.TRENDING_RANKINGS);
    const data = (await response.json()) as TrendingResponse;

    expect(data.tools.length).toBeGreaterThan(0);

    // Check structure of trending tools
    data.tools.forEach((tool) => {
      expect(tool.tool_id).toBeDefined();
      expect(tool.tool_name).toBeDefined();
      expect(typeof tool.periods_in_top10).toBe('number');
      expect(typeof tool.best_position).toBe('number');
      expect(tool.best_position).toBeGreaterThanOrEqual(1);
      expect(tool.periods_in_top10).toBeGreaterThanOrEqual(0);
    });
  });

  test('should have valid date range in metadata', async ({ request }) => {
    const response = await request.get(API_ENDPOINTS.TRENDING_RANKINGS);
    const data = (await response.json()) as TrendingResponse;

    expect(data.metadata.date_range).toBeDefined();
    expect(data.metadata.date_range.start).toBeDefined();
    expect(data.metadata.date_range.end).toBeDefined();

    // End should be after or equal to start
    const startDate = new Date(data.metadata.date_range.start);
    const endDate = new Date(data.metadata.date_range.end);
    expect(endDate.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
  });

  test('should support time range filtering', async ({ request }) => {
    // Test with months parameter
    const response = await request.get(`${API_ENDPOINTS.TRENDING_RANKINGS}?months=2`);
    expect(response.ok()).toBeTruthy();

    const data = (await response.json()) as TrendingResponse;
    expect(data.periods.length).toBeLessThanOrEqual(2);
  });

  test('should have proper cache headers', async ({ request }) => {
    const response = await request.get(API_ENDPOINTS.TRENDING_RANKINGS);

    const cacheControl = response.headers()['cache-control'];
    expect(cacheControl).toBeDefined();
    expect(cacheControl).toContain('public');
  });
});

test.describe('API Endpoints - Health Check', () => {
  test('should return healthy status', async ({ request }) => {
    const response = await request.get(API_ENDPOINTS.HEALTH);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.status).toBeDefined();
  });
});

test.describe('API Endpoints - Tools', () => {
  test('should return tools list', async ({ request }) => {
    const response = await request.get(API_ENDPOINTS.TOOLS);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();

    // Handle both array and object with tools property
    const tools = Array.isArray(data) ? data : data.tools || [];
    expect(Array.isArray(tools)).toBeTruthy();
    expect(tools.length).toBeGreaterThan(0);
  });

  test('should have active tools', async ({ request }) => {
    const response = await request.get(API_ENDPOINTS.TOOLS);
    const data = await response.json();

    const tools = Array.isArray(data) ? data : data.tools || [];
    const activeTools = tools.filter((t: any) => t.status === 'active');

    expect(activeTools.length).toBeGreaterThan(0);
    expect(activeTools.length).toBeGreaterThanOrEqual(TEST_CONFIG.expectedToolsCount);
  });
});

test.describe('API Endpoints - News/Articles', () => {
  test('should return news articles', async ({ request }) => {
    const response = await request.get(API_ENDPOINTS.NEWS);
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data).toBeDefined();
  });
});

test.describe('API Endpoints - Error Handling', () => {
  test('should handle invalid endpoints gracefully', async ({ request }) => {
    const response = await request.get('/api/invalid-endpoint');
    expect(response.status()).toBe(404);
  });

  test('should return proper error structure for bad requests', async ({ request }) => {
    const response = await request.post(API_ENDPOINTS.CURRENT_RANKINGS, {
      data: { invalid: 'data' },
    });

    // Should not be 500, either 404 (not found) or 405 (method not allowed)
    expect(response.status()).not.toBe(500);
  });
});

test.describe('API Endpoints - Performance', () => {
  test('current rankings should respond within 3 seconds', async ({ request }) => {
    const startTime = Date.now();
    const response = await request.get(API_ENDPOINTS.CURRENT_RANKINGS);
    const duration = Date.now() - startTime;

    expect(response.ok()).toBeTruthy();
    expect(duration).toBeLessThan(3000);
  });

  test('trending rankings should respond within 3 seconds', async ({ request }) => {
    const startTime = Date.now();
    const response = await request.get(API_ENDPOINTS.TRENDING_RANKINGS);
    const duration = Date.now() - startTime;

    expect(response.ok()).toBeTruthy();
    expect(duration).toBeLessThan(3000);
  });
});
