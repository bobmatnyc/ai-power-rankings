import { Metadata } from "next";
import { generateMetadata as generateSEOMetadata } from "@/lib/seo/utils";
import { EnhancedRankingsManager } from "@/components/admin/enhanced-rankings-manager";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";

export const metadata: Metadata = generateSEOMetadata({
  title: "Rankings Management - Admin",
  description: "Preview and generate AI tool rankings with advanced controls",
  path: "/dashboard/rankings",
  noIndex: true,
});

export default function RankingsPage() {
  return (
    <DashboardLayout 
      title="Rankings Management"
      description="Preview, build, and manage AI tool rankings with date-based controls"
      backHref="/en"
    >
      <EnhancedRankingsManager />
    </DashboardLayout>
  );
}
