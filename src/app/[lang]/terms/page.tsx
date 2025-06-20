import { MarkdownPage } from "@/components/markdown/markdown-page";
import { loadMarkdownContent } from "@/lib/markdown-loader";

export default function TermsPage() {
  const content = loadMarkdownContent("terms-of-use.md");
  return <MarkdownPage content={content} />;
}
