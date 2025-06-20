import { MarkdownPage } from "@/components/markdown/markdown-page";
import { loadMarkdownContent } from "@/lib/markdown-loader";

export default function ContactPage() {
  const content = loadMarkdownContent("contact.md");
  return <MarkdownPage content={content} />;
}
