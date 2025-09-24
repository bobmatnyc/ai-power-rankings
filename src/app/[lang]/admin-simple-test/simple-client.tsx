'use client';

import { useState } from 'react';

export function SimpleTestClient() {
  const [result, setResult] = useState<string>('Click the button to see results...');
  const [isLoading, setIsLoading] = useState(false);

  const testApi = async () => {
    console.log('Starting API test...');
    setIsLoading(true);
    setResult('Testing...');

    try {
      console.log('Fetching /api/admin/db-status...');

      const response = await fetch('/api/admin/db-status', {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Accept': 'application/json',
        },
      });

      console.log('Response received:');
      console.log('- Status:', response.status);
      console.log('- Headers:', Object.fromEntries(response.headers.entries()));

      const text = await response.text();
      console.log('- Raw text:', text);

      try {
        const data = JSON.parse(text);
        console.log('- Parsed JSON:', data);

        setResult(JSON.stringify({
          status: response.status,
          statusText: response.statusText,
          data: data
        }, null, 2));
      } catch (e) {
        console.error('Failed to parse as JSON:', e);
        setResult(`Status: ${response.status} ${response.statusText}\n\nResponse:\n${text}`);
      }
    } catch (error) {
      console.error('Fetch error:', error);
      setResult(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsLoading(false);
      console.log('API test completed');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold mb-4">API Test</h2>

      <div className="mb-4">
        <p className="text-sm text-gray-600 mb-4">
          Click the button below to test the /api/admin/db-status endpoint.
          Check the browser console (F12) for detailed logs.
        </p>
      </div>

      <button
        onClick={testApi}
        disabled={isLoading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Testing...' : 'Test /api/admin/db-status'}
      </button>

      <div className="mt-6">
        <h3 className="font-semibold mb-2">Result:</h3>
        <pre className="bg-gray-100 p-4 rounded text-xs overflow-x-auto min-h-[100px] font-mono">
          {result}
        </pre>
      </div>

      <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-xs text-gray-700">
          <strong>Debug Tips:</strong>
        </p>
        <ul className="text-xs text-gray-600 mt-1 list-disc list-inside">
          <li>Open browser DevTools Console (F12) for detailed logs</li>
          <li>Check the Network tab to see the actual request/response</li>
          <li>Look for any JavaScript errors in the Console</li>
        </ul>
      </div>
    </div>
  );
}