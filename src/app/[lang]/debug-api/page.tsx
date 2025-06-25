"use client";

import { useEffect, useState } from "react";

export default function DebugApiPage() {
  const [apiResponse, setApiResponse] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function testApi() {
      try {
        console.log("Starting API test...");

        // Test 1: Debug env endpoint
        const envResponse = await fetch("/api/debug-env");
        const envData = await envResponse.json();
        console.log("Environment data:", envData);

        // Test 2: Rankings endpoint
        const rankingsResponse = await fetch("/api/rankings");
        const rankingsData = await rankingsResponse.json();
        console.log("Rankings data:", rankingsData);

        setApiResponse({
          environment: envData,
          rankings: rankingsData,
          rankingsStatus: rankingsResponse.status,
          timestamp: new Date().toISOString(),
        });
      } catch (err) {
        console.error("API test error:", err);
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }

    testApi();
  }, []);

  if (loading) {
    return <div className="p-8">Loading API test...</div>;
  }

  if (error) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-red-600 mb-4">API Test Error</h1>
        <pre className="bg-red-100 p-4 rounded">{error}</pre>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-4">API Debug Page</h1>
      <pre className="bg-gray-100 p-4 rounded overflow-auto">
        {JSON.stringify(apiResponse, null, 2)}
      </pre>
    </div>
  );
}
