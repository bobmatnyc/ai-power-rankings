import { redirect } from "next/navigation";
import UnifiedAdminDashboard from "@/components/admin/unified-admin-dashboard";
import { getAuth, isAdmin } from "@/lib/auth-helper";

// Force dynamic rendering - this page requires authentication
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ lang: string }>;
}

export default async function AdminPage({ params }: PageProps) {
  // Await the params
  const { lang } = await params;

  // Check if user is authenticated
  const { userId } = await getAuth();

  if (!userId) {
    redirect(`/${lang}/sign-in`);
  }

  // Check if user has admin role
  const isUserAdmin = await isAdmin();

  if (!isUserAdmin) {
    // Redirect to unauthorized page if not an admin
    redirect(`/${lang}/unauthorized`);
  }

  return <UnifiedAdminDashboard />;
}
