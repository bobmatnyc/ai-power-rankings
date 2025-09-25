"use client";

import { lazy, Suspense, useEffect, useState } from "react";

interface TestResult {
  endpoint: string;
  credentials: RequestCredentials;
  timestamp: string;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: unknown;
  error?: string;
  requestConfig: string;
  duration: number;
}

interface ErrorLog {
  timestamp: string;
  message: string;
  stack?: string;
}

// Lazy load Clerk status component to prevent SSR issues
const ClerkStatus = lazy(() =>
  import("./clerk-status").then((mod) => ({ default: mod.ClerkStatus }))
);

export function DiagnosticsClient() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [cookies, setCookies] = useState<string>("");
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [authData, setAuthData] = useState<unknown>(null);
  const [showClerkStatus, setShowClerkStatus] = useState(false);

  // Endpoints to test
  const endpoints = ["/api/auth-verify", "/api/admin/db-status", "/api/admin/articles"];

  // Credentials options to test
  const credentialsOptions: RequestCredentials[] = ["same-origin", "include", "omit"];

  // Update cookies display
  useEffect(() => {
    setCookies(document.cookie || "No cookies found");
  }, []);

  // Error handler
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      setErrorLogs((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          message: event.message,
          stack: event.error?.stack,
        },
      ]);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      setErrorLogs((prev) => [
        ...prev,
        {
          timestamp: new Date().toISOString(),
          message: `Unhandled Promise Rejection: ${event.reason}`,
          stack: event.reason?.stack,
        },
      ]);
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  // Handle auth data from Clerk component
  const handleAuthData = (data: unknown) => {
    setAuthData(data);
    if (data?.authToken) {
      setAuthToken(data.authToken);
    }
  };

  // Check if we can load Clerk on mount
  useEffect(() => {
    // Delay showing Clerk status to prevent hydration issues
    const timer = setTimeout(() => setShowClerkStatus(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const testEndpoint = async (endpoint: string, credentials: RequestCredentials) => {
    const startTime = performance.now();
    const result: TestResult = {
      endpoint,
      credentials,
      timestamp: new Date().toISOString(),
      requestConfig: "",
      duration: 0,
    };

    try {
      const config: RequestInit = {
        method: "GET",
        credentials,
        headers: {
          Accept: "application/json",
        },
      };

      // Add auth token if available and not using 'omit' credentials
      if (authToken && credentials !== "omit") {
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${authToken}`,
        };
      }

      result.requestConfig = JSON.stringify(config, null, 2);

      const response = await fetch(endpoint, config);
      const endTime = performance.now();
      result.duration = Math.round(endTime - startTime);

      result.status = response.status;
      result.statusText = response.statusText;

      // Get headers
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      result.headers = headers;

      // Get body
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        try {
          result.body = await response.json();
        } catch {
          result.body = "Failed to parse JSON response";
        }
      } else {
        result.body = await response.text();
      }
    } catch (error) {
      const endTime = performance.now();
      result.duration = Math.round(endTime - startTime);
      result.error = error instanceof Error ? error.message : String(error);
    }

    return result;
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults([]);

    const results: TestResult[] = [];

    for (const endpoint of endpoints) {
      for (const credentials of credentialsOptions) {
        const result = await testEndpoint(endpoint, credentials);
        results.push(result);
        setTestResults([...results]);
        // Small delay between tests
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    setIsRunning(false);
  };

  const runSingleTest = async (endpoint: string, credentials: RequestCredentials) => {
    const result = await testEndpoint(endpoint, credentials);
    setTestResults((prev) => [...prev, result]);
  };

  const clearResults = () => {
    setTestResults([]);
    setErrorLogs([]);
  };

  return (
    <>
      {/* Client-side Authentication Status */}
      {showClerkStatus ? (
        <Suspense
          fallback={
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-bold mb-4 text-gray-800">
                Loading Clerk Authentication...
              </h2>
            </div>
          }
        >
          <ClerkStatus onAuthData={handleAuthData} />
        </Suspense>
      ) : (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800">
            Initializing Authentication Check...
          </h2>
        </div>
      )}

      {/* Additional Auth Info */}
      {authData && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 text-gray-800">Auth Token Status</h2>
          <div className="space-y-2">
            <div className="text-sm text-gray-600">
              <span className="font-semibold">Auth Token:</span>{" "}
              {authToken ? (
                <span className="font-mono text-xs bg-gray-100 px-1 rounded">
                  {authToken.substring(0, 30)}...
                </span>
              ) : authData.tokenError ? (
                <span className="text-red-600">Error: {authData.tokenError}</span>
              ) : (
                "Not available"
              )}
            </div>
          </div>
        </div>
      )}

      {/* Browser Cookies */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 text-gray-800">Browser Cookies</h2>
        <div className="bg-gray-100 p-3 rounded text-xs font-mono break-all">
          {cookies || "No cookies found"}
        </div>
        <button
          type="button"
          onClick={() => setCookies(document.cookie || "No cookies found")}
          className="mt-3 px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Refresh Cookies
        </button>
      </div>

      {/* Test Controls */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 text-gray-800">API Test Controls</h2>

        <div className="flex gap-3 mb-4">
          <button
            type="button"
            onClick={runAllTests}
            disabled={isRunning}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isRunning ? "Running Tests..." : "Run All Tests"}
          </button>
          <button
            type="button"
            onClick={clearResults}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Clear Results
          </button>
        </div>

        {/* Individual Test Buttons */}
        <div className="space-y-4">
          {endpoints.map((endpoint) => (
            <div key={endpoint} className="border rounded p-3">
              <h3 className="font-semibold mb-2">{endpoint}</h3>
              <div className="flex gap-2 flex-wrap">
                {credentialsOptions.map((creds) => (
                  <button
                    type="button"
                    key={creds}
                    onClick={() => runSingleTest(endpoint, creds)}
                    disabled={isRunning}
                    className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300 disabled:bg-gray-100"
                  >
                    Test with "{creds}"
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* JavaScript Errors */}
      {errorLogs.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-bold mb-4 text-red-800">JavaScript Errors</h2>
          <div className="space-y-3">
            {errorLogs.map((log, index) => (
              <div
                key={`error-${log.timestamp}-${index}`}
                className="bg-white p-3 rounded border border-red-200"
              >
                <div className="text-xs text-gray-500">{log.timestamp}</div>
                <div className="text-sm font-semibold text-red-700 mt-1">{log.message}</div>
                {log.stack && (
                  <pre className="mt-2 text-xs text-gray-600 overflow-x-auto">{log.stack}</pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Test Results */}
      {testResults.length > 0 && (
        <div className="space-y-6">
          <h2 className="text-xl font-bold text-gray-800">Test Results</h2>

          {testResults.map((result, index) => (
            <div
              key={`result-${result.endpoint}-${result.timestamp}-${index}`}
              className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${
                result.error
                  ? "border-red-500"
                  : result.status && result.status >= 200 && result.status < 300
                    ? "border-green-500"
                    : result.status && result.status >= 400
                      ? "border-red-500"
                      : "border-yellow-500"
              }`}
            >
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-800">{result.endpoint}</h3>
                <div className="flex gap-4 mt-2 text-sm">
                  <span className="font-semibold">Credentials:</span>
                  <span className="bg-gray-100 px-2 py-1 rounded">{result.credentials}</span>
                  <span className="font-semibold">Duration:</span>
                  <span>{result.duration}ms</span>
                </div>
              </div>

              {/* Request Config */}
              <details className="mb-4">
                <summary className="cursor-pointer font-semibold text-gray-700">
                  Request Configuration
                </summary>
                <pre className="mt-2 bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                  {result.requestConfig}
                </pre>
              </details>

              {/* Response */}
              {result.error ? (
                <div className="bg-red-50 p-3 rounded">
                  <div className="font-semibold text-red-700">Error:</div>
                  <div className="text-red-600 mt-1">{result.error}</div>
                </div>
              ) : (
                <>
                  <div className="mb-3">
                    <span className="font-semibold">Status:</span>{" "}
                    <span
                      className={`px-2 py-1 rounded text-sm ${
                        result.status && result.status >= 200 && result.status < 300
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {result.status} {result.statusText}
                    </span>
                  </div>

                  {/* Response Headers */}
                  <details className="mb-3">
                    <summary className="cursor-pointer font-semibold text-gray-700">
                      Response Headers
                    </summary>
                    <pre className="mt-2 bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                      {JSON.stringify(result.headers, null, 2)}
                    </pre>
                  </details>

                  {/* Response Body */}
                  <details open={result.status !== 200}>
                    <summary className="cursor-pointer font-semibold text-gray-700">
                      Response Body
                    </summary>
                    <pre className="mt-2 bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                      {typeof result.body === "object"
                        ? JSON.stringify(result.body, null, 2)
                        : result.body}
                    </pre>
                  </details>
                </>
              )}

              <div className="mt-3 text-xs text-gray-500">
                Tested at: {new Date(result.timestamp).toLocaleString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
