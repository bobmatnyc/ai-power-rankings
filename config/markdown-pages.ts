/**
 * Markdown pages configuration
 */

export interface MarkdownPageConfig {
  title: string;
  description: string;
  markdownFile: string;
  noIndex?: boolean;
}

export const markdownPages: Record<string, MarkdownPageConfig> = {
  // Add markdown page configurations here
  // Example:
  // "about": {
  //   title: "About Us",
  //   description: "Learn about AI Power Rankings",
  //   markdownFile: "content/about.md"
  // }
};
