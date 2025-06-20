import type { Metadata } from "next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { Analytics } from "@vercel/analytics/react";
import { SEOProvider } from "@/components/seo/seo-provider";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env["NEXT_PUBLIC_BASE_URL"] || "https://aipowerrankings.com"),
  title: {
    default: "AI Power Rankings - The Definitive Monthly Rankings of AI Coding Tools",
    template: "%s | AI Power Rankings",
  },
  description:
    "The definitive monthly rankings and analysis of agentic AI coding tools. Compare Cursor, GitHub Copilot, Claude, and 50+ AI assistants trusted by 500K+ developers.",
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
    url: "https://aipowerrankings.com",
    siteName: "AI Power Rankings",
    title: "AI Power Rankings - Developer Tool Intelligence",
    description:
      "The definitive monthly rankings and analysis of agentic AI coding tools, trusted by 500K+ developers worldwide.",
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
  return (
    <html lang="en">
      <body>
        <SEOProvider />
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
