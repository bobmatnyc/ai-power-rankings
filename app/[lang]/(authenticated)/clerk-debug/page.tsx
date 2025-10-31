"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export default function ClerkDebugPage() {
  const { loaded } = useClerk();
  const { user, isSignedIn, isLoaded } = useUser();
  const [mounted, setMounted] = useState(false);
  const [debugInfo, setDebugInfo] = useState<any>({});
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Collect debug info
    const interval = setInterval(() => {
      setDebugInfo({
        timestamp: new Date().toISOString(),
        clerkLoaded: loaded,
        userLoaded: isLoaded,
        isSignedIn,
        userId: user?.id || null,
        hasWindowClerk: typeof window.Clerk !== 'undefined',
        windowClerkLoaded: (window as any).Clerk?.loaded || false,
        cookies: document.cookie.split(';').filter(c => c.includes('clerk')).length,
      });
    }, 500);

    return () => clearInterval(interval);
  }, [loaded, isLoaded, isSignedIn, user]);

  const copyAllDebugInfo = async () => {
    const debugText = `CLERK DEBUG INFORMATION
Generated: ${new Date().toISOString()}

=== REAL-TIME STATUS ===
${JSON.stringify(debugInfo, null, 2)}

=== LOADING STATES ===
useClerk().loaded: ${loaded}
useClerk().isLoaded: ${isLoaded}
User Signed In: ${isSignedIn}

=== ENVIRONMENT VARIABLES ===
Publishable Key: ${process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.substring(0, 20)}...

=== USER INFORMATION ===
${user ? JSON.stringify({
  id: user.id,
  email: user.primaryEmailAddress?.emailAddress,
  firstName: user.firstName,
  lastName: user.lastName,
  organizationMemberships: user.organizationMemberships?.length || 0,
}, null, 2) : 'No user signed in'}

=== DIAGNOSIS ===
${!loaded ? "⏳ Clerk SDK is still loading..." :
  loaded && !isSignedIn ? "✅ Clerk loaded but you're not signed in" :
  "✅ Clerk loaded and you're signed in!"}
`;

    try {
      await navigator.clipboard.writeText(debugText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
      alert('Failed to copy to clipboard');
    }
  };

  if (!mounted) {
    return <div className="p-8">Mounting...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">Clerk Debug Information</h1>
          <Button
            onClick={copyAllDebugInfo}
            size="sm"
            variant={copied ? "default" : "outline"}
            className={copied ? "bg-green-600 hover:bg-green-700" : ""}
          >
            {copied ? "✓ Copied!" : "Copy All"}
          </Button>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Real-Time Status</h2>
          <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
            {JSON.stringify(debugInfo, null, 2)}
          </pre>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Loading States</h2>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className={`w-4 h-4 rounded-full ${loaded ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span>useClerk().loaded: <strong>{String(loaded)}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-4 h-4 rounded-full ${isLoaded ? 'bg-green-500' : 'bg-red-500'}`}></span>
              <span>useClerk().isLoaded: <strong>{String(isLoaded)}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-4 h-4 rounded-full ${isSignedIn ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
              <span>User Signed In: <strong>{String(isSignedIn)}</strong></span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Environment Variables</h2>
          <div className="space-y-1 text-sm">
            <div>Publishable Key: <code className="bg-gray-100 px-2 py-1 rounded">
              {process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.substring(0, 20)}...
            </code></div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">User Information</h2>
          {user ? (
            <pre className="bg-gray-100 p-4 rounded overflow-auto text-sm">
              {JSON.stringify({
                id: user.id,
                email: user.primaryEmailAddress?.emailAddress,
                firstName: user.firstName,
                lastName: user.lastName,
              }, null, 2)}
            </pre>
          ) : (
            <p className="text-gray-600">No user signed in</p>
          )}
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <button
              onClick={() => window.location.href = '/en/sign-in'}
              className="w-full bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Go to Sign-In Page
            </button>
            <button
              onClick={() => {
                document.cookie.split(';').forEach(c => {
                  const name = c.split('=')[0].trim();
                  if (name.includes('clerk')) {
                    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
                  }
                });
                alert('Clerk cookies cleared. Refresh the page.');
              }}
              className="w-full bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
            >
              Clear Clerk Cookies
            </button>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            >
              Reload Page
            </button>
          </div>
        </div>

        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded">
          <h3 className="font-semibold text-yellow-900 mb-2">Diagnosis</h3>
          <p className="text-sm text-yellow-800">
            {!loaded && "⏳ Clerk SDK is still loading..."}
            {loaded && !isSignedIn && "✅ Clerk loaded but you're not signed in"}
            {loaded && isSignedIn && "✅ Clerk loaded and you're signed in!"}
          </p>
        </div>
      </div>
    </div>
  );
}
