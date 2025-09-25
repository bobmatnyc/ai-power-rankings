import type { Metadata } from "next";
import { SEODashboard } from "@/components/seo/seo-dashboard";
import { generateMetadata as generateSEOMetadata } from "@/lib/seo/utils";

// Force dynamic rendering - this page may use authentication context
export const dynamic = 'force-dynamic';

export const metadata: Metadata = generateSEOMetadata({
  title: "Admin Dashboard",
  description:
    "Internal admin dashboard for AI Power Rankings website performance and SEO metrics.",
  path: "/admin/dashboard",
  noIndex: true, // Don't index admin pages
});

export default function AdminDashboardPage() {
  return <SEODashboard />;
}
