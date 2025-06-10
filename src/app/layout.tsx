import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Navigation } from "@/components/layout/navigation";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Power Rankings - Data-driven rankings of AI coding tools",
  description: "Comprehensive rankings of AI coding tools using Algorithm v6.0 with innovation decay, platform risk modifiers, and revenue quality adjustments",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="min-h-screen bg-background">
          <nav className="sticky top-0 z-50 w-full bg-background/95 backdrop-blur-sm border-b border-border/50">
            <div className="container mx-auto flex h-16 items-center px-4">
              <Navigation />
            </div>
          </nav>
          <main className="flex-1">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}