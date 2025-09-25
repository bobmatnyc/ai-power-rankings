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
  const { lang } = await params;
  const dict = await getDictionary(lang);
  const baseUrl =
    process.env["NEXT_PUBLIC_BASE_URL"] || process.env["VERCEL_URL"]
      ? `https://${process.env["VERCEL_URL"]}`
      : "";

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
}

export default async function RootLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ lang: Locale }>;
}>) {
  const { lang } = await params;
  const dict = await getDictionary(lang);

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
}
