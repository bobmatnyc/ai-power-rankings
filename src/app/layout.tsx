import { ClerkProvider } from "@clerk/nextjs";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

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
  // Skip ClerkProvider during build/prerendering to avoid SSR context errors
  const isBuilding =
    process.env["NODE_ENV"] === "production" && !process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];

  const content = (
    <html lang="en" className={inter.variable}>
      <body className={inter.className}>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );

  // Only wrap with ClerkProvider if we have a publishable key and not building
  if (!isBuilding && process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]) {
    return (
      <ClerkProvider
        publishableKey={process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"]}
        signInFallbackRedirectUrl="/"
        signUpFallbackRedirectUrl="/"
      >
        {content}
      </ClerkProvider>
    );
  }

  return content;
}
