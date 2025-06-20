import { Metadata } from "next";
import { MarkdownLayout } from "@/components/layout/markdown-layout";
import { MarkdownContent } from "@/lib/markdown-renderer";
import {
  generateMarkdownPageMetadata,
  getMarkdownPageContent,
  getMarkdownPageConfig,
} from "@/lib/markdown-page-utils";
import { notFound } from "next/navigation";

export const metadata: Metadata = generateMarkdownPageMetadata("contact");

export default function ContactPage() {
  const config = getMarkdownPageConfig("contact");
  const content = getMarkdownPageContent("contact");

  if (!config || !content) {
    notFound();
  }

  return (
    <MarkdownLayout title={config.title}>
      <MarkdownContent content={content} />
    </MarkdownLayout>
  );
}
