import type { Metadata } from "next";
import { RankingBuilder } from "@/components/admin/ranking-builder";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { generateMetadata as generateSEOMetadata } from "@/lib/seo/utils";

export const metadata: Metadata = generateSEOMetadata({
  title: "Build Rankings - Admin",
  description: "Build new AI tool rankings with date selection and preview",
  path: "/dashboard/rankings/build",
  noIndex: true,
});

export default function BuildRankingsPage() {
  return (
    <DashboardLayout
      title="Build New Rankings"
      description="Select date and build new AI tool rankings with live preview"
      backHref="/dashboard/rankings"
    >
      <RankingBuilder />
    </DashboardLayout>
  );
}
