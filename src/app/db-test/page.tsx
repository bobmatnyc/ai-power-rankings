"use client";

import { useCallback, useEffect, useState } from "react";

// Force dynamic rendering to avoid Clerk SSG issues
export const dynamic = "force-dynamic";

interface TestResult {
  name: string;
  status: "pending" | "success" | "error";
  message?: string;
  data?: unknown;
}

export default function DatabaseTestPage() {
  const [tests, setTests] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(true);

  const runTests = useCallback(async () => {
    setLoading(true);
    const results: TestResult[] = [];

    // Test 1: Environment Check
    try {
      const envRes = await fetch("/api/db-test/environment");
      const envData = await envRes.json();
      results.push({
        name: "Environment Variables",
        status: envData.error ? "error" : "success",
        message: envData.error || "Environment configured",
        data: envData,
      });
    } catch (error) {
      results.push({
        name: "Environment Variables",
        status: "error",
        message: String(error),
      });
    }

    // Test 2: Direct Neon Connection
    try {
      const neonRes = await fetch("/api/db-test/neon-direct");
      const neonData = await neonRes.json();
      results.push({
        name: "Direct Neon Connection",
        status: neonData.error ? "error" : "success",
        message: neonData.error || `Connected: ${neonData.articleCount} articles`,
        data: neonData,
      });
    } catch (error) {
      results.push({
        name: "Direct Neon Connection",
        status: "error",
        message: String(error),
      });
    }

    // Test 3: Drizzle Connection
    try {
      const drizzleRes = await fetch("/api/db-test/drizzle");
      const drizzleData = await drizzleRes.json();
      results.push({
        name: "Drizzle ORM Connection",
        status: drizzleData.error ? "error" : "success",
        message: drizzleData.error || `Connected: ${drizzleData.articleCount} articles`,
        data: drizzleData,
      });
    } catch (error) {
      results.push({
        name: "Drizzle ORM Connection",
        status: "error",
        message: String(error),
      });
    }

    // Test 4: Repository Pattern
    try {
      const repoRes = await fetch("/api/db-test/repository");
      const repoData = await repoRes.json();
      results.push({
        name: "ArticlesRepository",
        status: repoData.error ? "error" : "success",
        message: repoData.error || `Repository working: ${repoData.articleCount} articles`,
        data: repoData,
      });
    } catch (error) {
      results.push({
        name: "ArticlesRepository",
        status: "error",
        message: String(error),
      });
    }

    // Test 5: Admin API Endpoints
    try {
      const adminRes = await fetch("/api/admin/articles?page=1&limit=5");
      const adminData = await adminRes.json();
      results.push({
        name: "Admin API Endpoint",
        status: adminData.error ? "error" : "success",
        message: adminData.error || `API working: ${adminData.articles?.length || 0} articles`,
        data: adminData,
      });
    } catch (error) {
      results.push({
        name: "Admin API Endpoint",
        status: "error",
        message: String(error),
      });
    }

    // Test 6: Database Status Endpoint
    try {
      const statusRes = await fetch("/api/admin/db-status");
      const statusData = await statusRes.json();
      results.push({
        name: "Database Status Endpoint",
        status: statusData.error ? "error" : "success",
        message: statusData.error || statusData.message || "Status retrieved",
        data: statusData,
      });
    } catch (error) {
      results.push({
        name: "Database Status Endpoint",
        status: "error",
        message: String(error),
      });
    }

    setTests(results);
    setLoading(false);
  }, []);

  useEffect(() => {
    runTests();
  }, [runTests]);

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-2">Database Connection Test</h1>
        <p className="text-gray-600 mb-8">Testing database connectivity at various levels</p>

        {loading ? (
          <div className="bg-white rounded-lg p-8 shadow">
            <p className="text-gray-500">Running tests...</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tests.map((test) => (
              <div key={test.name} className="bg-white rounded-lg p-6 shadow">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-lg font-semibold">{test.name}</h2>
                  <span
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      test.status === "success"
                        ? "bg-green-100 text-green-800"
                        : test.status === "error"
                          ? "bg-red-100 text-red-800"
                          : "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {test.status}
                  </span>
                </div>
                {test.message && (
                  <p
                    className={`text-sm ${test.status === "error" ? "text-red-600" : "text-gray-600"}`}
                  >
                    {test.message}
                  </p>
                )}
                {test.data !== undefined && test.data !== null && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-sm text-blue-600 hover:text-blue-800">
                      View Details
                    </summary>
                    <pre className="mt-2 text-xs bg-gray-50 p-3 rounded overflow-x-auto">
                      {typeof test.data === "object"
                        ? JSON.stringify(test.data, null, 2)
                        : String(test.data)}
                    </pre>
                  </details>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-8 bg-blue-50 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">Test Information</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• Environment: Checks if database URLs are configured</li>
            <li>• Neon Direct: Tests raw Neon client connection</li>
            <li>• Drizzle ORM: Tests Drizzle database connection</li>
            <li>• Repository: Tests the ArticlesRepository class</li>
            <li>• Admin API: Tests the actual admin endpoints</li>
            <li>• DB Status: Tests the specific endpoint used by admin panel</li>
          </ul>
        </div>

        <button
          type="button"
          onClick={runTests}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Run Tests Again
        </button>
      </div>
    </div>
  );
}
