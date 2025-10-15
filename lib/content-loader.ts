import path from "node:path";
import { unstable_cache } from "next/cache";
import fs from "fs-extra";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";
import type { Locale } from "@/i18n/config";

export interface ContentData {
  title: string;
  subtitle?: string;
  content: string;
  htmlContent: string;
  metadata: Record<string, unknown>;
}

export class ContentLoader {
  private static instance: ContentLoader;
  private contentCache: Map<string, ContentData> = new Map();

  static getInstance(): ContentLoader {
    if (!ContentLoader.instance) {
      ContentLoader.instance = new ContentLoader();
    }
    return ContentLoader.instance;
  }

  async loadContent(locale: Locale, slug: string): Promise<ContentData | null> {
    // Use Next.js unstable_cache for persistent caching across requests
    // Static content rarely changes, so use 1 hour revalidation
    const loadContentCached = unstable_cache(
      async (loc: Locale, sl: string) => {
        try {
          // Try locale-specific content first
          const localePath = path.join(process.cwd(), "src", "content", loc, `${sl}.md`);
          let filePath = localePath;

          // Fall back to English if locale-specific doesn't exist
          if (!(await fs.pathExists(localePath))) {
            filePath = path.join(process.cwd(), "src", "content", "en", `${sl}.md`);

            if (!(await fs.pathExists(filePath))) {
              return null;
            }
          }

          // Read and parse the markdown file
          const fileContent = await fs.readFile(filePath, "utf-8");
          const { data: frontmatter, content } = matter(fileContent);

          // Convert markdown to HTML
          const processedContent = await remark().use(html).process(content);
          const htmlContent = processedContent.toString();

          const contentData: ContentData = {
            title: frontmatter["title"] || sl,
            subtitle: frontmatter["subtitle"],
            content,
            htmlContent,
            metadata: frontmatter,
          };

          return contentData;
        } catch (error) {
          console.error(`Error loading content ${sl} for locale ${loc}:`, error);
          return null;
        }
      },
      [`content-${locale}-${slug}`],
      {
        revalidate: 3600, // 1 hour cache
        tags: [`content`, `content-${locale}`, `content-${slug}`]
      }
    );

    return loadContentCached(locale, slug);
  }

  async listContent(locale: Locale): Promise<string[]> {
    try {
      const contentPath = path.join(process.cwd(), "src", "content", locale);

      if (!(await fs.pathExists(contentPath))) {
        // Fall back to English content list
        const enPath = path.join(process.cwd(), "src", "content", "en");
        if (!(await fs.pathExists(enPath))) {
          return [];
        }
        const files = await fs.readdir(enPath);
        return files.filter((f) => f.endsWith(".md")).map((f) => f.replace(".md", ""));
      }

      const files = await fs.readdir(contentPath);
      return files.filter((f) => f.endsWith(".md")).map((f) => f.replace(".md", ""));
    } catch (error) {
      console.error(`Error listing content for locale ${locale}:`, error);
      return [];
    }
  }

  clearCache(): void {
    this.contentCache.clear();
  }
}

export const contentLoader = ContentLoader.getInstance();
