"use client";

import { SignedInWrapper, SignedOutWrapper, SignInButton, SignUpButton, UserButton } from "./auth-components";

function ClerkHeader() {
  return (
    <header className="flex justify-end items-center p-4 gap-4 h-16 border-b">
      <SignedOutWrapper>
        <SignInButton mode="modal">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
          >
            Sign In
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button
            type="button"
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
          >
            Sign Up
          </button>
        </SignUpButton>
      </SignedOutWrapper>
      <SignedInWrapper>
        <UserButton afterSignOutUrl="/" />
      </SignedInWrapper>
    </header>
  );
}

export default ClerkHeader;
