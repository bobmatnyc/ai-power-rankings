import { Metadata } from "next";
import { MarkdownLayout } from "@/components/layout/markdown-layout";
import { MarkdownContent } from "@/lib/markdown-renderer";
import {
  generateMarkdownPageMetadata,
  getMarkdownPageContent,
  getMarkdownPageConfig,
} from "@/lib/markdown-page-utils";
import { notFound } from "next/navigation";

export const metadata: Metadata = generateMarkdownPageMetadata("privacy");

export default function PrivacyPage() {
  const config = getMarkdownPageConfig("privacy");
  const content = getMarkdownPageContent("privacy");

  if (!config || !content) {
    notFound();
  }

  return (
    <MarkdownLayout title={config.title}>
      <MarkdownContent content={content} />
    </MarkdownLayout>
  );
}
