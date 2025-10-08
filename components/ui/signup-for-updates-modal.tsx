"use client";

// Use safe auth wrappers instead of direct Clerk imports
import { useAuth, useUser } from "@/components/auth/auth-components";
import { SignUp } from "@/components/auth/auth-components";
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{dict.newsletter?.modal?.title || "Sign In"}</DialogTitle>
          <DialogDescription>
            {isSignedIn
              ? "You're signed in! Welcome to AI Power Rankings."
              : "Sign in to access AI Power Rankings"}
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
            // Not signed in - show Clerk SignUp component
            <div className="space-y-4">
              <SignUp
                appearance={{
                  elements: {
                    rootBox: "w-full",
                    card: "shadow-none p-0 bg-transparent",
                    headerTitle: "hidden",
                    headerSubtitle: "hidden",
                    socialButtonsBlockButton:
                      "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
                    socialButtonsBlockButtonText: "font-normal",
                    dividerLine: "bg-border",
                    dividerText: "text-muted-foreground",
                    formFieldLabel: "text-foreground",
                    formFieldInput:
                      "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
                    footerActionLink: "text-primary hover:text-primary/80",
                  },
                  layout: {
                    socialButtonsPlacement: "top",
                    socialButtonsVariant: "blockButton",
                  },
                }}
                fallbackRedirectUrl={typeof window !== "undefined" ? window.location.pathname : "/"}
                signInFallbackRedirectUrl={typeof window !== "undefined" ? window.location.pathname : "/"}
              />

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
