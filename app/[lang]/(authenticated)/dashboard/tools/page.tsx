import type { Metadata } from "next";
import { ToolsManager } from "@/components/admin/tools-manager";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { generateMetadata as generateSEOMetadata } from "@/lib/seo/utils";

// Force dynamic rendering - this page may use authentication context
export const dynamic = "force-dynamic";

// #156: served at /{lang}/dashboard/tools; canonical, og:url and hreflang need the locale.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return generateSEOMetadata({
    title: "Tools Management - Admin",
    description: "Manage AI tools, rankings, and information in the admin panel.",
    lang,
    path: "/dashboard/tools",
    noIndex: true,
  });
}

export default function AdminToolsPage() {
  return (
    <DashboardLayout
      title="Tools Management"
      description="Manage AI tools, rankings, and information"
      backHref="/en"
    >
      <ToolsManager />
    </DashboardLayout>
  );
}
