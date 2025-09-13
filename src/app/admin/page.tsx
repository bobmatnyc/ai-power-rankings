import { redirect } from "next/navigation";
import UnifiedAdminDashboard from "@/components/admin/unified-admin-dashboard";
import { isAdminAuthenticated } from "@/lib/admin-auth";

export default async function AdminPage() {
  // Check if admin is authenticated
  const isAuthenticated = isAdminAuthenticated();

  if (!isAuthenticated) {
    redirect("/admin/auth/signin");
  }

  return <UnifiedAdminDashboard />;
}
