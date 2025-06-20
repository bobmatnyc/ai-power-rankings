import { Metadata } from "next";
import { MarkdownPage } from "@/components/markdown/markdown-page";
import { generateMetadata as generateSEOMetadata } from "@/lib/seo/utils";
import { loadMarkdownContent } from "@/lib/markdown-loader";

export const metadata: Metadata = generateSEOMetadata({
  title: "Contact Us",
  description:
    "Get in touch with AI Power Rankings. Contact us for inquiries, partnerships, or to submit your AI coding tool.",
  path: "/contact",
  noIndex: false,
});

export default function ContactPage() {
  const content = loadMarkdownContent("contact.md");
  return <MarkdownPage content={content} />;
}
