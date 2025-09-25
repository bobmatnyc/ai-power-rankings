import type { Metadata } from "next";
import { SubscribersPage } from "@/components/admin/subscribers-page";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { generateMetadata as generateSEOMetadata } from "@/lib/seo/utils";

// Force dynamic rendering - this page may use authentication context
export const dynamic = 'force-dynamic';


export const metadata: Metadata = generateSEOMetadata({
  title: "Subscriber Management",
  description: "Manage newsletter subscribers and email lists.",
  path: "/admin/subscribers",
  noIndex: true, // Don't index admin pages
});

export default function Subscribers() {
  return (
    <DashboardLayout
      title="Subscriber Management"
      description="Manage newsletter subscribers and email lists"
      backHref="/en"
    >
      <SubscribersPage />
    </DashboardLayout>
  );
}
