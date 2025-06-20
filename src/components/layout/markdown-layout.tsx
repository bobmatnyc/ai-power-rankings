import { Card } from "@/components/ui/card";

interface MarkdownLayoutProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function MarkdownLayout({ title, children, className = "" }: MarkdownLayoutProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className={`p-8 md:p-12 bg-white shadow-lg ${className}`}>
          <article className="prose prose-lg max-w-none">
            <h1 className="text-3xl font-bold mb-6 border-b pb-4">{title}</h1>
            <div className="markdown-content">{children}</div>
          </article>
        </Card>
      </div>
    </div>
  );
}
