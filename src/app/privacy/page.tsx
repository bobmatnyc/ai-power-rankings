import { Metadata } from "next";
import { MarkdownPage } from "@/components/markdown/markdown-page";
import { generateMetadata as generateSEOMetadata } from "@/lib/seo/utils";
import { loadMarkdownContent } from "@/lib/markdown-loader";

export const metadata: Metadata = generateSEOMetadata({
  title: "Privacy Policy",
  description:
    "AI Power Rankings privacy policy. Learn how we collect, use, and protect your personal information.",
  path: "/privacy",
  noIndex: false,
});

export default function PrivacyPage() {
  const content = loadMarkdownContent("privacy-policy.md");
  return <MarkdownPage content={content} />;
}
