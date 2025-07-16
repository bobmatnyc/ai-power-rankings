"use client";

import { useEffect, useState } from "react";

interface EndpointTest {
  name: string;
  url: string;
  status: number | null;
  data: Record<string, unknown> | null;
  error: string | null;
}

export default function DebugEndpointsPage() {
  const [tests, setTests] = useState<EndpointTest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function runTests() {
      const endpoints = [
        { name: "Debug Environment", url: "/api/debug-env" },
        { name: "Debug Static Data", url: "/api/debug-static" },
        { name: "Debug Direct DB", url: "/api/debug-db-direct" },
        { name: "Health Check DB", url: "/api/health/db" },
        { name: "Simple Test DB", url: "/api/test-db" },
        { name: "Rankings Simple", url: "/api/rankings-simple" },
        { name: "Rankings (Main)", url: "/api/rankings" },
        { name: "Tools", url: "/api/tools?limit=1" },
      ];

      const results: EndpointTest[] = [];

      for (const endpoint of endpoints) {
        const result: EndpointTest = {
          name: endpoint.name,
          url: endpoint.url,
          status: null,
          data: null,
          error: null,
        };

        try {
          console.log(`Testing ${endpoint.name} at ${endpoint.url}`);
          const response = await fetch(endpoint.url);
          result.status = response.status;

          if (response.ok) {
            result.data = await response.json();
          } else {
            result.error = `HTTP ${response.status}: ${response.statusText}`;
            try {
              const errorText = await response.text();
              result.error += ` - ${errorText}`;
            } catch {}
          }
        } catch (err) {
          result.error = err instanceof Error ? err.message : String(err);
          console.error(`Error testing ${endpoint.name}:`, err);
        }

        results.push(result);
      }

      setTests(results);
      setLoading(false);
    }

    runTests();
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-4">Testing API Endpoints...</h1>
        <div className="animate-pulse">Running tests...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">API Endpoint Debug Results</h1>
      <div className="space-y-6">
        {tests.map((test) => (
          <div key={test.url} className="border rounded-lg p-4">
            <h2 className="text-lg font-semibold mb-2">
              {test.name} - {test.url}
            </h2>
            <div className="mb-2">
              Status:{" "}
              <span
                className={`font-mono ${test.status === 200 ? "text-green-600" : "text-red-600"}`}
              >
                {test.status || "Failed"}
              </span>
            </div>
            {test.error && (
              <div className="bg-red-100 p-3 rounded mb-2">
                <strong>Error:</strong> {test.error}
              </div>
            )}
            {test.data && (
              <details className="bg-gray-100 p-3 rounded">
                <summary className="cursor-pointer font-medium">Response Data</summary>
                <pre className="mt-2 text-sm overflow-auto">
                  {JSON.stringify(test.data, null, 2)}
                </pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
