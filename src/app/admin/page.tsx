import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth-helper";
import UnifiedAdminDashboard from "@/components/admin/unified-admin-dashboard";

export default async function AdminPage() {
  // Check if user is authenticated
  const { userId } = await getAuth();

  if (!userId) {
    redirect("/sign-in");
  }

  return <UnifiedAdminDashboard />;
}
