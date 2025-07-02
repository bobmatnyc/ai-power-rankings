#!/usr/bin/env tsx

/**
 * Test script for rate limiting functionality
 * 
 * Usage:
 *   npm run test:rate-limit
 *   tsx scripts/test-rate-limiting.ts
 */

import { config } from "dotenv";

// Load environment variables
config({ path: ".env.local" });

const BASE_URL = process.env["NEXT_PUBLIC_BASE_URL"] || "http://localhost:3000";
const ADMIN_API_KEY = process.env["ADMIN_API_KEY"];

interface TestResult {
  test: string;
  success: boolean;
  message: string;
  data?: unknown;
}

async function makeContactRequest(data: Record<string, unknown>, headers: Record<string, string> = {}): Promise<Response> {
  return fetch(`${BASE_URL}/api/contact`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify(data),
  });
}

async function makeAdminRequest(endpoint: string, method: string = "GET", body?: Record<string, unknown>): Promise<Response> {
  const url = `${BASE_URL}/api/admin/rate-limit${endpoint}`;
  const options: RequestInit = {
    method,
    headers: {
      "Authorization": `Bearer ${ADMIN_API_KEY}`,
      "Content-Type": "application/json",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  return fetch(url, options);
}

async function testNormalSubmission(): Promise<TestResult> {
  try {
    const response = await makeContactRequest({
      name: "Test User",
      email: "test@example.com",
      category: "general",
      message: "This is a test message for rate limiting.",
    });

    const data = await response.json();
    const rateLimitHeaders = {
      limit: response.headers.get("X-RateLimit-Limit"),
      remaining: response.headers.get("X-RateLimit-Remaining"),
      reset: response.headers.get("X-RateLimit-Reset"),
    };

    if (response.ok) {
      return {
        test: "Normal Submission",
        success: true,
        message: "Contact form submission successful",
        data: { response: data, headers: rateLimitHeaders },
      };
    } else {
      return {
        test: "Normal Submission",
        success: false,
        message: `Submission failed: ${data.error}`,
        data: { response: data, headers: rateLimitHeaders },
      };
    }
  } catch (error) {
    return {
      test: "Normal Submission",
      success: false,
      message: `Request failed: ${error}`,
    };
  }
}

async function testAdminBypass(): Promise<TestResult> {
  try {
    const response = await makeContactRequest({
      name: "Admin User",
      email: "bob@matsuoka.com", // Admin email
      category: "general",
      message: "This is a test message from admin user.",
    });

    const data = await response.json();
    const rateLimitHeaders = {
      limit: response.headers.get("X-RateLimit-Limit"),
      remaining: response.headers.get("X-RateLimit-Remaining"),
      reset: response.headers.get("X-RateLimit-Reset"),
    };

    if (response.ok && rateLimitHeaders.limit === "999") {
      return {
        test: "Admin Bypass",
        success: true,
        message: "Admin user successfully bypassed rate limits",
        data: { response: data, headers: rateLimitHeaders },
      };
    } else {
      return {
        test: "Admin Bypass",
        success: false,
        message: "Admin bypass did not work as expected",
        data: { response: data, headers: rateLimitHeaders },
      };
    }
  } catch (error) {
    return {
      test: "Admin Bypass",
      success: false,
      message: `Request failed: ${error}`,
    };
  }
}

async function testRateLimitExceeded(): Promise<TestResult> {
  try {
    const testIP = "192.168.1.100";
    const results = [];

    // Make multiple requests to trigger rate limit
    for (let i = 0; i < 7; i++) {
      const response = await makeContactRequest(
        {
          name: `Test User ${i}`,
          email: `test${i}@example.com`,
          category: "general",
          message: `This is test message ${i} to trigger rate limiting.`,
        },
        {
          "X-Forwarded-For": testIP, // Simulate requests from same IP
        }
      );

      const data = await response.json();
      const rateLimitHeaders = {
        limit: response.headers.get("X-RateLimit-Limit"),
        remaining: response.headers.get("X-RateLimit-Remaining"),
        reset: response.headers.get("X-RateLimit-Reset"),
      };

      results.push({
        attempt: i + 1,
        status: response.status,
        success: response.ok,
        data,
        headers: rateLimitHeaders,
      });

      // If we hit rate limit, we can stop
      if (response.status === 429) {
        break;
      }

      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const rateLimitedAttempt = results.find(r => r.status === 429);
    
    if (rateLimitedAttempt) {
      return {
        test: "Rate Limit Exceeded",
        success: true,
        message: `Rate limit triggered after ${rateLimitedAttempt.attempt} attempts`,
        data: { results, rateLimitedAttempt },
      };
    } else {
      return {
        test: "Rate Limit Exceeded",
        success: false,
        message: "Rate limit was not triggered as expected",
        data: { results },
      };
    }
  } catch (error) {
    return {
      test: "Rate Limit Exceeded",
      success: false,
      message: `Request failed: ${error}`,
    };
  }
}

async function testAdminAnalytics(): Promise<TestResult> {
  if (!ADMIN_API_KEY) {
    return {
      test: "Admin Analytics",
      success: false,
      message: "ADMIN_API_KEY not configured",
    };
  }

  try {
    const response = await makeAdminRequest("?action=analytics");
    const data = await response.json();

    if (response.ok && data.success) {
      return {
        test: "Admin Analytics",
        success: true,
        message: "Successfully retrieved rate limit analytics",
        data: data.data,
      };
    } else {
      return {
        test: "Admin Analytics",
        success: false,
        message: `Analytics request failed: ${data.error || "Unknown error"}`,
        data,
      };
    }
  } catch (error) {
    return {
      test: "Admin Analytics",
      success: false,
      message: `Request failed: ${error}`,
    };
  }
}

async function testAdminReset(): Promise<TestResult> {
  if (!ADMIN_API_KEY) {
    return {
      test: "Admin Reset",
      success: false,
      message: "ADMIN_API_KEY not configured",
    };
  }

  try {
    const testIP = "192.168.1.200";
    const response = await makeAdminRequest("?action=reset", "POST", { ip: testIP });
    const data = await response.json();

    if (response.ok && data.success) {
      return {
        test: "Admin Reset",
        success: true,
        message: `Successfully reset rate limit for IP: ${testIP}`,
        data: data.data,
      };
    } else {
      return {
        test: "Admin Reset",
        success: false,
        message: `Reset request failed: ${data.error || "Unknown error"}`,
        data,
      };
    }
  } catch (error) {
    return {
      test: "Admin Reset",
      success: false,
      message: `Request failed: ${error}`,
    };
  }
}

async function runTests(): Promise<void> {
  console.log("🧪 Starting Rate Limiting Tests\n");
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`Admin API Key: ${ADMIN_API_KEY ? "✅ Configured" : "❌ Not configured"}\n`);

  const tests = [
    testNormalSubmission,
    testAdminBypass,
    testRateLimitExceeded,
    testAdminAnalytics,
    testAdminReset,
  ];

  const results: TestResult[] = [];

  for (const test of tests) {
    console.log(`Running: ${test.name}...`);
    const result = await test();
    results.push(result);
    
    const status = result.success ? "✅ PASS" : "❌ FAIL";
    console.log(`${status}: ${result.message}`);
    
    if (result.data) {
      console.log("Data:", JSON.stringify(result.data, null, 2));
    }
    
    console.log("");
  }

  // Summary
  const passed = results.filter(r => r.success).length;
  const total = results.length;
  
  console.log("📊 Test Summary");
  console.log(`Passed: ${passed}/${total}`);
  console.log(`Failed: ${total - passed}/${total}`);
  
  if (passed === total) {
    console.log("🎉 All tests passed!");
  } else {
    console.log("⚠️  Some tests failed. Check the output above for details.");
    process.exit(1);
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error);
}

export { runTests };
