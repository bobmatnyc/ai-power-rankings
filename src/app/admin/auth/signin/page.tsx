'use client';

import { useEffect } from 'react';
import { signIn } from 'next-auth/react';

export default function PayloadSignIn() {
  useEffect(() => {
    // Automatically redirect to Google OAuth
    signIn('google', { callbackUrl: '/admin' });
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p>Redirecting to Google sign-in...</p>
      </div>
    </div>
  );
}