"use client";

import { UserButton as ClerkUserButton, useUser } from "@clerk/nextjs";
import { Shield } from "lucide-react";
import { usePathname } from "next/navigation";

interface UserButtonWithAdminProps {
  afterSignOutUrl?: string;
  [key: string]: unknown;
}

export function UserButtonWithAdmin({ afterSignOutUrl, ...props }: UserButtonWithAdminProps) {
  const { user } = useUser();
  const pathname = usePathname();

  // Extract language from pathname
  const lang = pathname.split("/")[1] || "en";

  // Check if user is admin
  const isAdmin = user?.publicMetadata?.isAdmin === true;

  // Use Clerk's UserButton with custom children for admin link
  return (
    <ClerkUserButton afterSignOutUrl={afterSignOutUrl} {...props}>
      {isAdmin && (
        <ClerkUserButton.MenuItems>
          <ClerkUserButton.Link
            label="Admin Dashboard"
            labelIcon={<Shield className="w-4 h-4" />}
            href={`/${lang}/admin`}
          />
        </ClerkUserButton.MenuItems>
      )}
    </ClerkUserButton>
  );
}
