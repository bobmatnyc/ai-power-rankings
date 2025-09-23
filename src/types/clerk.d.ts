/**
 * Clerk User Metadata Type Definitions
 *
 * These types extend the Clerk user metadata to include custom fields
 * that are used in the application for authorization and features.
 */

declare global {
  interface UserPublicMetadata {
    isAdmin?: boolean;
  }
}

export {};
