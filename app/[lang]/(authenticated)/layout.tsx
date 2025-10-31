'use client';

import { ClerkProvider } from '@clerk/nextjs';
import { useParams } from 'next/navigation';
import { ReactNode, useEffect } from 'react';

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
 */
export default function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const params = useParams();
  const locale = (params?.lang as string) || 'en';

  // Map locale codes to Clerk localization
  const clerkLocale = locale === 'de' ? 'de-DE' : 'en-US';

  // Set global flag for clerk-direct-components to know Clerk is available
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__clerkProviderAvailable = true;
    }

    return () => {
      if (typeof window !== "undefined") {
        delete (window as any).__clerkProviderAvailable;
      }
    };
  }, []);

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
      {children}
    </ClerkProvider>
  );
}
