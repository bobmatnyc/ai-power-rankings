"use client";

import { Shield } from "lucide-react";
import { usePathname } from "next/navigation";
import type React from "react";

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
};

type UseUserType = () => {
  user: {
    publicMetadata?: {
      isAdmin?: boolean;
    };
  } | null;
};

let ClerkUserButton: ClerkUserButtonType | null = null;
let useUser: UseUserType | null = null;

// Load Clerk components conditionally
if (typeof window !== "undefined") {
  try {
    const clerkModule = require("@clerk/nextjs");
    ClerkUserButton = clerkModule.UserButton;
    useUser = clerkModule.useUser;
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

// Component that uses Clerk hooks (only rendered when Clerk is available)
function ClerkUserButtonWithAdmin({ afterSignOutUrl, ...props }: UserButtonWithAdminProps) {
  const pathname = usePathname();
  // Safe to use useUser here since this component is only rendered when useUser exists
  const useUserSafe = useUser as UseUserType;
  const { user } = useUserSafe();

  // Extract language from pathname
  const lang = pathname.split("/")[1] || "en";

  // Check if user is admin
  const isAdmin = user?.publicMetadata?.isAdmin === true;

  // Use Clerk's UserButton with custom children for admin link
  // Safe to use ClerkUserButton here since this component is only rendered when it exists
  const UserButton = ClerkUserButton as ClerkUserButtonType;

  return (
    <UserButton afterSignOutUrl={afterSignOutUrl} {...props}>
      {isAdmin && UserButton.MenuItems && UserButton.Link && (
        <UserButton.MenuItems>
          <UserButton.Link
            label="Admin Dashboard"
            labelIcon={<Shield className="w-4 h-4" />}
            href={`/${lang}/admin`}
          />
        </UserButton.MenuItems>
      )}
    </UserButton>
  );
}

export function UserButtonWithAdmin(props: UserButtonWithAdminProps) {
  // If Clerk isn't available, return a fallback button
  if (!ClerkUserButton || !useUser) {
    return <FallbackUserButton />;
  }

  // Clerk is available, render the component that uses hooks
  return <ClerkUserButtonWithAdmin {...props} />;
}
