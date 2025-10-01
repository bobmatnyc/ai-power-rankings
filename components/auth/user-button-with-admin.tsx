"use client";

import { Bell, Shield } from "lucide-react";
import { usePathname } from "next/navigation";
import type React from "react";
import { useState, useEffect } from "react";
// CRITICAL FIX: Use safe useUser hook from auth-components that handles missing ClerkProvider
import { useUser } from "./auth-components";

// Dynamically load Clerk components to handle cases where Clerk isn't available
type ClerkUserButtonType = React.ComponentType<{
  afterSignOutUrl?: string;
  children?: React.ReactNode;
  [key: string]: unknown;
}> & {
  MenuItems?: React.ComponentType<{ children?: React.ReactNode }>;
  Link?: React.ComponentType<{
    label: string;
    labelIcon?: React.ReactNode;
    href: string;
  }>;
  Action?: React.ComponentType<{
    label: string;
    labelIcon?: React.ReactNode;
    onClick: () => void;
  }>;
};

let ClerkUserButton: ClerkUserButtonType | null = null;

// Load Clerk UserButton component conditionally
if (typeof window !== "undefined") {
  try {
    const clerkModule = require("@clerk/nextjs");
    ClerkUserButton = clerkModule.UserButton;
  } catch (error) {
    console.warn("[UserButtonWithAdmin] Clerk module not available:", error);
  }
}

interface UserButtonWithAdminProps {
  afterSignOutUrl?: string;
  [key: string]: unknown;
}

// Fallback component when Clerk is not available
function FallbackUserButton() {
  return (
    <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse" title="User menu unavailable" />
  );
}

// Custom menu item component for subscription checkbox
function SubscriptionMenuItem({ user }: { user: any }) {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch user preferences on mount
  useEffect(() => {
    if (user?.id) {
      fetchPreferences();
    }
  }, [user]);

  const fetchPreferences = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch("/api/user/preferences");

      if (!response.ok) {
        throw new Error("Failed to fetch preferences");
      }

      const preferences = await response.json();
      // Use emailNotifications as the main subscription flag
      setIsSubscribed(preferences.emailNotifications || false);
    } catch (err) {
      console.error("[SubscriptionMenuItem] Error fetching preferences:", err);
      setError("Failed to load preferences");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggle = async () => {
    try {
      const newValue = !isSubscribed;
      setIsSubscribed(newValue);

      const response = await fetch("/api/user/preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          emailNotifications: newValue,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to update preferences");
      }

      console.log(`[SubscriptionMenuItem] User subscription updated to: ${newValue}`);
    } catch (err) {
      console.error("[SubscriptionMenuItem] Error updating preferences:", err);
      // Revert on error
      setIsSubscribed(!isSubscribed);
      setError("Failed to update preferences");
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      className="cl-userButtonPopoverActionButton cl-userButtonPopoverActionButton__manageAccount"
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        width: "100%",
        padding: "8px 12px",
        fontSize: "14px",
        textAlign: "left",
        background: "transparent",
        border: "none",
        cursor: isLoading ? "wait" : "pointer",
        transition: "background-color 0.15s",
        opacity: isLoading ? 0.6 : 1,
      }}
      onMouseEnter={(e) => !isLoading && (e.currentTarget.style.backgroundColor = "rgba(0, 0, 0, 0.03)")}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <input
          type="checkbox"
          checked={isSubscribed}
          onChange={handleToggle}
          onClick={(e) => e.stopPropagation()}
          disabled={isLoading}
          style={{
            width: "16px",
            height: "16px",
            cursor: isLoading ? "wait" : "pointer",
          }}
        />
        <Bell style={{ width: "16px", height: "16px" }} />
      </div>
      <span>{error || "Subscribe for Updates"}</span>
    </button>
  );
}

// Component that uses Clerk hooks (only rendered when Clerk is available)
function ClerkUserButtonWithAdmin({ afterSignOutUrl, ...props }: UserButtonWithAdminProps) {
  const pathname = usePathname();
  // Use the safe useUser hook from auth-components that handles ClerkProvider context
  const { user } = useUser();

  // Extract language from pathname
  const lang = pathname.split("/")[1] || "en";

  // Check if user is admin - safely access publicMetadata with type assertion
  const typedUser = user as any;
  const isAdmin = typedUser?.publicMetadata?.isAdmin === true;

  // Use Clerk's UserButton with custom children
  // Safe to use ClerkUserButton here since this component is only rendered when it exists
  const UserButton = ClerkUserButton as ClerkUserButtonType;

  return (
    <UserButton afterSignOutUrl={afterSignOutUrl} {...props}>
      {UserButton.MenuItems && (
        <UserButton.MenuItems>
          {isAdmin ? (
            // Admin user - show admin dashboard link
            UserButton.Link && (
              <UserButton.Link
                label="Admin Dashboard"
                labelIcon={<Shield className="w-4 h-4" />}
                href={`/${lang}/admin`}
              />
            )
          ) : (
            // Non-admin user - show custom subscription checkbox
            <SubscriptionMenuItem user={user} />
          )}
        </UserButton.MenuItems>
      )}
    </UserButton>
  );
}

export function UserButtonWithAdmin(props: UserButtonWithAdminProps) {
  // If ClerkUserButton component isn't available, return a fallback button
  // Note: We always have useUser available from auth-components, so no need to check it
  if (!ClerkUserButton) {
    return <FallbackUserButton />;
  }

  // Clerk UserButton is available, render the component that uses hooks
  return <ClerkUserButtonWithAdmin {...props} />;
}
