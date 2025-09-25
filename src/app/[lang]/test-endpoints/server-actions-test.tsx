"use client";

import { useState } from "react";
import { getDatabaseStatus, getArticles, testAuthentication } from "@/lib/server-actions/admin-actions";

interface ServerActionResult {
  success?: boolean;
  data?: unknown;
  error?: string;
  authenticated?: boolean;
}

export default function ServerActionsTest() {
  const [results, setResults] = useState<Record<string, ServerActionResult>>({});
  const [loading, setLoading] = useState(false);

  const testServerAction = async (name: string, action: () => Promise<ServerActionResult>) => {
    console.log(`Testing server action: ${name}...`);
    try {
      const result = await action();
      setResults((prev) => ({
        ...prev,
        [name]: result,
      }));
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        [name]: {
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
      }));
    }
  };

  const runAllServerActionTests = async () => {
    setLoading(true);
    setResults({});

    try {
      await testServerAction("test-auth", testAuthentication);
      await testServerAction("db-status", getDatabaseStatus);
      await testServerAction("articles", getArticles);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-8 p-6 bg-purple-50 border border-purple-200 rounded">
      <h2 className="text-xl font-bold mb-4 text-purple-800">Server Actions Test</h2>
      <p className="text-sm text-purple-700 mb-4">
        Server Actions run directly in the server context and completely bypass API routes and middleware.
        This is another solution to avoid Clerk's interference.
      </p>

      <button
        type="button"
        onClick={runAllServerActionTests}
        disabled={loading}
        className="bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600 disabled:opacity-50 mb-4"
      >
        {loading ? "Running Server Action Tests..." : "Test Server Actions"}
      </button>

      <div className="space-y-4">
        {Object.entries(results).map(([name, result]) => (
          <div key={name} className="border border-purple-300 p-3 rounded bg-white">
            <h3 className="font-semibold mb-2 text-purple-800">Server Action: {name}</h3>
            <div className="text-xs">
              <div className="mb-2">
                <span className={`inline-block px-2 py-1 rounded text-xs ${
                  result.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {result.success ? 'SUCCESS' : 'FAILED'}
                </span>
              </div>
              <pre className="bg-gray-100 p-2 rounded text-xs overflow-auto max-h-40">
                {JSON.stringify(result, null, 2)}
              </pre>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-3 bg-purple-100 border border-purple-300 rounded">
        <h4 className="font-semibold text-purple-800 mb-2">Server Actions Advantages:</h4>
        <ul className="text-xs text-purple-700 list-disc list-inside space-y-1">
          <li>Run in the same process as the page component</li>
          <li>Never go through middleware or API route handlers</li>
          <li>Cannot be intercepted by Clerk's middleware</li>
          <li>Always return structured data (never HTML error pages)</li>
          <li>Can access server-side resources directly</li>
        </ul>
      </div>
    </div>
  );
}