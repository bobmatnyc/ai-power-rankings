"use client";

import { useAuth, useUser } from "@/components/auth/auth-components";

interface AuthData {
  authLoaded: boolean;
  isSignedIn: boolean | undefined;
  sessionId: string | null;
  userId: string | null;
  user: unknown;
  authToken?: string | null;
  tokenError?: string;
}

export function ClerkStatus({ onAuthData }: { onAuthData: (data: AuthData) => void }) {
  const { isLoaded: authLoaded, isSignedIn, sessionId, userId, getToken } = useAuth();
  const { user } = useUser();

  // Send auth data to parent component
  if (authLoaded) {
    getToken()
      .then((token) => {
        onAuthData({
          authLoaded,
          isSignedIn,
          sessionId,
          userId,
          user,
          authToken: token,
        });
      })
      .catch((err) => {
        onAuthData({
          authLoaded,
          isSignedIn,
          sessionId,
          userId,
          user,
          authToken: null,
          tokenError: err.message,
        });
      });
  }

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
