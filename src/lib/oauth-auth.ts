import type { NextRequest } from "next/server";

// In production, use a shared store (Redis, database, etc.)
// For now, we'll use in-memory storage
const accessTokens = new Map();

export function checkOAuthToken(request: NextRequest): { isValid: boolean; scope?: string } {
  // Development mode - bypass auth
  const isDevelopment =
    process.env.NODE_ENV === "development" || process.env.ENABLE_DEV_MODE === "true";
  if (isDevelopment) {
    return { isValid: true, scope: "read write" };
  }

  const authHeader = request.headers.get("authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return { isValid: false };
  }

  const token = authHeader.substring(7);
  const tokenData = accessTokens.get(token);

  if (!tokenData || tokenData.expiresAt < Date.now()) {
    return { isValid: false };
  }

  return { isValid: true, scope: tokenData.scope };
}

export function requireScope(scope: string, tokenScope: string | undefined): boolean {
  if (!tokenScope) {
    return false;
  }
  const scopes = tokenScope.split(" ");
  return scopes.includes(scope) || scopes.includes("write");
}

// Export the tokens map for the OAuth endpoints to use
export { accessTokens };
