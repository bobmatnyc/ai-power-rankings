'use client';

import dynamic from 'next/dynamic';
import { NoAuthHeader } from './no-auth-header';

// Check if authentication should be disabled
const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";

// Dynamically import ClerkHeader only if auth is enabled
const ClerkHeader = dynamic(
  () => isAuthDisabled
    ? Promise.resolve({ default: () => null })
    : import('./clerk-header'),
  {
    ssr: false,
    loading: () => <div className="h-16 border-b" />
  }
);

export function AuthHeaderWrapper() {
  if (isAuthDisabled) {
    return <NoAuthHeader />;
  }

  return <ClerkHeader />;
}