/**
 * Example Test File
 *
 * This demonstrates the ONLY proper way to use mock data - in test files.
 * Mock data should NEVER be used in development or production code.
 */

import { getMockRankingsResponse } from './mock-rankings';

describe('Rankings API Tests', () => {
  // Set NODE_ENV to 'test' for testing
  const originalEnv = process.env.NODE_ENV;

  beforeAll(() => {
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('should return mock rankings in test environment', () => {
    const mockData = getMockRankingsResponse();

    expect(mockData).toBeDefined();
    expect(mockData.rankings).toHaveLength(10);
    expect(mockData._isTest).toBe(true);
    expect(mockData._source).toBe('test-mock');
  });

  it('should have correct structure for mock rankings', () => {
    const mockData = getMockRankingsResponse();
    const firstRanking = mockData.rankings[0];

    expect(firstRanking).toHaveProperty('rank');
    expect(firstRanking).toHaveProperty('tool');
    expect(firstRanking).toHaveProperty('scores');
    expect(firstRanking).toHaveProperty('metrics');
  });
});

/**
 * IMPORTANT: Mock data usage rules
 *
 * ✅ DO use mock data:
 * - In unit tests (NODE_ENV === 'test')
 * - In integration tests
 * - For testing edge cases
 *
 * ❌ DON'T use mock data:
 * - In development mode as a fallback
 * - In production code
 * - As a substitute for database connection
 *
 * If you need data in development, configure a real database:
 * 1. Copy .env.example to .env.local
 * 2. Set DATABASE_URL with your connection string
 * 3. Visit https://neon.tech for a free database
 */