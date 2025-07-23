#!/usr/bin/env tsx
/**
 * Test script for news API endpoints
 *
 * Tests the JSON-based news API endpoints
 */

import { loggers } from "../src/lib/logger";

const logger = loggers.test;

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

async function testNewsAPI() {
  logger.info("Testing news API endpoints...");

  const tests = [
    {
      name: "Get all news",
      endpoint: "/api/news/json",
      expectedFields: ["news", "total", "page", "totalPages", "hasMore"],
    },
    {
      name: "Get news with pagination",
      endpoint: "/api/news/json?limit=5&page=2",
      expectedFields: ["news", "total", "page", "totalPages", "hasMore"],
    },
    {
      name: "Get news with filter",
      endpoint: "/api/news/json?filter=milestone",
      expectedFields: ["news", "total"],
    },
    {
      name: "Search news",
      endpoint: "/api/news/json?search=funding",
      expectedFields: ["news", "total"],
    },
    {
      name: "Get recent news",
      endpoint: "/api/news/recent?limit=5",
      expectedFields: ["articles", "count"],
    },
    {
      name: "Get available dates",
      endpoint: "/api/news/by-date?availableOnly=true",
      expectedFields: ["dates", "total"],
    },
    {
      name: "Get news by date",
      endpoint: "/api/news/by-date?date=2025-06",
      expectedFields: ["articles", "count", "date"],
    },
    {
      name: "Get all tags",
      endpoint: "/api/news/tags",
      expectedFields: ["tags", "total"],
    },
  ];

  let passed = 0;
  let failed = 0;

  for (const test of tests) {
    try {
      logger.info(`Testing: ${test.name}`);

      const response = await fetch(`${BASE_URL}${test.endpoint}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${data.error || "Unknown error"}`);
      }

      // Check expected fields
      const missingFields = test.expectedFields.filter((field) => !(field in data));

      if (missingFields.length > 0) {
        throw new Error(`Missing fields: ${missingFields.join(", ")}`);
      }

      logger.info(`✅ ${test.name} - PASSED`, {
        status: response.status,
        dataKeys: Object.keys(data),
      });

      passed++;
    } catch (error) {
      logger.error(`❌ ${test.name} - FAILED`, { error });
      failed++;
    }
  }

  // Test single article endpoint if we have articles
  try {
    const listResponse = await fetch(`${BASE_URL}/api/news/json?limit=1`);
    const listData = await listResponse.json();

    if (listData.news && listData.news.length > 0) {
      const articleId = listData.news[0].id;

      logger.info("Testing single article endpoint...");
      const articleResponse = await fetch(`${BASE_URL}/api/news/${articleId}`);
      const articleData = await articleResponse.json();

      if (!articleResponse.ok) {
        throw new Error(`HTTP ${articleResponse.status}: ${articleData.error || "Unknown error"}`);
      }

      if (!articleData.article) {
        throw new Error("Missing article field");
      }

      logger.info("✅ Single article endpoint - PASSED");
      passed++;
    }
  } catch (error) {
    logger.error("❌ Single article endpoint - FAILED", { error });
    failed++;
  }

  // Summary
  logger.info("\n=== Test Summary ===");
  logger.info(`Total tests: ${passed + failed}`);
  logger.info(`Passed: ${passed}`);
  logger.info(`Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

// Run tests
testNewsAPI()
  .then(() => {
    logger.info("All tests completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    logger.error("Test suite failed", { error });
    process.exit(1);
  });
