import { Metadata } from "next";
import Link from "next/link";
import { generateMetadata as generateSEOMetadata } from "@/lib/seo/utils";
import { RankingsViewer } from "@/components/admin/rankings-viewer";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export const metadata: Metadata = generateSEOMetadata({
  title: "Rankings Management - Admin",
  description: "View and manage AI tool rankings",
  path: "/dashboard/rankings",
  noIndex: true,
});

export default function RankingsPage() {
  return (
    <DashboardLayout
      title="Rankings Management"
      description="View and manage existing AI tool rankings"
      backHref="/en"
      action={
        <Link href="/en/dashboard/rankings/build">
          <Button size="lg" className="bg-green-600 hover:bg-green-700">
            <Plus className="h-4 w-4 mr-2" />
            Build New Rankings
          </Button>
        </Link>
      }
    >
      <RankingsViewer />
    </DashboardLayout>
  );
}
