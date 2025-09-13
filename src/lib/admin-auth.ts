import { cookies } from "next/headers";

export function isAdminAuthenticated(): boolean {
  // In development, bypass auth
  if (process.env["NODE_ENV"] === "development" && process.env["ENABLE_DEV_MODE"] === "true") {
    return true;
  }

  const cookieStore = cookies();
  const sessionToken = cookieStore.get("admin-session");

  // Check if session token exists
  return !!sessionToken?.value;
}

export function clearAdminSession() {
  const cookieStore = cookies();
  cookieStore.delete("admin-session");
}
