import type { Metadata } from "next";
import { ToolsManager } from "@/components/admin/tools-manager";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { generateMetadata as generateSEOMetadata } from "@/lib/seo/utils";

// Force dynamic rendering - this page may use authentication context
export const dynamic = "force-dynamic";

export const metadata: Metadata = generateSEOMetadata({
  title: "Tools Management - Admin",
  description: "Manage AI tools, rankings, and information in the admin panel.",
  path: "/admin/tools",
  noIndex: true,
});

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
