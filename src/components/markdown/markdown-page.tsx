import { Card } from "@/components/ui/card";

interface MarkdownPageProps {
  content: string;
  className?: string;
}

export function MarkdownPage({ content, className = "" }: MarkdownPageProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className={`p-8 md:p-12 bg-white shadow-lg ${className}`}>
          <article className="prose prose-lg max-w-none">
            <div
              dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }}
              className="markdown-content"
            />
          </article>
        </Card>
      </div>
    </div>
  );
}

// Simple markdown parser for basic formatting
function parseMarkdown(markdown: string): string {
  let html = markdown;

  // Headers
  html = html.replace(/^### (.*$)/gim, '<h3 class="text-xl font-semibold mt-6 mb-3">$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2 class="text-2xl font-bold mt-8 mb-4">$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1 class="text-3xl font-bold mb-6">$1</h1>');

  // Bold
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold">$1</strong>');

  // Links
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" class="text-blue-600 hover:text-blue-800 underline">$1</a>'
  );

  // Lists
  html = html.replace(/^\* (.+)$/gim, '<li class="ml-6 mb-2">$1</li>');
  html = html.replace(/(<li.*<\/li>)/s, '<ul class="list-disc mb-4">$1</ul>');

  // Numbered lists
  html = html.replace(/^\d+\. (.+)$/gim, '<li class="ml-6 mb-2">$1</li>');

  // Paragraphs
  html = html.replace(/\n\n/g, '</p><p class="mb-4">');
  html = '<p class="mb-4">' + html + "</p>";

  // Clean up empty paragraphs
  html = html.replace(/<p class="mb-4"><\/p>/g, "");
  html = html.replace(/<p class="mb-4">(<h[123])/g, "$1");
  html = html.replace(/(<\/h[123]>)<\/p>/g, "$1");
  html = html.replace(/<p class="mb-4">(<ul)/g, "$1");
  html = html.replace(/(<\/ul>)<\/p>/g, "$1");

  // Horizontal rules
  html = html.replace(/^---$/gim, '<hr class="my-8 border-gray-300">');

  // Italic text
  html = html.replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>');

  return html;
}
