"use client";

import { useEffect, useState } from "react";
import { WhatsNewModal } from "./whats-new-modal";

function WhatsNewModalClient(): React.JSX.Element {
  const [showWhatsNew, setShowWhatsNew] = useState(false);

  useEffect(() => {
    // Check if modal should be shown - use sessionStorage for one-time-per-session behavior
    const shouldShowModal = () => {
      // Check if already shown in this session
      const shownThisSession = sessionStorage.getItem("whatsNewShownThisSession");
      if (shownThisSession === "true") {
        return false;
      }

      // Check if user permanently disabled auto-show
      const autoShowDisabled = localStorage.getItem("autoShowDisabled");
      if (autoShowDisabled === "true") {
        return false;
      }

      return true;
    };

    // Show modal after a short delay to ensure page is loaded
    const timer = setTimeout(() => {
      if (shouldShowModal()) {
        setShowWhatsNew(true);
        // Mark as shown this session (will reset when browser tab closes)
        sessionStorage.setItem("whatsNewShownThisSession", "true");
      }
    }, 1500); // 1.5 second delay

    return () => clearTimeout(timer);
  }, []);

  return <WhatsNewModal open={showWhatsNew} onOpenChange={setShowWhatsNew} />;
}

export default WhatsNewModalClient;
