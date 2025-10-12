"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
// Newsletter modal removed - using Clerk authentication
import type { Locale } from "@/i18n/config";
import type { ContentData } from "@/lib/content-loader";

interface MarkdownAboutContentProps {
  lang: Locale;
  content: ContentData;
}

// Function to replace component placeholders in HTML
function processMarkdownWithComponents(htmlContent: string, lang: Locale): string {
  let processedContent = htmlContent;

  // Remove NewsletterButton placeholders
  processedContent = processedContent.replace(/<NewsletterButton\s*\/>/g, "");

  // Replace TechStackButton
  processedContent = processedContent.replace(
    /<TechStackButton\s*\/>/g,
    `<div class="flex flex-wrap gap-4">
      <button class="tech-stack-button inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2 gap-2">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect>
          <path d="m9 9 6 6"></path>
          <path d="m15 9-6 6"></path>
        </svg>
        View Tech Stack
      </button>
    </div>`
  );

  // Replace ButtonGroup and buttons
  processedContent = processedContent.replace(
    /<ButtonGroup>(.*?)<\/ButtonGroup>/g,
    '<div class="flex flex-col sm:flex-row gap-4">$1</div>'
  );

  // Replace PrimaryButton
  processedContent = processedContent.replace(
    /<PrimaryButton href="([^"]*)">(.*?)<\/PrimaryButton>/g,
    `<a href="${lang}$1" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">$2</a>`
  );

  // Replace SecondaryButton
  processedContent = processedContent.replace(
    /<SecondaryButton href="([^"]*)">(.*?)<\/SecondaryButton>/g,
    `<a href="${lang}$1" class="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 border border-input bg-background hover:bg-accent hover:text-accent-foreground h-10 px-4 py-2">$2</a>`
  );

  // Replace ExternalLink
  processedContent = processedContent.replace(
    /<ExternalLink href="([^"]*)">(.*?)<\/ExternalLink>/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline">$2</a>'
  );

  // Remove any newsletter-related placeholders
  processedContent = processedContent.replace(/<NewsletterModal\s*\/>/g, "");
  processedContent = processedContent.replace(/<Newsletter[^>]*\/>/g, "");

  return processedContent;
}

export function MarkdownAboutContent({
  lang,
  content,
}: MarkdownAboutContentProps): React.JSX.Element {
  const searchParams = useSearchParams();
  // Newsletter functionality removed - using Clerk for authentication

  useEffect(() => {
    // Clean up any legacy subscribe params
    if (searchParams.get("subscribe") === "true") {
      const url = new URL(window.location.href);
      url.searchParams.delete("subscribe");
      window.history.replaceState({}, "", url.pathname);
    }
  }, [searchParams]);

  useEffect(() => {
    // Add event listeners for custom buttons after content loads
    const techStackButtons = document.querySelectorAll(".tech-stack-button");

    // For tech stack buttons, we'll need to handle them separately
    // This is a simplified version - you might want to implement a proper modal
    techStackButtons.forEach((button) => {
      button.addEventListener("click", () => {
        console.log("Tech Stack modal would open here. Implement TechStackModal component.");
      });
    });

    return () => {
      techStackButtons.forEach((button) => {
        button.removeEventListener("click", () => {});
      });
    };
  }, []);

  const processedContent = processMarkdownWithComponents(content.htmlContent, lang);

  return (
    <main className="container mx-auto p-4 md:p-8 max-w-4xl">
      <article
        className="prose prose-lg dark:prose-invert max-w-none
          prose-headings:font-bold prose-headings:tracking-tight
          prose-h2:text-3xl prose-h2:mt-8 prose-h2:mb-4
          prose-h3:text-2xl prose-h3:mt-6 prose-h3:mb-3
          prose-h4:text-xl prose-h4:mt-4 prose-h4:mb-2
          prose-p:text-muted-foreground prose-p:leading-relaxed
          prose-ul:my-4 prose-li:text-muted-foreground
          prose-strong:font-semibold prose-strong:text-foreground
          prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded
          prose-pre:bg-muted prose-pre:border prose-pre:border-border
          prose-blockquote:border-l-primary prose-blockquote:bg-muted/50
          prose-table:w-full prose-th:text-left prose-th:font-semibold
          prose-td:p-2 prose-th:p-2 prose-tr:border-b prose-tr:border-muted"
        // biome-ignore lint/security/noDangerouslySetInnerHtml: Safe pre-processed markdown with component placeholders
        dangerouslySetInnerHTML={{ __html: processedContent }}
      />
    </main>
  );
}
