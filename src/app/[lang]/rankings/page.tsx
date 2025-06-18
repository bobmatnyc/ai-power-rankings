import { Suspense } from "react";
import RankingsGrid from "@/components/ranking/rankings-grid";
import { getDictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { loggers } from "@/lib/logger";

interface PageProps {
  params: Promise<{ lang: Locale }>;
}

export default async function RankingsPage({ params }: PageProps): Promise<React.JSX.Element> {
  const { lang } = await params;
  const dict = await getDictionary(lang);

  // Fetch rankings on the server (same as home page)
  let initialRankings = [];
  try {
    const isDev = process.env.NODE_ENV === "development";
    const baseUrl = isDev
      ? "http://localhost:3001"
      : process.env["NEXT_PUBLIC_BASE_URL"] || "http://localhost:3000";
    const timestamp = Date.now();
    const url = `${baseUrl}/api/rankings${isDev ? `?_t=${timestamp}` : ""}`;

    const response = await fetch(url, {
      next: { revalidate: isDev ? 0 : 300 },
      cache: isDev ? "no-store" : "default",
    });

    const data = await response.json();
    initialRankings = data.rankings || [];
  } catch (error) {
    loggers.ranking.error("Failed to fetch rankings on server", { error });
  }

  return (
    <div className="px-3 md:px-6 py-8 max-w-7xl mx-auto">
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">{dict.common.loading}</p>
          </div>
        }
      >
        <RankingsGrid lang={lang} dict={dict} initialRankings={initialRankings} />
      </Suspense>
    </div>
  );
}
