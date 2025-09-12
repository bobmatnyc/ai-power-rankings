import { redirect } from "next/navigation";
import { auth } from "@/auth";
import UnifiedAdminDashboard from "@/components/admin/unified-admin-dashboard";
import { shouldBypassAuth } from "@/lib/auth-utils";

export default async function AdminPage() {
  // Bypass authentication for local development
  if (shouldBypassAuth()) {
    console.log("🔓 Local environment detected - bypassing authentication");
    return <UnifiedAdminDashboard />;
  }

  // Production authentication check
  const session = await auth();

  if (!session?.user?.isAdmin) {
    redirect("/admin/auth/signin");
  }

  return <UnifiedAdminDashboard />;
}
