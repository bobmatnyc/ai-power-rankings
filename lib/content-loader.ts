import path from "node:path";
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
    const cacheKey = `${locale}/${slug}`;

    // Check cache first
    if (this.contentCache.has(cacheKey)) {
      return this.contentCache.get(cacheKey)!;
    }

    try {
      // Try locale-specific content first
      const localePath = path.join(process.cwd(), "src", "content", locale, `${slug}.md`);
      let filePath = localePath;

      // Fall back to English if locale-specific doesn't exist
      if (!(await fs.pathExists(localePath))) {
        filePath = path.join(process.cwd(), "src", "content", "en", `${slug}.md`);

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
        title: frontmatter["title"] || slug,
        subtitle: frontmatter["subtitle"],
        content,
        htmlContent,
        metadata: frontmatter,
      };

      // Cache the result
      this.contentCache.set(cacheKey, contentData);

      return contentData;
    } catch (error) {
      console.error(`Error loading content ${slug} for locale ${locale}:`, error);
      return null;
    }
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
