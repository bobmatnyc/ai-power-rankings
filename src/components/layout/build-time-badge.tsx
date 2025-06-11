"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { getFormattedBuildTime } from "@/lib/build-info";
import { ChangelogModal } from "@/components/ui/changelog-modal";

export function BuildTimeBadge() {
  const [buildTime, setBuildTime] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Update immediately
    setBuildTime(getFormattedBuildTime());

    // Update every minute to keep the relative time accurate
    const interval = setInterval(() => {
      setBuildTime(getFormattedBuildTime());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Don't render until mounted to avoid hydration mismatch
  if (!mounted) {
    return (
      <ChangelogModal>
        <Badge
          variant="outline"
          className="hidden sm:flex cursor-pointer hover:bg-muted transition-colors"
        >
          <Clock className="h-3 w-3 mr-1" />
          Last updated: Loading...
        </Badge>
      </ChangelogModal>
    );
  }

  return (
    <ChangelogModal>
      <Badge
        variant="outline"
        className="hidden sm:flex cursor-pointer hover:bg-muted transition-colors"
      >
        <Clock className="h-3 w-3 mr-1" />
        Last updated: {buildTime}
      </Badge>
    </ChangelogModal>
  );
}
