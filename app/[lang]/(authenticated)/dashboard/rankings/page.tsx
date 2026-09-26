import { Loader2 } from "lucide-react";
import type { Metadata } from "next";
import { Suspense } from "react";
import { RankingsViewer } from "@/components/admin/rankings-viewer";
import { DashboardLayout } from "@/components/dashboard/dashboard-layout";
import { generateMetadata as generateSEOMetadata } from "@/lib/seo/utils";

// Force dynamic rendering - this page may use authentication context
export const dynamic = "force-dynamic";

// #156: served at /{lang}/dashboard/rankings; canonical and og:url need the locale; noindex, so no hreflang.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  return generateSEOMetadata({
    title: "Rankings Management - Admin",
    description: "View and manage AI tool rankings",
    lang,
    path: "/dashboard/rankings",
    noIndex: true,
  });
}

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
    >
      <Suspense fallback={<LoadingFallback />}>
        <RankingsViewer />
      </Suspense>
    </DashboardLayout>
  );
}
