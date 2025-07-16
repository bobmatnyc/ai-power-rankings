"use client";

import { useEffect, useState } from "react";
import { WhatsNewModal } from "./whats-new-modal";

export function WhatsNewModalClient(): React.JSX.Element {
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  useEffect(() => {
    // Check if modal should be shown
    const shouldShowModal = () => {
      // Check if user has dismissed the modal recently (within 7 days)
      const dismissedAt = localStorage.getItem("whatsNewDismissed");
      if (dismissedAt) {
        const dismissTime = parseInt(dismissedAt);
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        if (dismissTime > sevenDaysAgo) {
          return false; // Don't show if dismissed within last 7 days
        }
      }

      // Check if user has seen modal today
      const lastShown = localStorage.getItem("whatsNewLastShown");
      if (lastShown) {
        const lastShownDate = new Date(parseInt(lastShown));
        const today = new Date();
        if (lastShownDate.toDateString() === today.toDateString()) {
          return false; // Don't show if already shown today
        }
      }

      return true;
    };

    // Show modal after a short delay to ensure page is loaded
    const timer = setTimeout(() => {
      if (shouldShowModal()) {
        setShowWhatsNew(true);
        // Mark as shown today
        localStorage.setItem("whatsNewLastShown", Date.now().toString());
      }
    }, 2000); // 2 second delay

    return () => clearTimeout(timer);
  }, []);

  return <WhatsNewModal open={showWhatsNew} onOpenChange={setShowWhatsNew} />;
}
