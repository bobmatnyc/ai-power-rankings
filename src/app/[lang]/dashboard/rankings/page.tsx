import { Metadata } from "next";
import { generateMetadata as generateSEOMetadata } from "@/lib/seo/utils";
import { RankingsManager } from "@/components/admin/rankings-manager";

export const metadata: Metadata = generateSEOMetadata({
  title: "Rankings Management - Admin",
  description: "Preview and generate AI tool rankings",
  path: "/dashboard/rankings",
  noIndex: true,
});

export default function RankingsPage() {
  return <RankingsManager />;
}
