import { MarkdownPage } from "@/components/markdown/markdown-page";
import { loadMarkdownContent } from "@/lib/markdown-loader";

export default function PrivacyPage() {
  const content = loadMarkdownContent("privacy-policy.md");
  return <MarkdownPage content={content} />;
}
