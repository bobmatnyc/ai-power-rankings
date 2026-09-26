import { redirect } from "next/navigation";
import UnifiedAdminDashboard from "@/components/admin/unified-admin-dashboard";
import { requireAdmin } from "@/lib/api-auth";

// Force dynamic rendering - this page requires authentication
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ lang: string }>;
}

/**
 * Admin dashboard page.
 *
 * Why: Uses the same admin check as the admin API routes, so the
 * auth-disabled flag and missing Clerk keys only bypass it in local
 * development.
 * What: No session → sign-in; any other refusal (not an admin, or auth not
 * configured) → unauthorized; an admin gets the dashboard.
 * Test: `tests/unit/admin-page-debug-routes-auth.test.ts`.
 */
export default async function AdminPage({ params }: PageProps) {
  const { lang } = await params;

  const authResult = await requireAdmin();
  if (authResult.error) {
    redirect(authResult.error.status === 401 ? `/${lang}/sign-in` : `/${lang}/unauthorized`);
  }

  return <UnifiedAdminDashboard />;
}
