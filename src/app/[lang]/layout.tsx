import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { ClientLayout } from "@/components/layout/client-layout";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Force dynamic rendering to ensure Clerk authentication works properly
// Static generation causes issues with authentication context
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: Locale }>;
}): Promise<Metadata> {
  try {
    console.log("[Layout] generateMetadata: Starting metadata generation");
    const resolvedParams = await params;
    console.log("[Layout] generateMetadata: Resolved params:", resolvedParams);

    const lang = (resolvedParams?.lang || "en") as Locale;
    console.log("[Layout] generateMetadata: Language:", lang);

    const dict = await getDictionary(lang);
    console.log("[Layout] generateMetadata: Dictionary loaded:", !!dict);

    const baseUrl =
      process.env["NEXT_PUBLIC_BASE_URL"] || process.env["VERCEL_URL"]
        ? `https://${process.env["VERCEL_URL"]}`
        : "";
    console.log("[Layout] generateMetadata: Base URL:", baseUrl);

    return {
      title: dict.seo?.title || `${dict.common.appName} - ${dict.common.appDescription}`,
      description: dict.seo?.description || dict.home.methodology.algorithmDescription,
      keywords: dict.seo?.keywords?.split(", ") || [],
      alternates: {
        types: {
          "application/rss+xml": [
            {
              title: "AI Power Rankings - News & Updates",
              url: `${baseUrl}/${lang}/news/rss.xml`,
            },
          ],
        },
      },
    };
  } catch (error) {
    console.error("[Layout] generateMetadata: Error generating metadata:", error);
    console.error("[Layout] generateMetadata: Error stack:", error instanceof Error ? error.stack : "No stack");
    // Return minimal metadata on error
    return {
      title: "AI Power Rankings",
      description: "Comprehensive rankings of AI coding tools and assistants",
    };
  }
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ lang: Locale }>;
}>) {
  try {
    console.log("[Layout] RootLayout: Starting layout render");
    console.log("[Layout] RootLayout: Node environment:", process.env["NODE_ENV"]);
    console.log("[Layout] RootLayout: Vercel environment:", process.env["VERCEL_ENV"]);

    const resolvedParams = await params;
    console.log("[Layout] RootLayout: Resolved params:", resolvedParams);

    const lang = (resolvedParams?.lang || "en") as Locale;
    console.log("[Layout] RootLayout: Language:", lang);

    const dict = await getDictionary(lang);
    console.log("[Layout] RootLayout: Dictionary loaded:", !!dict);
    console.log("[Layout] RootLayout: Dictionary keys:", dict ? Object.keys(dict) : "No dict");

    return (
      <div className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen`}>
        <ClientLayout lang={lang} dict={dict}>
          {children}
        </ClientLayout>

        {/* Optimized analytics loading */}
        <GoogleAnalytics />
        <SpeedInsights />
        <Analytics />
      </div>
    );
  } catch (error) {
    console.error("[Layout] RootLayout: Critical error in layout:", error);
    console.error("[Layout] RootLayout: Error stack:", error instanceof Error ? error.stack : "No stack");
    console.error("[Layout] RootLayout: Error type:", error?.constructor?.name);

    // Return a minimal error layout
    return (
      <div className="min-h-screen p-8">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Layout Error</h1>
        <p className="text-gray-600 mb-2">An error occurred while rendering the layout.</p>
        <details className="mt-4 p-4 bg-gray-100 rounded">
          <summary className="cursor-pointer font-semibold">Error Details</summary>
          <pre className="mt-2 whitespace-pre-wrap text-sm">
            {error instanceof Error ? error.message : String(error)}
          </pre>
        </details>
        <div className="mt-8">
          {children}
        </div>
      </div>
    );
  }
}
