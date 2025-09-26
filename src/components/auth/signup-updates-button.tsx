"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { SignedInWrapper, SignedOutWrapper, SignUpButton } from "./auth-components";
import { useUser as MockUseUser } from "./no-auth-provider";

// Safe hook that always calls the same hooks in the same order
function useSafeAuth() {
  // Always call MockUseUser first - this ensures consistent hook order
  const mockUser = MockUseUser();
  const [useClerk, setUseClerk] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const clerkUserHookRef = useRef<any>(null);

  useEffect(() => {
    // Only attempt Clerk on client side
    if (typeof window === "undefined") {
      setIsLoaded(true);
      return;
    }

    const isAuthDisabled = process.env["NEXT_PUBLIC_DISABLE_AUTH"] === "true";
    const hasClerkKey = !!process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];

    if (isAuthDisabled || !hasClerkKey) {
      setIsLoaded(true);
      return;
    }

    // Dynamically import and set up Clerk's useUser
    import("@clerk/nextjs").then((clerkModule) => {
      if (clerkModule?.useUser) {
        clerkUserHookRef.current = clerkModule.useUser;
        setUseClerk(true);
        setIsLoaded(true);
      }
    }).catch(() => {
      setIsLoaded(true);
    });
  }, []);

  // Call the Clerk hook if available, otherwise return mock
  let clerkResult = null;
  if (useClerk && clerkUserHookRef.current) {
    try {
      clerkResult = clerkUserHookRef.current();
    } catch (error) {
      console.warn("[useSafeAuth] Clerk useUser failed:", error);
      clerkResult = null;
    }
  }

  // Return Clerk auth if available and loaded, otherwise mock
  if (clerkResult && useClerk) {
    return clerkResult;
  }

  return { user: mockUser.user, isLoaded: true };
}

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
  const { user, isLoaded } = useSafeAuth();
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
