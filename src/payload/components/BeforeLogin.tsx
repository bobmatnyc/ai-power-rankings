"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export const BeforeLogin: React.FC = () => {
  const router = useRouter();

  useEffect(() => {
    // Redirect to NextAuth sign-in instead of showing Payload login
    router.push("/admin/auth/signin");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p>Redirecting to sign-in...</p>
      </div>
    </div>
  );
};
