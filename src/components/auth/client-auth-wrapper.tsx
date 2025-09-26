"use client";

import type { ReactNode } from "react";
import { AuthProviderWrapper } from "./auth-provider-wrapper";
import { AuthErrorBoundary } from "./auth-error-boundary";

interface ClientAuthWrapperProps {
  children: ReactNode;
}

// Simple client wrapper that uses AuthProviderWrapper directly
// The AuthProviderWrapper handles SSR/client detection internally
// Wraps with error boundary to catch any React context errors
export function ClientAuthWrapper({ children }: ClientAuthWrapperProps) {
  return (
    <AuthErrorBoundary
      fallback={
        <div suppressHydrationWarning>
          {children}
        </div>
      }
    >
      <AuthProviderWrapper>{children}</AuthProviderWrapper>
    </AuthErrorBoundary>
  );
}
