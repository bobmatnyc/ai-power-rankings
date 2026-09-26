import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { DeferredAnalytics } from "@/components/analytics/deferred-analytics";
import {
  generateOrganizationSchema,
  generateWebsiteSchema,
  createJsonLdScript,
} from "@/lib/schema";
import { siteOrigin } from "@/lib/site-origin";

export const metadata: Metadata = {
  title: {
    default: "AI Power Rankings - Top AI Coding Tools Monthly",
    template: "%s | AI Power Rankings",
  },
  description:
    "Monthly rankings of 50+ AI coding tools. Compare Cursor, GitHub Copilot, Claude & top AI assistants trusted by developers. Updated monthly.",
  keywords: [
    "AI coding tools",
    "developer tools rankings",
    "AI assistants comparison",
    "Cursor",
    "GitHub Copilot",
    "Claude",
  ],
  // #153: relative metadata URLs resolve against the production origin, never
  // the per-deployment VERCEL_URL host.
  metadataBase: new URL(siteOrigin()),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
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
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Note: The lang attribute defaults to "en" but will be updated by locale-specific routes
  // The suppressHydrationWarning is necessary because the lang attribute may differ
  // between server and client rendering in internationalized routes

  // #153: schema markup names the production origin, never the VERCEL_URL host.
  const baseUrl = siteOrigin();

  // Generate site-wide schema markup
  const organizationSchema = generateOrganizationSchema({
    name: "AI Power Rankings",
    url: baseUrl,
    logo: `${baseUrl}/logo.png`,
    description: "The definitive monthly rankings and analysis of agentic AI coding tools, trusted by developers worldwide.",
  });

  const websiteSchema = generateWebsiteSchema(baseUrl);

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Lighthouse Performance: Preload LCP image - single size to avoid attribute issues */}
        <link
          rel="preload"
          as="image"
          type="image/webp"
          href="/crown-of-technology-64.webp"
          fetchPriority="high"
        />

        {/* Google Tag Manager */}
        <Script
          strategy="afterInteractive"
          src="https://www.googletagmanager.com/gtag/js?id=G-5YBL6NPWL6"
        />
        <Script
          id="google-analytics"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', 'G-5YBL6NPWL6');
            `,
          }}
        />

        {/* Schema.org markup for SEO - Organization */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: createJsonLdScript(organizationSchema) }}
        />

        {/* Schema.org markup for SEO - Website */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: createJsonLdScript(websiteSchema) }}
        />
      </head>
      <body className="antialiased" suppressHydrationWarning>
        {children}
        <SpeedInsights />
        <DeferredAnalytics />
      </body>
    </html>
  );
}
