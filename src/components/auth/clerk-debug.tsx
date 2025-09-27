"use client";

// Use safe auth wrappers - but this component is only for development
import { useAuth } from "@/components/auth/auth-components";
// useClerk is not available in our safe wrappers yet, so we'll check window.Clerk directly
import { useEffect, useState } from "react";

export function ClerkDebug() {
  // Get Clerk directly from window instead of using hook
  const auth = useAuth();
  // biome-ignore lint/suspicious/noExplicitAny: Debug component
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    // biome-ignore lint/suspicious/noExplicitAny: Debug component
    const clerk = typeof window !== "undefined" ? (window as any).Clerk : null;
    const info = {
      clerkLoaded: clerk?.loaded,
      authLoaded: auth?.isLoaded,
      isSignedIn: auth?.isSignedIn,
      // biome-ignore lint/suspicious/noExplicitAny: Debug component
      hasClerkObject: typeof window !== "undefined" && !!(window as any).Clerk,
      clerkVersion: clerk?.version,
      publishableKey: process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"] ? "Set" : "Not set",
      authDisabled: process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true",
    };
    setDebugInfo(info);
    console.log("Clerk Debug Info:", info);
  }, [auth]);

  if (process.env["NODE_ENV"] !== "development") {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded text-xs max-w-xs z-50">
      <h3 className="font-bold mb-2">Clerk Debug</h3>
      <pre className="text-[10px]">{JSON.stringify(debugInfo, null, 2)}</pre>
    </div>
  );
}
