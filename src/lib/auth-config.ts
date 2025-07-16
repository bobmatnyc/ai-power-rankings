/**
 * Auth configuration utilities
 */

/**
 * Get authorized admin emails from environment variable
 * AUTHORIZED_EMAILS can be a comma-separated list of emails
 * Example: "user1@example.com,user2@example.com"
 */
export function getAuthorizedEmails(): string[] {
  const emails = process.env.AUTHORIZED_EMAILS || "";
  return emails
    .split(",")
    .map((email) => email.trim())
    .filter((email) => email.length > 0);
}

/**
 * Check if an email is authorized for admin access
 */
export function isAuthorizedEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }
  const authorizedEmails = getAuthorizedEmails();
  return authorizedEmails.includes(email);
}
