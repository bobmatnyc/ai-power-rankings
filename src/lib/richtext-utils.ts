/**
 * Utility functions for handling Payload CMS RichText format
 */

/**
 * Extract plain text from RichText structure
 * @param content - Can be a string or RichText array from Payload CMS
 * @returns Plain text string
 */
export function extractTextFromRichText(content: string | any[] | undefined | null): string {
  if (!content) {
    return "";
  }

  if (typeof content === "string") {
    return content;
  }

  // Handle RichText array structure
  if (Array.isArray(content)) {
    return content
      .map((block: any) => {
        if (block.children && Array.isArray(block.children)) {
          return block.children.map((child: any) => child.text || "").join("");
        }
        return "";
      })
      .join(" ")
      .trim();
  }

  return "";
}
