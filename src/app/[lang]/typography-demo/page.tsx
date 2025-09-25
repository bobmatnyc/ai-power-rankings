import { TypographyDemo } from "@/components/typography-demo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Typography Demo - AI Power Rankings",
  description: "Showcase of the enhanced typography and design system",
};

export default function TypographyDemoPage() {
  return (
    <main className="min-h-screen bg-background">
      <TypographyDemo />
    </main>
  );
}