import { Loader2, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { RankingsViewer } from "@/components/admin/rankings-viewer";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { Button } from "@/components/ui/button";
import { generateMetadata as generateSEOMetadata } from "@/lib/seo/utils";

// Force dynamic rendering - this page may use authentication context
export const dynamic = "force-dynamic";

export const metadata: Metadata = generateSEOMetadata({
  title: "Rankings Management - Admin",
  description: "View and manage AI tool rankings",
  path: "/dashboard/rankings",
  noIndex: true,
});

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
    </div>
  );
}

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
      <Suspense fallback={<LoadingFallback />}>
        <RankingsViewer />
      </Suspense>
    </DashboardLayout>
  );
}
