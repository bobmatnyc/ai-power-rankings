'use client';

import { SignUpButton } from '@clerk/nextjs';
import { Button } from '@/components/ui/button';
import { usePathname } from 'next/navigation';

interface SignupButtonProps {
  className?: string;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  text?: string;
}

function SignupForUpdatesButton({
  className,
  variant = 'ghost',
  size = 'sm',
  text = 'Signup for Updates →'
}: SignupButtonProps) {
  const pathname = usePathname();
  // Extract language from pathname (e.g., /en/... or /es/...)
  const lang = pathname.split('/')[1] || 'en';

  // Redirect to language-specific newsletter preferences page after signup
  const redirectUrl = `/${lang}/newsletter-preferences`;

  return (
    <SignUpButton mode="modal" forceRedirectUrl={redirectUrl}>
      <Button variant={variant} size={size} className={className}>
        {text}
      </Button>
    </SignUpButton>
  );
}

export default SignupForUpdatesButton;