"use client";

import { useEffect, useState } from "react";

// Force dynamic rendering to prevent Clerk SSG issues
export const dynamic = "force-dynamic";

export default function SignUpPage() {
  const [SignUpComponent, setSignUpComponent] = useState<React.ComponentType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check if auth is disabled
    const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
    if (isAuthDisabled) {
      setError("Authentication is currently disabled");
      setLoading(false);
      return;
    }

    // Dynamically import Clerk SignUp to prevent SSR issues
    import("@clerk/nextjs").then((clerkModule) => {
      if (clerkModule?.SignUp) {
        setSignUpComponent(() => clerkModule.SignUp);
      } else {
        setError("Sign-up component not available");
      }
      setLoading(false);
    }).catch((err) => {
      console.error("Failed to load Clerk SignUp:", err);
      setError("Authentication service unavailable");
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading sign-up...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Sign-up Unavailable</h1>
          <p className="text-gray-600">{error}</p>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!SignUpComponent) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Sign-up Component Not Found</h1>
          <p className="text-gray-600">Unable to load the sign-up interface</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUpComponent />
    </div>
  );
}
