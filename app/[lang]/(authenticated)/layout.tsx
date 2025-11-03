'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { useParams } from 'next/navigation';
import { ReactNode } from 'react';
import { ClerkAvailableProvider } from '@/contexts/clerk-context';

/**
 * Authenticated Route Group Layout
 *
 * This layout ONLY applies to routes under app/[lang]/(authenticated)/
 * including /admin, /dashboard, /sign-in, /sign-up
 *
 * Clerk is isolated to this route group, preventing it from loading
 * on public pages (95%+ of traffic).
 *
 * Impact: -517 KB JavaScript on public pages
 *
 * Uses ClerkAvailableProvider context to signal Clerk availability
 * to child components without global window flags.
 */
export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const locale = (params?.lang as string) || 'en';

  // Map locale codes to Clerk localization
  const clerkLocale = locale === 'de' ? 'de-DE' : 'en-US';

  return (
    <ClerkProvider
      publishableKey={process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY}
      appearance={{
        baseTheme: undefined,
        variables: {
          colorPrimary: '#000000',
        },
      }}
      localization={{
        locale: clerkLocale,
      }}
      signInUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_IN_URL}
      signUpUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_UP_URL}
      signInFallbackRedirectUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL}
      signUpFallbackRedirectUrl={process.env.NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL}
    >
      <ClerkAvailableProvider>
        {children}
      </ClerkAvailableProvider>
    </ClerkProvider>
  );
}
