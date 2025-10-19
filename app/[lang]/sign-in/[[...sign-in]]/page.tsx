"use client";

import { SignIn, useClerk } from "@clerk/nextjs";
import { useEffect, useState } from "react";

export default function SignInPage() {
  const [mounted, setMounted] = useState(false);
  const { loaded } = useClerk();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Wait for BOTH React mount AND Clerk SDK to load
  // This prevents blank page and ensures Clerk UI renders correctly
  if (!mounted || !loaded) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">
            {!mounted ? 'Mounting...' : 'Loading authentication...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <SignIn />
    </div>
  );
}
