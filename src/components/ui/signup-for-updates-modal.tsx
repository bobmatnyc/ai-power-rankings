"use client";

import { SignIn, useAuth, useUser } from "@clerk/nextjs";
import { AlertCircle, Check } from "lucide-react";
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
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState("");

  // Auto-subscribe when user signs in and modal is open
  useEffect(() => {
    const autoSubscribe = async () => {
      if (!isSignedIn || !user || !open || isSubscribed || isSubscribing) {
        return;
      }

      setIsSubscribing(true);
      setError("");

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

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to signup for updates");
        }

        setIsSubscribed(true);

        // Close modal after delay
        setTimeout(() => {
          onOpenChange(false);
          // Reset state after closing
          setTimeout(() => {
            setIsSubscribed(false);
          }, 300);
        }, 2000);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to signup for updates");
      } finally {
        setIsSubscribing(false);
      }
    };

    autoSubscribe();
  }, [isSignedIn, user, open, onOpenChange, isSubscribed, isSubscribing]); // Removed circular deps

  const handleSubscribe = async (): Promise<void> => {
    if (!user) return;

    setIsSubscribing(true);
    setError("");

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

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to signup for updates");
      }

      setIsSubscribed(true);

      // Close modal after delay
      setTimeout(() => {
        onOpenChange(false);
        // Reset state after closing
        setTimeout(() => {
          setIsSubscribed(false);
        }, 300);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to signup for updates");
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>{dict.newsletter?.modal?.title || "Signup For Updates"}</DialogTitle>
          <DialogDescription>
            {isSignedIn
              ? "You're signed in! We'll notify you about important updates."
              : "Sign up with one click to receive AI Power Rankings updates"}
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
                {dict.newsletter?.modal?.thankYou || "Thank you!"}
              </p>
              <p className="text-sm text-muted-foreground">
                You'll receive updates at {user?.primaryEmailAddress?.emailAddress}
              </p>
            </div>
          ) : isSignedIn ? (
            // Already signed in - confirm subscription
            <div className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4">
                <p className="text-sm font-medium mb-1">Signed in as:</p>
                <p className="text-sm text-muted-foreground">{user?.fullName || user?.username}</p>
                <p className="text-sm text-muted-foreground">
                  {user?.primaryEmailAddress?.emailAddress}
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span>{error}</span>
                </div>
              )}

              <div className="flex gap-3">
                <Button className="flex-1" onClick={handleSubscribe} disabled={isSubscribing}>
                  {isSubscribing ? "Subscribing..." : "Confirm Subscription"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isSubscribing}
                >
                  {dict.common?.cancel || "Cancel"}
                </Button>
              </div>
            </div>
          ) : (
            // Not signed in - show Clerk SignIn component
            <div className="space-y-4">
              <SignIn
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
                redirectUrl={window.location.pathname}
                signUpUrl={`${window.location.pathname}?subscribe=true`}
              />

              <p className="text-xs text-muted-foreground text-center">
                {dict.newsletter?.modal?.privacyNote ||
                  "We respect your privacy and will never spam you."}
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
