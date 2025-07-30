import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import { GoogleAnalytics } from "@/components/analytics/GoogleAnalytics";
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
        
        {/* Enhanced resource hints for faster loading */}
        <link rel="preconnect" href="https://www.googletagmanager.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://www.google-analytics.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://www.googletagmanager.com" />
        <link rel="dns-prefetch" href="https://www.google-analytics.com" />
        <link rel="dns-prefetch" href="https://www.google.com" />
        <link rel="dns-prefetch" href="https://stats.g.doubleclick.net" />

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
            /* Critical CSS Variables */
            :root {
              --background: 0 0% 100%;
              --foreground: 222.2 84% 4.9%;
              --primary: 217 91% 59%;
              --primary-foreground: 210 40% 98%;
              --border: 214.3 31.8% 91.4%;
              --radius: 0.5rem;
            }
            
            /* Base critical styles */
            * {
              border-color: hsl(var(--border));
            }
            
            body {
              background-color: hsl(var(--background));
              color: hsl(var(--foreground));
              margin: 0;
              padding: 0;
            }
            
            /* Critical layout styles */
            .hero-section { min-height: 400px; }
            .stats-grid { min-height: 120px; }
            .grid { display: grid; }
            .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
            .gap-3 { gap: 0.75rem; }
            .gap-6 { gap: 1.5rem; }
            
            /* Critical typography */
            .text-sm { font-size: 0.875rem; line-height: 1.25rem; }
            .text-base { font-size: 1rem; line-height: 1.5rem; }
            .text-lg { font-size: 1.125rem; line-height: 1.75rem; }
            .text-xl { font-size: 1.25rem; line-height: 1.75rem; }
            .text-2xl { font-size: 1.5rem; line-height: 2rem; }
            .text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
            .text-4xl { font-size: 2.25rem; line-height: 2.5rem; }
            .font-medium { font-weight: 500; }
            .font-semibold { font-weight: 600; }
            .font-bold { font-weight: 700; }
            
            /* Critical spacing */
            .p-4 { padding: 1rem; }
            .p-6 { padding: 1.5rem; }
            .py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
            .px-4 { padding-left: 1rem; padding-right: 1rem; }
            .mt-4 { margin-top: 1rem; }
            .mb-4 { margin-bottom: 1rem; }
            
            /* Critical flexbox */
            .flex { display: flex; }
            .flex-col { flex-direction: column; }
            .items-center { align-items: center; }
            .justify-center { justify-content: center; }
            .justify-between { justify-content: space-between; }
            
            /* Critical borders and rounding */
            .rounded { border-radius: 0.25rem; }
            .rounded-md { border-radius: calc(var(--radius) - 2px); }
            .rounded-lg { border-radius: var(--radius); }
            .border { border-width: 1px; }
            
            /* Critical colors */
            .bg-primary { background-color: hsl(var(--primary)); }
            .text-primary { color: hsl(var(--primary)); }
            .text-primary-foreground { color: hsl(var(--primary-foreground)); }
            
            /* Critical responsive styles */
            @media (min-width: 768px) {
              .md\\:grid-cols-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
              .md\\:gap-6 { gap: 1.5rem; }
              .md\\:text-2xl { font-size: 1.5rem; line-height: 2rem; }
              .md\\:text-3xl { font-size: 1.875rem; line-height: 2.25rem; }
              .md\\:text-4xl { font-size: 2.25rem; line-height: 2.5rem; }
            }
            
            /* Prevent layout shift */
            img { max-width: 100%; height: auto; }
            .min-h-screen { min-height: 100vh; }
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

        {/* Optimized analytics loading with web worker support */}
        <GoogleAnalytics />
        
        {/* Vercel analytics with lazy loading */}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
