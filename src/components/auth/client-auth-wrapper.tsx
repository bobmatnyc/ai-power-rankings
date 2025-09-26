"use client";

import type { ReactNode } from "react";
import { AuthProviderWrapper } from "./auth-provider-wrapper";

interface ClientAuthWrapperProps {
  children: ReactNode;
}

// Simple client wrapper that uses AuthProviderWrapper directly
// The AuthProviderWrapper handles SSR/client detection internally
// Temporarily removed error boundary to isolate the issue
export function ClientAuthWrapper({ children }: ClientAuthWrapperProps) {
  if (!children) {
    console.error("[ClientAuthWrapper] No children provided!");
    return null;
  }

  return <AuthProviderWrapper>{children}</AuthProviderWrapper>;
}
