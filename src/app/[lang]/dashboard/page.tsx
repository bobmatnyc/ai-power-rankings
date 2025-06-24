import { Metadata } from "next";
import { generateMetadata as generateSEOMetadata } from "@/lib/seo/utils";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export const metadata: Metadata = generateSEOMetadata({
  title: "Admin Panel",
  description: "AI Power Rankings admin panel for site management and monitoring.",
  path: "/admin",
  noIndex: true, // Don't index admin pages
});

export default function AdminPage() {
  return <AdminDashboard />;
}
