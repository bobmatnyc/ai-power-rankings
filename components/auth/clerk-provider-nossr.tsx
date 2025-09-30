"use client";

import type React from "react";

interface ClerkProviderNoSSRProps {
  children: React.ReactNode;
}

/**
 * NoSSR wrapper component that only renders children without any Clerk involvement.
 * This is used when auth is disabled to completely avoid loading Clerk.
 */
export default function ClerkProviderNoSSR({ children }: ClerkProviderNoSSRProps) {
  return <>{children}</>;
}
