"use client";

import { Clock } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { WhatsNewModal } from "@/components/ui/whats-new-modal";
import { getFormattedBuildTime } from "@/lib/build-info";

export function BuildTimeBadge() {
  const [buildTime, setBuildTime] = useState<string>("");
  const [mounted, setMounted] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);

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
      <>
        <Badge
          variant="outline"
          className="hidden sm:flex cursor-pointer hover:bg-muted transition-colors"
          onClick={() => setModalOpen(true)}
        >
          <Clock className="h-3 w-3 mr-1" />
          Last updated: Loading...
        </Badge>
        <WhatsNewModal open={modalOpen} onOpenChange={setModalOpen} />
      </>
    );
  }

  return (
    <>
      <Badge
        variant="outline"
        className="hidden sm:flex cursor-pointer hover:bg-muted transition-colors"
        onClick={() => setModalOpen(true)}
      >
        <Clock className="h-3 w-3 mr-1" />
        Last updated: {buildTime}
      </Badge>
      <WhatsNewModal open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
