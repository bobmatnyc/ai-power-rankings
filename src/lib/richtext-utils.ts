/**
 * Utility functions for handling Payload CMS RichText format
 */

export interface RichTextChild {
  text?: string;
  [key: string]: unknown;
}

export interface RichTextBlock {
  children?: RichTextChild[];
  [key: string]: unknown;
}

export type RichTextContent = string | RichTextBlock[] | undefined | null;

/**
 * Extract plain text from RichText structure
 * @param content - Can be a string or RichText array from Payload CMS
 * @returns Plain text string
 */
export function extractTextFromRichText(content: RichTextContent): string {
  if (!content) {
    return "";
  }

  if (typeof content === "string") {
    return content;
  }

  // Handle RichText array structure
  if (Array.isArray(content)) {
    return content
      .map((block: RichTextBlock) => {
        if (block.children && Array.isArray(block.children)) {
          return block.children.map((child: RichTextChild) => child.text || "").join("");
        }
        return "";
      })
      .join(" ")
      .trim();
  }

  return "";
}
