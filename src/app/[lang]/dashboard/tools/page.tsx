import { Metadata } from "next";
import { generateMetadata as generateSEOMetadata } from "@/lib/seo/utils";
import { ToolsManager } from "@/components/admin/tools-manager";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";

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
