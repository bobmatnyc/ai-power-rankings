import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { AuthSessionProvider } from "@/components/providers/session-provider";
import { getBaseUrl } from "@/lib/get-base-url";
import {
  createJsonLdScript,
  generateOrganizationSchema,
  generateWebsiteSchema,
} from "@/lib/schema";
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
    "AI code completion",
    "autonomous coding agents",
    "IDE assistant tools",
    "AI pair programming",
    "code generation AI",
    "AI development tools",
    "smart code editor",
    "AI code review",
    "automated programming",
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
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "16x16 32x32 48x48" },
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
    other: [{ rel: "mask-icon", url: "/crown-of-technology.webp", color: "#00ffdd" }],
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

        {/* Favicon links for better compatibility */}
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-icon.png" />

        {/* Critical CSS for T-031 - Above the fold styles */}
        <style
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Critical CSS for performance optimization
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
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Safe JSON-LD structured data
          dangerouslySetInnerHTML={{
            __html: createJsonLdScript(organizationSchema),
          }}
        />
        <Script
          id="website-schema"
          type="application/ld+json"
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Safe JSON-LD structured data
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
