import type { Metadata } from "next";
import "./globals.css";
import { DeferredAnalytics } from "@/components/analytics/deferred-analytics";
import {
  generateOrganizationSchema,
  generateWebsiteSchema,
  createJsonLdScript,
} from "@/lib/schema";

export const metadata: Metadata = {
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
  ],
  metadataBase: new URL(
    process.env["NEXT_PUBLIC_BASE_URL"] ||
      (process.env["VERCEL_URL"] ? `https://${process.env["VERCEL_URL"]}` : "http://localhost:3001")
  ),
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

  // Get base URL for schema markup
  const baseUrl =
    process.env["NEXT_PUBLIC_BASE_URL"] ||
    (process.env["VERCEL_URL"] ? `https://${process.env["VERCEL_URL"]}` : "https://aipowerranking.com");

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
          fetchpriority="high"
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
        <DeferredAnalytics />
      </body>
    </html>
  );
}
