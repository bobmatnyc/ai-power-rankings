"use client";

import dynamic from "next/dynamic";
import type { ReactNode } from "react";

// Dynamically import AuthProviderWrapper with SSR disabled
// This ensures ClerkProvider is never imported during SSR
const AuthProviderWrapper = dynamic(
  () => import("./auth-provider-wrapper").then((mod) => ({ default: mod.AuthProviderWrapper })),
  {
    ssr: false,
  }
);

interface ClientAuthWrapperProps {
  children: ReactNode;
}

export function ClientAuthWrapper({ children }: ClientAuthWrapperProps) {
  return <AuthProviderWrapper>{children}</AuthProviderWrapper>;
}
