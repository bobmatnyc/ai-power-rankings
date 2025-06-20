import { Metadata } from "next";
import { MarkdownPage } from "@/components/markdown/markdown-page";
import { generateMetadata as generateSEOMetadata } from "@/lib/seo/utils";
import { loadMarkdownContent } from "@/lib/markdown-loader";

export const metadata: Metadata = generateSEOMetadata({
  title: "Terms of Use",
  description:
    "Terms of Use for AI Power Rankings. Read our terms and conditions for using our website and services.",
  path: "/terms",
  noIndex: false,
});

export default function TermsPage() {
  const content = loadMarkdownContent("terms-of-use.md");
  return <MarkdownPage content={content} />;
}
