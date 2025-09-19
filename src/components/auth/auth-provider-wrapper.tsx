"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { NoAuthProvider } from "./no-auth-provider";

interface AuthProviderWrapperProps {
  children: ReactNode;
}

// Check if authentication should be disabled
const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";

export function AuthProviderWrapper({ children }: AuthProviderWrapperProps) {
  // In development mode with NEXT_PUBLIC_DISABLE_AUTH=true, use NoAuthProvider
  if (isAuthDisabled) {
    console.log("🔓 Authentication disabled for development");
    return <NoAuthProvider>{children}</NoAuthProvider>;
  }

  // In production or when auth is enabled, use ClerkProvider
  return <ClerkProvider>{children}</ClerkProvider>;
}