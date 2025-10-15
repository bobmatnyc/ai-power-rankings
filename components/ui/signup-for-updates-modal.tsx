"use client";

// Use safe auth wrappers instead of direct Clerk imports
import { useAuth, useUser, useClerk } from "@/components/auth/auth-components";
import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useI18n } from "@/i18n/client";

interface SignupForUpdatesModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SignupForUpdatesModal({
  open,
  onOpenChange,
}: SignupForUpdatesModalProps): React.JSX.Element {
  const { dict } = useI18n();
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const clerk = useClerk();
  const [isSubscribed, setIsSubscribed] = useState(false);

  // Auto-close when user signs in and modal is open
  useEffect(() => {
    if (isSignedIn && user && open && !isSubscribed) {
      setIsSubscribed(true);
      // Close modal after delay
      setTimeout(() => {
        onOpenChange(false);
        // Reset state after closing
        setTimeout(() => {
          setIsSubscribed(false);
        }, 300);
      }, 2000);
    }
  }, [isSignedIn, user, open, onOpenChange, isSubscribed]);

  // Handle opening Clerk's native modal
  const handleSignUpClick = () => {
    // Close our dialog first
    onOpenChange(false);

    // Open Clerk's native sign-up modal
    // This ensures Clerk renders at the correct z-index without conflicts
    if (clerk?.openSignUp) {
      clerk.openSignUp({
        afterSignInUrl: typeof window !== "undefined" ? window.location.pathname : "/",
        afterSignUpUrl: typeof window !== "undefined" ? window.location.pathname : "/",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {dict.newsletter?.modal?.title || "Sign In"}
            <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/30 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:text-blue-400">
              Coming Soon
            </span>
          </DialogTitle>
          <DialogDescription>
            {isSignedIn
              ? "You're signed in! Welcome to AI Power Rankings."
              : "Sign in to access AI Power Rankings (authentication coming soon)"}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {isSubscribed ? (
            // Success state
            <div className="py-8 text-center">
              <div className="mx-auto w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-lg font-medium mb-2">
                {dict.newsletter?.modal?.thankYou || "Welcome!"}
              </p>
              <p className="text-sm text-muted-foreground">
                Signed in as {(user as any)?.primaryEmailAddress?.emailAddress}
              </p>
            </div>
          ) : isSignedIn ? (
            // Already signed in
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm font-medium mb-1">Signed in as:</p>
                <p className="text-sm text-muted-foreground">
                  {(user as any)?.fullName || (user as any)?.username}
                </p>
                <p className="text-sm text-muted-foreground">
                  {(user as any)?.primaryEmailAddress?.emailAddress}
                </p>
              </div>

              <div className="flex gap-3">
                <Button className="flex-1" onClick={() => onOpenChange(false)}>
                  Continue
                </Button>
              </div>
            </div>
          ) : (
            // Not signed in - show sign up CTA that opens Clerk's native modal
            <div className="space-y-4">
              <div className="text-center space-y-4">
                <p className="text-sm text-muted-foreground">
                  Create an account to access AI Power Rankings and receive weekly updates
                </p>

                <Button
                  onClick={handleSignUpClick}
                  className="w-full"
                  size="lg"
                >
                  Sign Up
                </Button>

                <p className="text-xs text-muted-foreground">
                  Already have an account?{" "}
                  <button
                    onClick={() => {
                      onOpenChange(false);
                      if (clerk?.openSignIn) {
                        clerk.openSignIn({
                          afterSignInUrl: typeof window !== "undefined" ? window.location.pathname : "/",
                        });
                      }
                    }}
                    className="text-primary hover:text-primary/80 underline"
                  >
                    Sign In
                  </button>
                </p>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                {dict.newsletter?.modal?.privacyNote || "We respect your privacy."}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
