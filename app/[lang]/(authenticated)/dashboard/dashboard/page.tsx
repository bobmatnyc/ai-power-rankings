import type { Metadata } from "next";
import { SEODashboard } from "@/components/seo/seo-dashboard";
import { generateMetadata as generateSEOMetadata } from "@/lib/seo/utils";

// Force dynamic rendering - this page may use authentication context
export const dynamic = "force-dynamic";

// #156: served at /{lang}/dashboard/dashboard; canonical, og:url and hreflang need the locale.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return generateSEOMetadata({
    title: "Admin Dashboard",
    description:
      "Internal admin dashboard for AI Power Rankings website performance and SEO metrics.",
    lang,
    path: "/dashboard/dashboard",
    noIndex: true, // Don't index admin pages
  });
}

export default function AdminDashboardPage() {
  return <SEODashboard />;
}
