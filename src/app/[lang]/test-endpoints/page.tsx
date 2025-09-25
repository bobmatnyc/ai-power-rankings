"use client";

import { useState } from "react";
import ServerActionsTest from "./server-actions-test";

// Force dynamic rendering to avoid Clerk SSG issues
export const dynamic = "force-dynamic";

interface TestResult {
  status?: number;
  ok?: boolean;
  data?: unknown;
  error?: string;
}

export default function TestEndpointsPage() {
  const [results, setResults] = useState<Record<string, TestResult>>({});

  const testEndpoint = async (name: string, url: string) => {
    console.log(`Testing ${name}...`);
    try {
      const response = await fetch(url, {
        method: "GET",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();
      setResults((prev) => ({
        ...prev,
        [name]: {
          status: response.status,
          ok: response.ok,
          data,
        },
      }));
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        [name]: {
          error: error instanceof Error ? error.message : String(error),
        },
      }));
    }
  };

  const runAllTests = async () => {
    setResults({});

    // NEW WORKING ENDPOINTS (manual auth approach)
    await testEndpoint("health-check-NEW", "/api/public/health-check");
    await testEndpoint("test-auth-NEW", "/api/data/test-auth");
    await testEndpoint("db-status-NEW", "/api/data/db-status");
    await testEndpoint("articles-NEW", "/api/data/articles");

    // OLD PROBLEMATIC ENDPOINTS (for comparison)
    await testEndpoint("db-status-OLD", "/api/admin/db-status");
    await testEndpoint("articles-OLD", "/api/admin/articles");
    await testEndpoint("test-basic-OLD", "/api/admin/test-basic");
    await testEndpoint("test-user-OLD", "/api/admin/test-user");
  };

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">API Endpoint Tests</h1>

      <button
        type="button"
        onClick={runAllTests}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mb-4"
      >
        Run All Tests
      </button>

      <div className="space-y-4">
        {Object.entries(results).map(([name, result]) => (
          <div key={name} className="border p-4 rounded">
            <h2 className="font-semibold mb-2">{name}</h2>
            <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto">
              {JSON.stringify(result, null, 2)}
            </pre>
          </div>
        ))}
      </div>

      <div className="mt-8 space-y-4">
        <div className="p-4 bg-green-50 border border-green-200 rounded">
          <h3 className="font-semibold mb-2 text-green-800">
            NEW WORKING ENDPOINTS (Manual Auth):
          </h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-green-700">
            <li>
              <strong>health-check-NEW:</strong> Public endpoint, no auth - should ALWAYS return
              JSON
            </li>
            <li>
              <strong>test-auth-NEW:</strong> Manual cookie-based auth test - bypasses Clerk
              middleware
            </li>
            <li>
              <strong>db-status-NEW:</strong> Database status with manual auth - should return JSON
            </li>
            <li>
              <strong>articles-NEW:</strong> Articles list with manual auth - should return JSON
            </li>
          </ol>
          <p className="mt-2 text-sm font-medium text-green-800">
            ✅ These endpoints use manual cookie reading and avoid Clerk's auth() function
          </p>
        </div>

        <div className="p-4 bg-red-50 border border-red-200 rounded">
          <h3 className="font-semibold mb-2 text-red-800">
            OLD PROBLEMATIC ENDPOINTS (Clerk Auth):
          </h3>
          <ol className="list-decimal list-inside space-y-1 text-sm text-red-700">
            <li>
              <strong>db-status-OLD:</strong> Uses Clerk auth() - may return HTML error when cookies
              present
            </li>
            <li>
              <strong>articles-OLD:</strong> Uses Clerk auth() - may return HTML error when cookies
              present
            </li>
            <li>
              <strong>test-basic-OLD:</strong> Uses Clerk auth() - may return HTML error when
              cookies present
            </li>
            <li>
              <strong>test-user-OLD:</strong> Uses Clerk auth() - may return HTML error when cookies
              present
            </li>
          </ol>
          <p className="mt-2 text-sm font-medium text-red-800">
            ❌ These endpoints fail on Vercel when user has session cookies due to Clerk
            interference
          </p>
        </div>

        <div className="p-4 bg-blue-50 border border-blue-200 rounded">
          <h3 className="font-semibold mb-2 text-blue-800">Testing Instructions:</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-blue-700">
            <li>Test when NOT signed in - both should work and return JSON</li>
            <li>
              Test when signed in with Clerk - NEW endpoints should work, OLD may fail with HTML
            </li>
            <li>Check browser console for detailed logs</li>
            <li>Look for "Unexpected token 'A'" errors on OLD endpoints when signed in</li>
          </ul>
        </div>
      </div>

      {/* Server Actions Test Component */}
      <ServerActionsTest />
    </div>
  );
}
