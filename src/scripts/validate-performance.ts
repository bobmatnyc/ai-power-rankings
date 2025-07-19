#!/usr/bin/env tsx
/**
 * Performance Validation Script
 * Tests API response times and validates performance requirements
 */

import { loggers } from "../lib/logger";

const API_ENDPOINTS = [
  { path: "/api/tools", maxTime: 100 },
  { path: "/api/rankings", maxTime: 100 },
  { path: "/api/news", maxTime: 100 },
  { path: "/api/companies", maxTime: 100 },
];

const BASE_URL = process.env["BASE_URL"] || "http://localhost:3001";

interface PerformanceResult {
  endpoint: string;
  responseTime: number;
  size: number;
  passed: boolean;
  cached: boolean;
}

async function testEndpoint(endpoint: {
  path: string;
  maxTime: number;
}): Promise<PerformanceResult> {
  const url = `${BASE_URL}${endpoint.path}`;

  try {
    // First request (cold)
    const start1 = Date.now();
    const response1 = await fetch(url);
    const data1 = await response1.text();
    const time1 = Date.now() - start1;

    // Second request (should be cached)
    const start2 = Date.now();
    const response2 = await fetch(url);
    await response2.text();
    const time2 = Date.now() - start2;

    const isCached = time2 < time1 * 0.5; // Cached if 50% faster
    const responseTime = Math.min(time1, time2);

    return {
      endpoint: endpoint.path,
      responseTime,
      size: data1.length,
      passed: responseTime <= endpoint.maxTime,
      cached: isCached,
    };
  } catch (error) {
    loggers.performance.error(`Failed to test ${endpoint.path}`, { error });
    return {
      endpoint: endpoint.path,
      responseTime: -1,
      size: 0,
      passed: false,
      cached: false,
    };
  }
}

async function validatePerformance() {
  console.log("🚀 Performance Validation\n");
  console.log(`Testing against: ${BASE_URL}\n`);

  const results: PerformanceResult[] = [];

  // Test each endpoint
  for (const endpoint of API_ENDPOINTS) {
    process.stdout.write(`Testing ${endpoint.path}... `);
    const result = await testEndpoint(endpoint);
    results.push(result);

    if (result.passed) {
      console.log(`✅ ${result.responseTime}ms (${(result.size / 1024).toFixed(1)}KB)`);
    } else {
      console.log(`❌ ${result.responseTime}ms - FAILED (max: ${endpoint.maxTime}ms)`);
    }
  }

  // Summary
  console.log("\n📊 Performance Summary\n");

  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  const avgTime = results.reduce((sum, r) => sum + r.responseTime, 0) / total;
  const totalSize = results.reduce((sum, r) => sum + r.size, 0);

  console.log(`Endpoints tested: ${total}`);
  console.log(`Passed: ${passed}/${total} (${((passed / total) * 100).toFixed(0)}%)`);
  console.log(`Average response time: ${avgTime.toFixed(0)}ms`);
  console.log(`Total data size: ${(totalSize / 1024).toFixed(1)}KB`);
  console.log(`Caching working: ${results.filter((r) => r.cached).length}/${total}`);

  // Recommendations
  if (avgTime > 100) {
    console.log("\n⚠️  Warning: Average response time exceeds 100ms target");
  }

  const failedEndpoints = results.filter((r) => !r.passed);
  if (failedEndpoints.length > 0) {
    console.log("\n❌ Failed endpoints:");
    failedEndpoints.forEach((e) => {
      console.log(`   - ${e.endpoint}: ${e.responseTime}ms`);
    });
  }

  return passed === total;
}

// Run if called directly
if (require.main === module) {
  validatePerformance()
    .then((success) => {
      if (success) {
        console.log("\n✅ All performance tests passed!");
        process.exit(0);
      } else {
        console.log("\n❌ Some performance tests failed");
        process.exit(1);
      }
    })
    .catch((error) => {
      console.error("❌ Performance validation error:", error);
      process.exit(1);
    });
}
