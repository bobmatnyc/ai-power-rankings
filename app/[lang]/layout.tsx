import type { Metadata } from "next";
import localFont from "next/font/local";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
import { ClientLayout } from "@/components/layout/client-layout";
import type { Locale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { STATIC_CATEGORIES } from "@/lib/data/static-categories";

// Self-hosted fonts for optimal performance
// Eliminates external DNS lookups and reduces FCP by 400-800ms
// Using display: "optional" to prevent layout shifts (CLS optimization)
const geistSans = localFont({
  src: [
    {
      path: "../../public/fonts/Inter-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../public/fonts/Inter-SemiBold.woff2",
      weight: "600",
      style: "normal",
    },
    {
      path: "../../public/fonts/Inter-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-geist-sans",
  display: "optional",
  preload: true,
  fallback: ["system-ui", "-apple-system", "BlinkMacSystemFont", "Segoe UI", "Arial", "sans-serif"],
});

const geistMono = localFont({
  src: "../../public/fonts/JetBrainsMono-Regular.woff2",
  variable: "--font-geist-mono",
  display: "optional",
  preload: true,
  fallback: ["Consolas", "Monaco", "Courier New", "monospace"],
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
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

export default async function LanguageLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}>) {
  try {
    console.log("[Layout] LanguageLayout: Starting layout render");
    console.log("[Layout] LanguageLayout: Node environment:", process.env["NODE_ENV"]);
    console.log("[Layout] LanguageLayout: Vercel environment:", process.env["VERCEL_ENV"]);

    const resolvedParams = await params;
    console.log("[Layout] LanguageLayout: Resolved params:", resolvedParams);

    const lang = (resolvedParams?.lang || "en") as Locale;
    console.log("[Layout] LanguageLayout: Language:", lang);

    const dict = await getDictionary(lang);
    console.log("[Layout] LanguageLayout: Dictionary loaded:", !!dict);
    console.log("[Layout] LanguageLayout: Dictionary keys:", dict ? Object.keys(dict) : "No dict");

    // Use static categories generated at build time
    // This eliminates the 1000-1500ms database query and enables ISR
    const categories = STATIC_CATEGORIES;
    console.log("[Layout] LanguageLayout: Static categories loaded:", categories.length);

    // IMPORTANT: Do NOT render <html> or <body> tags in nested layouts
    // Only the root layout (/app/layout.tsx) should have these
    // The lang attribute should be set server-side in the root layout
    // Font variables are already set in the root layout with inline styles
    return (
      <>
        <ClientLayout lang={lang as Locale} dict={dict} categories={categories}>
          {children}
        </ClientLayout>

        {/* Google Analytics only - other analytics are in root layout */}
        <GoogleAnalytics />
      </>
    );
  } catch (error) {
    console.error("[Layout] LanguageLayout: Critical error in layout:", error);
    console.error("[Layout] LanguageLayout: Error stack:", error instanceof Error ? error.stack : "No stack");
    console.error("[Layout] LanguageLayout: Error type:", error?.constructor?.name);

    // Return a minimal error layout without HTML/body tags
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
