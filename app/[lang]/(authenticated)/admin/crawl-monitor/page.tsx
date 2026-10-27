import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/api-auth";
import CrawlMonitorClient from "./crawl-monitor-client";

// #325: admin data; never prerender or cache.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

interface PageProps {
  params: Promise<{ lang: string }>;
}

/**
 * Crawl monitor page (#325).
 *
 * Why: the admin layout checks sign-in only, so this page checks admin itself,
 * the same way the admin dashboard page does.
 * What: No session → sign-in; any other refusal → unauthorized; an admin gets
 * the read-only monitor, which loads its data from the admin-only
 * `/api/admin/crawl-monitor/*` routes.
 * Test: `tests/unit/crawl-monitor-325.test.ts`.
 */
export default async function CrawlMonitorPage({ params }: PageProps) {
  const { lang } = await params;
  const authResult = await requireAdmin();
  if (authResult.error) {
    redirect(authResult.error.status === 401 ? `/${lang}/sign-in` : `/${lang}/unauthorized`);
  }
  return <CrawlMonitorClient lang={lang} />;
}
