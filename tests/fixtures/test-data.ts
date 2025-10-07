/**
 * Test Fixtures and Helper Functions
 *
 * This file contains reusable test data, helper functions, and validation utilities
 * for the AI Power Ranking UAT test suite.
 */

export const TEST_CONFIG = {
  baseUrl: process.env.BASE_URL || 'http://localhost:3011',
  apiTimeout: 10000,
  navigationTimeout: 30000,
  expectedArticleCount: 296,
  expectedRankingPeriodsCount: 4,
  expectedToolsCount: 31,
} as const;

export const LOCALES = {
  ENGLISH: 'en',
  JAPANESE: 'ja',
} as const;

export const API_ENDPOINTS = {
  CURRENT_RANKINGS: '/api/rankings/current',
  TRENDING_RANKINGS: '/api/rankings/trending',
  ADMIN_NEWS_ANALYZE: '/api/admin/news/analyze',
  ADMIN_ARTICLES: '/api/admin/articles',
  TOOLS: '/api/tools',
  NEWS: '/api/news',
  HEALTH: '/api/health',
} as const;

export const PAGES = {
  HOME: (locale: string) => `/${locale}`,
  RANKINGS: (locale: string) => `/${locale}/rankings`,
  TRENDING: (locale: string) => `/${locale}/trending`,
  ADMIN: (locale: string) => `/${locale}/admin`,
  ADMIN_NEWS: (locale: string) => `/${locale}/admin/news`,
  ABOUT: (locale: string) => `/${locale}/about`,
  METHODOLOGY: (locale: string) => `/${locale}/methodology`,
} as const;

// Expected top tools
export const EXPECTED_TOP_TOOLS = [
  {
    rank: 1,
    name: 'Claude Code',
    slug: 'claude-code',
  },
  {
    rank: 2,
    name: 'GitHub Copilot',
    slug: 'github-copilot',
  },
  {
    rank: 3,
    name: 'Cursor',
    slug: 'cursor',
  },
] as const;

// Tool categories
export const TOOL_CATEGORIES = [
  'ide-assistant',
  'code-editor',
  'app-builder',
  'autonomous-agent',
  'testing-tool',
  'code-review',
  'devops-assistant',
  'open-source-framework',
] as const;

// Expected trending periods (June-Sept 2025)
export const EXPECTED_TRENDING_PERIODS = [
  '2025-06',
  '2025-07',
  '2025-08',
  '2025-09',
] as const;

/**
 * API Response Types
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp: string;
}

export interface RankingItem {
  tool_id: string;
  tool_name: string;
  tool_slug: string;
  position: number;
  score: number;
  tier: string;
  factor_scores: Record<string, number>;
  movement: {
    previous_position: number | null;
    change: number;
    direction: 'up' | 'down' | 'same';
  };
  category: string;
  status: string;
}

export interface RankingsResponse {
  period: string;
  algorithm_version: string;
  rankings: RankingItem[];
  metadata: {
    total_tools: number;
    generated_at: string;
    is_current: boolean;
  };
}

export interface TrendingPeriod {
  period: string;
  date: string;
  [tool_id: string]: number | string | null; // Tool positions by ID
}

export interface TrendingTool {
  tool_id: string;
  tool_name: string;
  periods_in_top10: number;
  best_position: number;
  current_position: number | null;
}

export interface TrendingResponse {
  periods: string[];
  tools: TrendingTool[];
  chart_data: TrendingPeriod[];
  metadata: {
    total_periods: number;
    date_range: {
      start: string;
      end: string;
    };
    top_tools_count: number;
  };
}

/**
 * Validation Helper Functions
 */

/**
 * Validate API response structure
 */
export function validateApiResponse<T>(
  response: any,
  expectedDataFields?: (keyof T)[]
): response is ApiResponse<T> {
  if (typeof response !== 'object' || response === null) {
    return false;
  }

  // Check required fields
  if (!('timestamp' in response)) {
    return false;
  }

  // If success is present, validate based on success/failure structure
  if ('success' in response) {
    if (response.success === true) {
      if (!('data' in response)) {
        return false;
      }
    } else {
      if (!('error' in response || 'message' in response)) {
        return false;
      }
    }
  }

  // Validate expected data fields if provided
  if (expectedDataFields && response.data) {
    for (const field of expectedDataFields) {
      if (!(field in response.data)) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Validate rankings response structure
 */
export function validateRankingsResponse(data: any): data is RankingsResponse {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  // Check required top-level fields
  if (!('period' in data) || !('algorithm_version' in data) || !('rankings' in data) || !('metadata' in data)) {
    return false;
  }

  // Check rankings array
  if (!Array.isArray(data.rankings)) {
    return false;
  }

  // Validate metadata
  const metadata = data.metadata;
  if (
    typeof metadata !== 'object' ||
    !('total_tools' in metadata) ||
    !('generated_at' in metadata) ||
    !('is_current' in metadata)
  ) {
    return false;
  }

  return true;
}

/**
 * Validate trending response structure
 */
export function validateTrendingResponse(data: any): data is TrendingResponse {
  if (typeof data !== 'object' || data === null) {
    return false;
  }

  // Check required top-level fields
  if (!('periods' in data) || !('tools' in data) || !('chart_data' in data) || !('metadata' in data)) {
    return false;
  }

  // Check arrays
  if (!Array.isArray(data.periods) || !Array.isArray(data.tools) || !Array.isArray(data.chart_data)) {
    return false;
  }

  // Validate metadata
  const metadata = data.metadata;
  if (
    typeof metadata !== 'object' ||
    !('total_periods' in metadata) ||
    !('date_range' in metadata) ||
    !('top_tools_count' in metadata)
  ) {
    return false;
  }

  return true;
}

/**
 * Validate ranking item structure
 */
export function validateRankingItem(item: any): item is RankingItem {
  return (
    typeof item === 'object' &&
    item !== null &&
    'tool_id' in item &&
    'tool_name' in item &&
    'position' in item &&
    'score' in item &&
    typeof item.position === 'number' &&
    typeof item.score === 'number'
  );
}

/**
 * Check if tool is in expected top 3
 */
export function isExpectedTopTool(toolName: string): boolean {
  return EXPECTED_TOP_TOOLS.some((tool) => tool.name === toolName);
}

/**
 * Wait for element with retry logic
 */
export async function waitForElement(
  page: any,
  selector: string,
  options?: { timeout?: number; visible?: boolean }
): Promise<boolean> {
  try {
    await page.waitForSelector(selector, {
      timeout: options?.timeout || 10000,
      state: options?.visible ? 'visible' : 'attached',
    });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Check for console errors
 */
export function setupConsoleErrorTracking(page: any): { errors: string[] } {
  const errors: string[] = [];

  page.on('console', (msg: any) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  page.on('pageerror', (error: Error) => {
    errors.push(error.message);
  });

  return { errors };
}

/**
 * Wait for network idle
 */
export async function waitForNetworkIdle(page: any, timeout = 15000): Promise<void> {
  try {
    await page.waitForLoadState('networkidle', { timeout });
  } catch (error) {
    // Timeout is acceptable in some cases
    console.warn('Network idle timeout:', error);
  }
}

/**
 * Take screenshot with timestamp
 */
export async function takeTimestampedScreenshot(page: any, name: string): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  await page.screenshot({ path: `test-results/screenshots/${name}-${timestamp}.png`, fullPage: true });
}

/**
 * Get text content safely
 */
export async function getTextContent(page: any, selector: string): Promise<string | null> {
  try {
    const element = await page.locator(selector).first();
    return await element.textContent();
  } catch (error) {
    return null;
  }
}

/**
 * Check if element exists
 */
export async function elementExists(page: any, selector: string): Promise<boolean> {
  try {
    const count = await page.locator(selector).count();
    return count > 0;
  } catch (error) {
    return false;
  }
}

/**
 * Retry operation with exponential backoff
 */
export async function retry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> {
  let lastError: Error | unknown;

  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (i < maxRetries - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(2, i)));
      }
    }
  }

  throw lastError;
}
