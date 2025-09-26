"use client";

import type { ReactNode } from "react";
import { AuthProviderWrapper } from "./auth-provider-wrapper";

interface ClientAuthWrapperProps {
  children: ReactNode;
}

// Simple client wrapper that uses AuthProviderWrapper directly
// The AuthProviderWrapper handles SSR/client detection internally
export function ClientAuthWrapper({ children }: ClientAuthWrapperProps) {
  // Ensure children is always defined, even if null/undefined is passed
  const safeChildren = children ?? null;

  return <AuthProviderWrapper>{safeChildren}</AuthProviderWrapper>;
}
