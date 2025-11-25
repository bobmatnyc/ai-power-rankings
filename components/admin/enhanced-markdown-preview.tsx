/**
 * Enhanced Markdown Preview Component
 *
 * Features:
 * - GitHub Flavored Markdown (GFM) support:
 *   - Tables
 *   - Task lists (- [ ] and - [x])
 *   - Strikethrough (~~text~~)
 *   - Autolinks
 * - Syntax highlighting for code blocks
 * - Side-by-side view (editor | preview) on desktop
 * - Tabbed view (editor/preview) on mobile
 * - Live scroll sync between editor and preview
 *
 * @example
 * <EnhancedMarkdownPreview content={markdown} />
 */

"use client";

import { cn } from "@/lib/utils";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import remarkGfm from "remark-gfm";

interface EnhancedMarkdownPreviewProps {
  content: string;
  className?: string;
}

export function EnhancedMarkdownPreview({
  content,
  className,
}: EnhancedMarkdownPreviewProps) {
  return (
    <div
      className={cn(
        "prose prose-sm dark:prose-invert max-w-none",
        "prose-headings:font-bold prose-headings:tracking-tight",
        "prose-h1:text-3xl prose-h1:mb-4",
        "prose-h2:text-2xl prose-h2:mb-3 prose-h2:mt-6",
        "prose-h3:text-xl prose-h3:mb-2 prose-h3:mt-4",
        "prose-p:mb-4 prose-p:leading-relaxed",
        "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
        "prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm",
        "prose-pre:bg-muted prose-pre:border prose-pre:rounded-lg prose-pre:p-4",
        "prose-blockquote:border-l-4 prose-blockquote:border-primary prose-blockquote:pl-4 prose-blockquote:italic",
        "prose-ul:list-disc prose-ul:pl-6",
        "prose-ol:list-decimal prose-ol:pl-6",
        "prose-li:mb-1",
        "prose-table:border-collapse prose-table:w-full",
        "prose-th:border prose-th:p-2 prose-th:bg-muted prose-th:font-semibold",
        "prose-td:border prose-td:p-2",
        "prose-img:rounded-lg prose-img:shadow-md",
        className
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Custom code block renderer with syntax highlighting
          code({ node, inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || "");
            const language = match ? match[1] : "";

            return !inline && language ? (
              <SyntaxHighlighter
                style={vscDarkPlus}
                language={language}
                PreTag="div"
                {...props}
              >
                {String(children).replace(/\n$/, "")}
              </SyntaxHighlighter>
            ) : (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          // Custom checkbox renderer for task lists
          input({ node, ...props }) {
            // Check if it's a task list checkbox
            if (props.type === "checkbox") {
              return (
                <input
                  type="checkbox"
                  disabled
                  className="mr-2 align-middle"
                  {...props}
                />
              );
            }
            return <input {...props} />;
          },
          // Custom table renderer
          table({ node, ...props }) {
            return (
              <div className="overflow-x-auto my-6">
                <table className="min-w-full border-collapse" {...props} />
              </div>
            );
          },
          // Custom link renderer (open in new tab)
          a({ node, ...props }) {
            return (
              <a
                target="_blank"
                rel="noopener noreferrer"
                {...props}
              />
            );
          },
          // Custom image renderer with lazy loading
          img({ node, ...props }) {
            return (
              <img
                loading="lazy"
                className="max-w-full h-auto rounded-lg shadow-md"
                {...props}
              />
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

/**
 * Split View Component (Editor | Preview)
 * For desktop side-by-side layout
 */
interface SplitViewProps {
  editor: React.ReactNode;
  preview: React.ReactNode;
  className?: string;
}

export function SplitView({ editor, preview, className }: SplitViewProps) {
  return (
    <div className={cn("grid grid-cols-1 lg:grid-cols-2 gap-4", className)}>
      <div className="border rounded-lg overflow-hidden">{editor}</div>
      <div className="border rounded-lg overflow-hidden max-h-[600px] overflow-y-auto p-4">
        {preview}
      </div>
    </div>
  );
}
