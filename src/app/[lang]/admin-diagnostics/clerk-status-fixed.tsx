"use client";

import { useEffect, useState } from "react";
import { useAuth, useUser } from "@/components/auth/auth-components";

export function ClerkStatusFixed() {
  const { isLoaded: authLoaded, isSignedIn, sessionId, userId, getToken } = useAuth();
  const { user } = useUser();
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);
  const [isTokenLoading, setIsTokenLoading] = useState(false);

  // Fetch token only once when auth is loaded and user is signed in
  useEffect(() => {
    if (!authLoaded || !isSignedIn) {
      console.log("[ClerkStatus] Auth not ready or user not signed in");
      return;
    }

    if (isTokenLoading) {
      console.log("[ClerkStatus] Token already loading, skipping...");
      return;
    }

    console.log("[ClerkStatus] Fetching auth token...");
    setIsTokenLoading(true);

    // Use async function to fetch token
    const fetchToken = async () => {
      try {
        const token = await getToken();
        console.log("[ClerkStatus] Token fetched successfully");
        setAuthToken(token);
        setTokenError(null);
      } catch (err) {
        console.error("[ClerkStatus] Failed to fetch token:", err);
        setTokenError(err instanceof Error ? err.message : "Unknown error");
        setAuthToken(null);
      } finally {
        setIsTokenLoading(false);
      }
    };

    fetchToken();
  }, [authLoaded, isSignedIn, getToken, isTokenLoading]); // Only re-run if these change

  return (
    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
      <h2 className="text-xl font-bold mb-4 text-gray-800">
        Client-side Clerk Authentication Status
      </h2>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="font-semibold">Auth Loaded:</span>
          <span
            className={`px-2 py-1 rounded text-sm ${
              authLoaded ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
            }`}
          >
            {authLoaded ? "Yes" : "Loading..."}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-semibold">Signed In:</span>
          <span
            className={`px-2 py-1 rounded text-sm ${
              isSignedIn ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
            }`}
          >
            {isSignedIn ? "Yes" : "No"}
          </span>
        </div>

        {isSignedIn && (
          <>
            <div className="text-sm text-gray-600">
              <span className="font-semibold">Session ID:</span> {sessionId || "N/A"}
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-semibold">User ID:</span> {userId || "N/A"}
            </div>

            <div className="text-sm text-gray-600">
              <span className="font-semibold">Auth Token:</span>{" "}
              {isTokenLoading ? (
                <span className="text-yellow-600">Loading...</span>
              ) : authToken ? (
                <span className="font-mono text-xs bg-gray-100 px-1 rounded">
                  {authToken.substring(0, 30)}...
                </span>
              ) : tokenError ? (
                <span className="text-red-600">Error: {tokenError}</span>
              ) : (
                "Not available"
              )}
            </div>
          </>
        )}

        {user && (
          <>
            <div className="text-sm text-gray-600">
              <span className="font-semibold">User Email:</span>{" "}
              {user.emailAddresses?.[0]?.emailAddress}
            </div>
            <div className="text-sm text-gray-600">
              <span className="font-semibold">Full Name:</span> {user.fullName}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
