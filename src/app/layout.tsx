import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import Script from "next/script";
import { generateOrganizationSchema, createJsonLdScript } from "@/lib/schema";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Inter } from "next/font/google";
import "./globals.css";

// Font optimization for T-031
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  variable: '--font-inter',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env["NEXT_PUBLIC_BASE_URL"] || "https://aipowerranking.com"),
  title: {
    default: "AI Power Rankings - The Definitive Monthly Rankings of AI Coding Tools",
    template: "%s | AI Power Rankings",
  },
  description:
    "The definitive monthly rankings and analysis of agentic AI coding tools. Compare Cursor, GitHub Copilot, Claude, and 50+ AI assistants trusted by developers worldwide.",
  keywords: [
    "AI coding tools",
    "developer tools rankings",
    "AI assistants comparison",
    "Cursor",
    "GitHub Copilot",
    "Claude",
    "coding AI benchmarks",
  ],
  authors: [{ name: "AI Power Rankings Team" }],
  creator: "AI Power Rankings",
  publisher: "AI Power Rankings",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://aipowerranking.com",
    siteName: "AI Power Rankings",
    title: "AI Power Rankings - Developer Tool Intelligence",
    description:
      "The definitive monthly rankings and analysis of agentic AI coding tools, trusted by developers worldwide.",
    images: [
      {
        url: "/api/og?title=AI%20Power%20Rankings&subtitle=Developer%20Tool%20Intelligence",
        width: 1200,
        height: 630,
        alt: "AI Power Rankings",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@aipowerrankings",
    creator: "@aipowerrankings",
  },
  alternates: {
    canonical: "/",
    languages: {
      "en-US": "/",
      "ja-JP": "/ja",
      "zh-CN": "/zh",
      "es-ES": "/es",
      "fr-FR": "/fr",
      "de-DE": "/de",
      "ko-KR": "/ko",
      "pt-BR": "/pt",
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  // Generate organization schema
  const baseUrl = process.env["NEXT_PUBLIC_BASE_URL"] || "https://aipowerranking.com";
  const organizationSchema = generateOrganizationSchema({
    name: "AI Power Rankings",
    url: baseUrl,
    description:
      "The definitive monthly rankings and analysis of agentic AI coding tools, trusted by developers worldwide.",
  });

  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* Critical resource preloading for T-031 */}
        <link rel="preload" href="/crown-of-technology.webp" as="image" />
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://www.google-analytics.com" />

        {/* Critical CSS for T-031 - Above the fold styles */}
        <style dangerouslySetInnerHTML={{
          __html: `
            .hero-section { min-height: 400px; }
            .stats-grid { min-height: 120px; }
            .grid { display: grid; }
            .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
            @media (min-width: 768px) {
              .md\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
            }
            .gap-3 { gap: 0.75rem; }
            .gap-6 { gap: 1.5rem; }
            @media (min-width: 768px) {
              .md\\:gap-6 { gap: 1.5rem; }
            }
          `
        }} />
      </head>
      <body className={inter.className}>
        <Script
          id="organization-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: createJsonLdScript(organizationSchema),
          }}
        />
        <AuthSessionProvider>{children}</AuthSessionProvider>
        {process.env["NEXT_PUBLIC_GA_ID"] && (
          <GoogleAnalytics gaId={process.env["NEXT_PUBLIC_GA_ID"]} />
        )}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
