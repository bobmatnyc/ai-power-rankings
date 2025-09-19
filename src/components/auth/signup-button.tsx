"use client";

import { SignedIn, SignedOut, SignInButton } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";

interface SignupButtonProps {
  className?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  text?: string;
}

function SignupForUpdatesButton({
  className,
  variant = "ghost",
  size = "sm",
  text = "Sign In For Updates →",
}: SignupButtonProps) {
  const pathname = usePathname();
  // Extract language from pathname (e.g., /en/... or /es/...)
  const lang = pathname.split("/")[1] || "en";

  // Redirect to language-specific newsletter preferences page after signin
  const redirectUrl = `/${lang}/newsletter-preferences`;

  return (
    <>
      <SignedOut>
        <SignInButton mode="modal" forceRedirectUrl={redirectUrl}>
          <Button variant={variant} size={size} className={className}>
            {text || "Sign In For Updates →"}
          </Button>
        </SignInButton>
      </SignedOut>
      <SignedIn>
        <Button variant={variant} size={size} className={className} disabled>
          You're signed in!
        </Button>
      </SignedIn>
    </>
  );
}

export default SignupForUpdatesButton;
