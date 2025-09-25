"use client";

import { useUser as ClerkUseUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { SignedInWrapper, SignedOutWrapper, SignUpButton } from "./auth-components";
import { useUser as MockUseUser } from "./no-auth-provider";

// Check if authentication should be disabled
const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
const useUser = isAuthDisabled ? MockUseUser : ClerkUseUser;

interface SignupUpdatesButtonProps {
  className?: string;
  variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  text?: string;
  afterSignUpUrl?: string;
}

/**
 * Button component that triggers Clerk sign-up flow for newsletter updates.
 * After successful authentication, it automatically subscribes the user to updates
 * and redirects to the specified URL or newsletter preferences page.
 */
export function SignupUpdatesButton({
  className,
  variant = "ghost",
  size = "sm",
  text = "Sign up for updates →",
  afterSignUpUrl,
}: SignupUpdatesButtonProps) {
  const pathname = usePathname();
  const { user, isLoaded } = useUser();
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Extract language from pathname
  const lang = pathname.split("/")[1] || "en";
  const redirectUrl = afterSignUpUrl || `/${lang}/newsletter-preferences`;

  // Auto-subscribe when user is signed in and component mounts
  useEffect(() => {
    const subscribeUser = async () => {
      if (!isLoaded || !user || isSubscribing || isSubscribed) {
        return;
      }

      // Check if user just signed up (within the last 30 seconds)
      const signUpTime = user.createdAt;
      if (!signUpTime) {
        return; // User doesn't have a creation time
      }
      const now = new Date();
      const timeDiff = now.getTime() - new Date(signUpTime).getTime();
      const isNewSignup = timeDiff < 30000; // 30 seconds

      if (!isNewSignup) {
        return; // Don't auto-subscribe existing users
      }

      setIsSubscribing(true);

      try {
        const response = await fetch("/api/newsletter/signup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            userId: user.id,
            email: user.primaryEmailAddress?.emailAddress || "",
            firstName: user.firstName || "",
            lastName: user.lastName || "",
          }),
        });

        if (response.ok) {
          setIsSubscribed(true);
        }
      } catch (error) {
        console.error("Auto-subscribe error:", error);
      } finally {
        setIsSubscribing(false);
      }
    };

    subscribeUser();
  }, [isLoaded, user, isSubscribing, isSubscribed]);

  return (
    <>
      <SignedOutWrapper>
        <SignUpButton mode="modal" forceRedirectUrl={redirectUrl}>
          <Button variant={variant} size={size} className={className}>
            {text}
          </Button>
        </SignUpButton>
      </SignedOutWrapper>
      <SignedInWrapper>
        <Button variant={variant} size={size} className={className} disabled>
          {isSubscribed ? "✓ Subscribed to updates" : "You're signed in!"}
        </Button>
      </SignedInWrapper>
    </>
  );
}

export default SignupUpdatesButton;
