import { cookies } from "next/headers";

export async function isAdminAuthenticated(): Promise<boolean> {
  // In development, bypass auth
  if (process.env["NODE_ENV"] === "development" && process.env["ENABLE_DEV_MODE"] === "true") {
    return true;
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("admin-session");

  // Check if session token exists
  return !!sessionToken?.value;
}

export async function clearAdminSession() {
  const cookieStore = await cookies();
  cookieStore.delete("admin-session");
}
