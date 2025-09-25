'use client';

import { useState, useCallback, useEffect } from 'react';

interface TestResult {
  endpoint: string;
  credentials: RequestCredentials;
  timestamp: string;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body: any;
  error?: string;
  requestConfig: string;
  duration: number;
}

interface ErrorLog {
  timestamp: string;
  message: string;
  stack?: string;
}

export function DiagnosticsClientFixed() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [cookies, setCookies] = useState<string>('');
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Endpoints to test
  const endpoints = [
    '/api/auth-verify',
    '/api/admin/db-status',
    '/api/admin/articles',
  ];

  // Credentials options to test
  const credentialsOptions: RequestCredentials[] = [
    'same-origin',
    'include',
    'omit'
  ];

  // Initialize once on mount
  useEffect(() => {
    console.log('[DiagnosticsClient] Initializing...');
    setCookies(document.cookie || 'No cookies found');
    setIsInitialized(true);

    // Setup error handlers
    const handleError = (event: ErrorEvent) => {
      console.error('[DiagnosticsClient] Global error:', event);
      setErrorLogs(prev => [...prev, {
        timestamp: new Date().toISOString(),
        message: event.message,
        stack: event.error?.stack
      }]);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('[DiagnosticsClient] Unhandled rejection:', event);
      setErrorLogs(prev => [...prev, {
        timestamp: new Date().toISOString(),
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack
      }]);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    console.log('[DiagnosticsClient] Initialized successfully');

    return () => {
      console.log('[DiagnosticsClient] Cleaning up...');
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []); // Empty dependency array - run once

  const refreshCookies = useCallback(() => {
    console.log('[DiagnosticsClient] Refreshing cookies...');
    setCookies(document.cookie || 'No cookies found');
  }, []);

  const testEndpoint = useCallback(async (endpoint: string, credentials: RequestCredentials) => {
    console.log(`[DiagnosticsClient] Testing ${endpoint} with credentials: ${credentials}`);
    const startTime = performance.now();
    const result: TestResult = {
      endpoint,
      credentials,
      timestamp: new Date().toISOString(),
      requestConfig: '',
      duration: 0,
      body: null,
    };

    try {
      const config: RequestInit = {
        method: 'GET',
        credentials,
        headers: {
          'Accept': 'application/json',
        },
      };

      result.requestConfig = JSON.stringify(config, null, 2);
      console.log(`[DiagnosticsClient] Fetching ${endpoint}...`);

      const response = await fetch(endpoint, config);
      const endTime = performance.now();
      result.duration = Math.round(endTime - startTime);

      console.log(`[DiagnosticsClient] Response received: ${response.status} ${response.statusText}`);

      result.status = response.status;
      result.statusText = response.statusText;

      // Get headers
      const headers: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        headers[key] = value;
      });
      result.headers = headers;

      // Get body
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          result.body = await response.json();
        } catch (e) {
          console.error("[DiagnosticsClient] Failed to parse JSON:", e);
          result.body = 'Failed to parse JSON response';
        }
      } else {
        result.body = await response.text();
      }
    } catch (error) {
      const endTime = performance.now();
      result.duration = Math.round(endTime - startTime);
      result.error = error instanceof Error ? error.message : String(error);
      console.error("[DiagnosticsClient] Test failed:", error);
    }

    return result;
  }, []);

  const runAllTests = useCallback(async () => {
    console.log('[DiagnosticsClient] Running all tests...');
    setIsRunning(true);
    setTestResults([]);

    const results: TestResult[] = [];

    for (const endpoint of endpoints) {
      for (const credentials of credentialsOptions) {
        try {
          const result = await testEndpoint(endpoint, credentials);
          results.push(result);
          setTestResults([...results]);
          // Small delay between tests
          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (error) {
          console.error("[DiagnosticsClient] Test error:", error);
        }
      }
    }

    setIsRunning(false);
    console.log('[DiagnosticsClient] All tests completed');
  }, [testEndpoint]);

  const runSingleTest = useCallback(async (endpoint: string, credentials: RequestCredentials) => {
    console.log(`[DiagnosticsClient] Running single test: ${endpoint} with ${credentials}`);
    try {
      const result = await testEndpoint(endpoint, credentials);
      setTestResults(prev => [...prev, result]);
    } catch (error) {
      console.error("[DiagnosticsClient] Single test error:", error);
    }
  }, [testEndpoint]);

  const clearResults = useCallback(() => {
    console.log('[DiagnosticsClient] Clearing results...');
    setTestResults([]);
    setErrorLogs([]);
  }, []);

  if (!isInitialized) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 text-gray-800">
          Initializing Diagnostics...
        </h2>
      </div>
    );
  }

  return (
    <>
      {/* Browser Cookies */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-bold mb-4 text-gray-800">Browser Cookies</h2>
        <div className="bg-gray-100 p-3 rounded text-xs font-mono break-all">
          {cookies || 'No cookies found'}
        </div>
        <button
          onClick={refreshCookies}
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
            onClick={runAllTests}
            disabled={isRunning}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {isRunning ? 'Running Tests...' : 'Run All Tests'}
          </button>
          <button
            onClick={clearResults}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
          >
            Clear Results
          </button>
        </div>

        {/* Individual Test Buttons */}
        <div className="space-y-4">
          {endpoints.map(endpoint => (
            <div key={endpoint} className="border rounded p-3">
              <h3 className="font-semibold mb-2">{endpoint}</h3>
              <div className="flex gap-2 flex-wrap">
                {credentialsOptions.map(creds => (
                  <button
                    key={creds}
                    onClick={() => runSingleTest(endpoint, creds)}
                    disabled={isRunning}
                    className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed"
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
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {errorLogs.map((log, index) => (
              <div key={index} className="bg-white p-3 rounded border border-red-200">
                <div className="text-xs text-gray-500">{log.timestamp}</div>
                <div className="text-sm font-semibold text-red-700 mt-1">{log.message}</div>
                {log.stack && (
                  <pre className="mt-2 text-xs text-gray-600 overflow-x-auto">
                    {log.stack}
                  </pre>
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
              key={index}
              className={`bg-white rounded-lg shadow-md p-6 border-l-4 ${
                result.error
                  ? 'border-red-500'
                  : result.status && result.status >= 200 && result.status < 300
                  ? 'border-green-500'
                  : result.status && result.status >= 400
                  ? 'border-red-500'
                  : 'border-yellow-500'
              }`}
            >
              <div className="mb-4">
                <h3 className="text-lg font-bold text-gray-800">
                  {result.endpoint}
                </h3>
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
                    <span className="font-semibold">Status:</span>{' '}
                    <span className={`px-2 py-1 rounded text-sm ${
                      result.status && result.status >= 200 && result.status < 300
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
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
                      {typeof result.body === 'object'
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