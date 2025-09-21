import { redirect } from "next/navigation";
import UnifiedAdminDashboard from "@/components/admin/unified-admin-dashboard";
import { getAuth } from "@/lib/auth-helper";

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

  return <UnifiedAdminDashboard />;
}
