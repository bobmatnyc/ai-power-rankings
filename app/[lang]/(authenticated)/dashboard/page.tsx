import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin/admin-dashboard";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { generateMetadata as generateSEOMetadata } from "@/lib/seo/utils";

// Force dynamic rendering - this page requires authentication context
export const dynamic = "force-dynamic";

// #156: served at /{lang}/dashboard; canonical, og:url and hreflang need the locale.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return generateSEOMetadata({
    title: "Admin Panel",
    description: "AI Power Rankings admin panel for site management and monitoring.",
    lang,
    path: "/dashboard",
    noIndex: true, // Don't index admin pages
  });
}

export default function AdminPage() {
  return (
    <DashboardLayout
      title="Admin Dashboard"
      description="Welcome to the AI Power Rankings admin panel"
      showBackButton={true}
      backHref="/en"
    >
      <AdminDashboard />
    </DashboardLayout>
  );
}
