import { Metadata } from "next";
import { SEODashboard } from "@/components/seo/seo-dashboard";
import { generateMetadata as generateSEOMetadata } from "@/lib/seo/utils";

export const metadata: Metadata = generateSEOMetadata({
  title: "SEO Monitoring Dashboard",
  description:
    "Internal SEO monitoring dashboard for AI Power Rankings website performance and search metrics.",
  path: "/admin/seo-dashboard",
  noIndex: true, // Don't index admin pages
});

export default function SEODashboardPage() {
  return <SEODashboard />;
}
