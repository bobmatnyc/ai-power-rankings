"use client";

import { useState } from "react";

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
    await testEndpoint("test-basic", "/api/admin/test-basic");
    await testEndpoint("test-auth", "/api/admin/test-auth");
    await testEndpoint("test-user", "/api/admin/test-user");
    await testEndpoint("db-status", "/api/admin/db-status");
    await testEndpoint("articles", "/api/admin/articles");
    await testEndpoint("db-status-v2", "/api/admin/db-status-v2");
    await testEndpoint("articles-v2", "/api/admin/articles-v2");
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

      <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <h3 className="font-semibold mb-2">Test Sequence:</h3>
        <ol className="list-decimal list-inside space-y-1 text-sm">
          <li>test-basic: No auth, should always work</li>
          <li>test-auth: Only tests Clerk auth()</li>
          <li>test-user: Tests both auth() and currentUser()</li>
          <li>db-status: Full admin endpoint (uses auth-helper)</li>
          <li>articles: Full admin endpoint (uses auth-helper)</li>
          <li>db-status-v2: Direct Clerk auth (bypasses auth-helper)</li>
          <li>articles-v2: Direct Clerk auth (bypasses auth-helper)</li>
        </ol>
        <p className="mt-2 text-sm">Check browser console for detailed logs</p>
      </div>
    </div>
  );
}
