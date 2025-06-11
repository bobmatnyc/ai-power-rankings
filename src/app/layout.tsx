import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Power Ranking - Data-driven rankings of AI coding tools",
  description:
    "Comprehensive ranking of AI coding tools using Algorithm v6.0 with innovation decay, platform risk modifiers, and revenue quality adjustments",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>): React.JSX.Element {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
