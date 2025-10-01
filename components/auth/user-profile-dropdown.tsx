"use client";

import { Bell, ChevronDown, LogOut, Settings, Shield, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type React from "react";
import { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

// Type definitions for user
type UserType = {
  publicMetadata?: {
    isAdmin?: boolean;
  };
  emailAddresses?: Array<{
    emailAddress: string;
  }>;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  imageUrl?: string;
};

interface UserProfileDropdownProps {
  user: UserType | null;
  signOut?: () => void;
  afterSignOutUrl?: string;
}

export function UserProfileDropdown({ user, signOut, afterSignOutUrl }: UserProfileDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  // Extract language from pathname
  const lang = pathname.split("/")[1] || "en";

  // Check if user is admin
  const isAdmin = user?.publicMetadata?.isAdmin === true;

  // Load subscription state from localStorage on mount
  useEffect(() => {
    if (user?.emailAddresses?.[0]?.emailAddress) {
      const storedSubscription = localStorage.getItem(`subscription_${user.emailAddresses[0].emailAddress}`);
      setIsSubscribed(storedSubscription === "true");
    }
  }, [user]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Handle subscription toggle
  const handleSubscriptionToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    if (user?.emailAddresses?.[0]?.emailAddress) {
      const newValue = !isSubscribed;
      setIsSubscribed(newValue);
      localStorage.setItem(`subscription_${user.emailAddresses[0].emailAddress}`, String(newValue));

      // You could also make an API call here to update the subscription in your backend
      console.log(`User ${user.emailAddresses[0].emailAddress} subscription updated to: ${newValue}`);
    }
  };

  const handleSignOut = () => {
    setIsOpen(false);
    if (signOut) {
      signOut();
    }
  };

  if (!user) {
    return null;
  }

  const displayName = user.fullName || user.firstName || user.emailAddresses?.[0]?.emailAddress || "User";
  const initials = displayName
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-accent transition-colors"
        aria-label="User menu"
      >
        {user.imageUrl ? (
          <img
            src={user.imageUrl}
            alt={displayName}
            className="w-8 h-8 rounded-full object-cover"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
            {initials}
          </div>
        )}
        <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-background border rounded-lg shadow-lg z-50">
          <div className="p-3 border-b">
            <div className="flex items-center gap-3">
              {user.imageUrl ? (
                <img
                  src={user.imageUrl}
                  alt={displayName}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                  {initials}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{displayName}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {user.emailAddresses?.[0]?.emailAddress}
                </div>
              </div>
            </div>
          </div>

          <div className="p-2">
            {/* Conditional rendering based on admin status */}
            {isAdmin ? (
              // Admin user - show admin login option
              <Link
                href={`/${lang}/admin`}
                className="flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
                onClick={() => setIsOpen(false)}
              >
                <Shield className="h-4 w-4" />
                <span>Admin Dashboard</span>
              </Link>
            ) : (
              // Non-admin user - show subscribe checkbox
              <label className="flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors cursor-pointer">
                <input
                  type="checkbox"
                  checked={isSubscribed}
                  onChange={handleSubscriptionToggle}
                  className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary focus:ring-offset-0"
                />
                <Bell className="h-4 w-4" />
                <span className="flex-1">Subscribe for Updates</span>
              </label>
            )}

            <div className="my-1 border-t" />

            {/* Common menu items */}
            <Link
              href={`/${lang}/profile`}
              className="flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <User className="h-4 w-4" />
              <span>My Profile</span>
            </Link>

            <Link
              href={`/${lang}/settings`}
              className="flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </Link>

            <div className="my-1 border-t" />

            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm rounded-md hover:bg-accent transition-colors text-left"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}