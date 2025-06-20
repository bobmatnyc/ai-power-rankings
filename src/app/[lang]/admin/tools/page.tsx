import { Metadata } from "next";
import { generateMetadata as generateSEOMetadata } from "@/lib/seo/utils";
import { ToolsManager } from "@/components/admin/tools-manager";

export const metadata: Metadata = generateSEOMetadata({
  title: "Tools Management - Admin",
  description: "Manage AI tools, rankings, and information in the admin panel.",
  path: "/admin/tools",
  noIndex: true,
});

export default function AdminToolsPage() {
  return <ToolsManager />;
}