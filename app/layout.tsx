import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import ClerkProviderClient from "@/components/auth/clerk-provider-client";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

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
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body
        className="antialiased"
        style={{
          ["--font-inter" as any]: inter.style.fontFamily,
        }}
        suppressHydrationWarning
      >
        <ClerkProviderClient>
          {children}
          <Analytics />
          <SpeedInsights />
        </ClerkProviderClient>
      </body>
    </html>
  );
}
