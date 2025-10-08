"use client";

import { AlertCircle, CheckCircle, Loader2, Mail, Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useAuth, useUser } from "@/components/auth/auth-components";
import { SignupForUpdatesModal } from "@/components/ui/signup-for-updates-modal";

// Component for non-logged-in users to sign up
function SignupCTA({ onOpenModal }: { onOpenModal: () => void }) {
  return (
    <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-blue-200 dark:border-blue-900">
      <CardHeader className="text-center">
        <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
          <Mail className="h-8 w-8 text-blue-600 dark:text-blue-400" />
        </div>
        <CardTitle className="text-2xl">Stay Updated with AI Power Rankings</CardTitle>
        <CardDescription className="text-base">
          Sign up to receive weekly AI tool updates, rankings, and exclusive insights
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Weekly Rankings & Updates</p>
              <p className="text-sm text-muted-foreground">
                Get the latest AI tool rankings delivered to your inbox every week
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Exclusive Insights</p>
              <p className="text-sm text-muted-foreground">
                Deep dives into AI tool trends and analysis
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-medium">Early Access</p>
              <p className="text-sm text-muted-foreground">
                Be the first to know about new tools and features
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={onOpenModal}
          className="w-full h-12 text-base"
          size="lg"
        >
          <Mail className="h-5 w-5 mr-2" />
          Sign Up for Updates
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Free forever. No spam. Unsubscribe anytime.
        </p>
      </CardContent>
    </Card>
  );
}

// Component for logged-in users to manage preferences
function UserPreferences({ user }: { user: any }) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // Load current subscription status
  useEffect(() => {
    if (user) {
      const subscribed = user.unsafeMetadata?.newsletter_subscribed === true;
      setIsSubscribed(subscribed);
      setIsLoading(false);
    }
  }, [user]);

  const handleToggleSubscription = async (checked: boolean) => {
    setIsSaving(true);
    setSaveStatus("idle");
    setErrorMessage("");

    try {
      // Update user metadata via Clerk
      await user.update({
        unsafeMetadata: {
          ...user.unsafeMetadata,
          newsletter_subscribed: checked,
        },
      });

      setIsSubscribed(checked);
      setSaveStatus("success");

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveStatus("idle");
      }, 3000);
    } catch (error) {
      setSaveStatus("error");
      setErrorMessage(
        error instanceof Error ? error.message : "Failed to update preferences. Please try again."
      );
      // Revert the checkbox state
      setIsSubscribed(!checked);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Newsletter Preferences
        </CardTitle>
        <CardDescription>
          Manage your email subscription preferences
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-start space-x-3 space-y-0 rounded-lg border p-4">
          <Checkbox
            id="newsletter"
            checked={isSubscribed}
            onCheckedChange={handleToggleSubscription}
            disabled={isSaving}
          />
          <div className="flex-1 space-y-1 leading-none">
            <Label
              htmlFor="newsletter"
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
            >
              Subscribe to weekly AI tool updates
            </Label>
            <p className="text-sm text-muted-foreground">
              Receive weekly rankings, insights, and exclusive AI tool analysis
            </p>
          </div>
        </div>

        {saveStatus === "success" && (
          <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
            <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
            <AlertDescription className="text-green-800 dark:text-green-200">
              Your preferences have been updated successfully!
            </AlertDescription>
          </Alert>
        )}

        {saveStatus === "error" && (
          <Alert className="border-red-200 bg-red-50 dark:bg-red-950/20">
            <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
            <AlertDescription className="text-red-800 dark:text-red-200">
              {errorMessage}
            </AlertDescription>
          </Alert>
        )}

        <div className="rounded-lg bg-muted/50 p-4">
          <p className="text-sm font-medium mb-2">Current Status</p>
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isSubscribed ? "bg-green-500" : "bg-gray-400"
              }`}
            />
            <p className="text-sm text-muted-foreground">
              {isSubscribed ? "Subscribed to updates" : "Not subscribed"}
            </p>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Email: {user?.primaryEmailAddress?.emailAddress || "No email"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export function ContactForm() {
  const { isSignedIn } = useAuth();
  const { user } = useUser();
  const [isClientMounted, setIsClientMounted] = useState(false);
  const [showSignupModal, setShowSignupModal] = useState(false);

  // Ensure component is properly hydrated before interacting with Clerk context
  useEffect(() => {
    setIsClientMounted(true);
  }, []);

  // Don't render interactive elements until client is mounted
  if (!isClientMounted) {
    return null;
  }

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Show signup CTA for non-logged-in users, preferences for logged-in users */}
        {!isSignedIn ? (
          <SignupCTA onOpenModal={() => setShowSignupModal(true)} />
        ) : (
          <UserPreferences user={user} />
        )}

        {/* Additional Information */}
        <div className="space-y-6">
          {/* Why Sign Up */}
          <Card>
            <CardHeader>
              <CardTitle>Why Sign Up?</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-3">
                Join thousands of developers staying ahead with:
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Weekly curated rankings of top AI tools
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Expert analysis and trend insights
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary">•</span>
                  Early access to new features and tools
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Social Media */}
          <Card>
            <CardHeader>
              <CardTitle>Follow Us</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <a
                  href="https://hyperdev.matsuoka.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm hover:text-primary transition-colors"
                >
                  <strong>Twitter/X:</strong> HyperDev
                </a>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                <a
                  href="https://hyperdev.matsuoka.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm hover:text-primary transition-colors"
                >
                  <strong>LinkedIn:</strong> HyperDev
                </a>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-gray-800 rounded-full"></div>
                <a
                  href="https://hyperdev.matsuoka.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm hover:text-primary transition-colors"
                >
                  <strong>GitHub:</strong> HyperDev
                </a>
              </div>
            </CardContent>
          </Card>

          {/* Privacy Note */}
          <Card>
            <CardHeader>
              <CardTitle>Your Privacy Matters</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                We respect your privacy and will never share your email with third parties.
                You can unsubscribe at any time with a single click.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Signup Modal */}
      <SignupForUpdatesModal
        open={showSignupModal}
        onOpenChange={setShowSignupModal}
      />
    </>
  );
}
