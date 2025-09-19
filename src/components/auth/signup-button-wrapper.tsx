'use client';

import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { usePathname } from 'next/navigation';

// Check if authentication should be disabled
const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";

interface SignupButtonProps {
  className?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  text?: string;
}

// Dynamically import the Clerk signup button only if auth is enabled
const ClerkSignupButton = dynamic(
  () => isAuthDisabled
    ? Promise.resolve({ default: () => null })
    : import('./signup-button'),
  {
    ssr: false,
    loading: () => <Button variant="ghost" size="sm" disabled>Loading...</Button>
  }
);

// No-auth version of the signup button
function NoAuthSignupButton({
  className,
  variant = 'ghost',
  size = 'sm',
  text = 'Signup for Updates →'
}: SignupButtonProps) {
  const pathname = usePathname();
  const lang = pathname.split('/')[1] || 'en';
  const redirectUrl = `/${lang}/newsletter-preferences`;

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={() => {
        // In dev mode, just navigate to the newsletter page
        window.location.href = redirectUrl;
      }}
    >
      {text}
    </Button>
  );
}

// Export the appropriate button based on auth configuration
export function SignupForUpdatesButton(props: SignupButtonProps) {
  if (isAuthDisabled) {
    return <NoAuthSignupButton {...props} />;
  }

  return <ClerkSignupButton {...props} />;
}