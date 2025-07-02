import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import Script from "next/script";
import { generateOrganizationSchema, generateWebsiteSchema, createJsonLdScript } from "@/lib/schema";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { Inter } from "next/font/google";
import { getBaseUrl } from "@/lib/get-base-url";
import "./globals.css";

// Font optimization for T-031
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  preload: true,
  variable: "--font-inter",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env["NEXT_PUBLIC_BASE_URL"] ||
      (process.env["VERCEL_URL"] ? `https://${process.env["VERCEL_URL"]}` : "http://localhost:3000")
  ),
  title: {
    default: "AI Power Rankings - Top AI Coding Tools Monthly",
    template: "%s | AI Power Rankings",
  },
  description:
    "Monthly rankings of 50+ AI coding tools. Compare Cursor, GitHub Copilot, Claude & top AI assistants trusted by developers. Updated weekly.",
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
    url: process.env["NEXT_PUBLIC_BASE_URL"] || "/",
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
  // Generate schemas for T-042 SEO optimization
  const baseUrl = getBaseUrl();
  const organizationSchema = generateOrganizationSchema({
    name: "AI Power Rankings",
    url: baseUrl,
    description:
      "The definitive monthly rankings and analysis of agentic AI coding tools, trusted by developers worldwide.",
    logo: `${baseUrl}/crown-of-technology.webp`,
  });
  
  const websiteSchema = generateWebsiteSchema(baseUrl);

  return (
    <html lang="en" className={inter.variable}>
      <head>
        {/* Critical resource preloading for T-031 */}
        <link rel="preload" href="/crown-of-technology.webp" as="image" />
        <link rel="preconnect" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://www.google-analytics.com" />

        {/* Critical CSS for T-031 - Above the fold styles */}
        <style
          dangerouslySetInnerHTML={{
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
          `,
          }}
        />
      </head>
      <body className={inter.className}>
        <Script
          id="organization-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: createJsonLdScript(organizationSchema),
          }}
        />
        <Script
          id="website-schema"
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: createJsonLdScript(websiteSchema),
          }}
        />
        <AuthSessionProvider>{children}</AuthSessionProvider>

        {/* Defer analytics loading for T-031 performance optimization */}
        <SpeedInsights />
        <Analytics />

        {/* Load Google Analytics only after user interaction for T-041 performance */}
        {process.env["NEXT_PUBLIC_GA_ID"] && (
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${process.env["NEXT_PUBLIC_GA_ID"]}`}
            strategy="lazyOnload"
          />
        )}
        {process.env["NEXT_PUBLIC_GA_ID"] && (
          <Script id="google-analytics" strategy="lazyOnload">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${process.env["NEXT_PUBLIC_GA_ID"]}', {
                'send_page_view': false
              });
              
              // Send page view after a delay to not block initial render
              setTimeout(() => {
                gtag('event', 'page_view', {
                  page_location: window.location.href,
                  page_title: document.title
                });
              }, 3000);
            `}
          </Script>
        )}
      </body>
    </html>
  );
}
